/**
 * Gemini Live API Service
 * Handles WebSocket-based voice conversations with Gemini Live Audio
 *
 * Uses ephemeral tokens for secure authentication:
 * - Token is generated server-side via Convex action
 * - Token is short-lived (1 min to start, 30 min max session)
 * - API key never exposed to browser
 */

import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Listing } from "../types";
import { AUDIO_CONFIG } from "./audioUtils";

export interface LiveSessionConfig {
  token: string; // Ephemeral token from backend
  listings: Listing[];
  conversationHistory: { role: 'user' | 'model'; text: string }[];
  onAudioData: (data: Int16Array) => void;
  onTextResponse?: (text: string) => void;
  onError?: (error: Error) => void;
  onSessionEnd?: () => void;
}

export interface LiveSession {
  send: (audioData: Int16Array) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  close: () => Promise<void>;
  isConnected: () => boolean;
}

/**
 * Create a Live Audio session with Gemini
 * Uses ephemeral token for secure authentication
 */
export async function createLiveSession(config: LiveSessionConfig): Promise<LiveSession> {
  const {
    token,
    listings,
    conversationHistory,
    onAudioData,
    onTextResponse,
    onError,
    onSessionEnd,
  } = config;

  if (!token) {
    throw new Error("Voice session token is required. Please try again.");
  }

  // Create AI client with ephemeral token
  // IMPORTANT: Must use v1alpha API version for ephemeral tokens
  const ai = new GoogleGenAI({
    apiKey: token,
    httpOptions: { apiVersion: 'v1alpha' }
  });

  // Build listings context for voice mode
  // Keep it concise for voice (token limits) - only include essential info
  const listingsContext = JSON.stringify(
    listings.slice(0, 10).map(l => ({ // Limit to 10 listings to stay within token limits
      id: l.id,
      title: l.title,
      category: l.category,
      price: l.price,
      location: l.location,
      description: l.description.substring(0, 80), // Shorter descriptions for voice
    }))
  );

  // System instruction for voice mode with listings data
  const systemInstruction = `You are Nui, a friendly coconut tour guide for Koh Phangan island in Thailand. Keep responses VERY short (1-2 sentences max) and conversational for voice chat.

AVAILABLE ACTIVITIES (top 10):
${listingsContext}

YOUR STYLE:
- Ultra concise responses perfect for voice
- Mention 1-2 activities max per response
- Use natural speech patterns
- No lists or bullet points
- If asked about activities, recommend from the list above
- Example: "Check out Sunrise Yoga at Secret Beach, it's $350 and starts at dawn!"

Keep it super short and natural for voice conversation.`;

  let session: any = null;
  let isConnected = false;

  // Response queue for handling messages
  const responseQueue: LiveServerMessage[] = [];

  try {
    // Connect to Gemini Live API with latest configuration
    session = await ai.live.connect({
      model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO], // Audio output
        systemInstruction,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr', // Natural, friendly voice
            },
          },
        },
      },
      callbacks: {
        onopen: () => {
          console.log('[Live API] Session connected');
          isConnected = true;
        },

        onmessage: (message: LiveServerMessage) => {
          try {
            // Add to response queue for processing
            responseQueue.push(message);

            // Audio response chunks
            if (message.serverContent?.modelTurn?.parts) {
              message.serverContent.modelTurn.parts.forEach((part: any) => {
                if (part.inlineData?.data) {
                  console.log('[Live API] Received audio chunk:', part.inlineData.data.substring(0, 50) + '...');
                  // Decode base64 PCM audio
                  const audioData = base64ToInt16Array(part.inlineData.data);
                  onAudioData(audioData);
                }

                // Text transcript (if available)
                if (part.text && onTextResponse) {
                  console.log('[Live API] Received text:', part.text);
                  onTextResponse(part.text);
                }
              });
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              console.log('[Live API] Turn complete');
            }

            // Log non-audio messages for debugging
            if (!message.serverContent?.modelTurn && !message.setupComplete) {
              console.log('[Live API] Other message:', JSON.stringify(message, null, 2));
            }
          } catch (error) {
            console.error('[Live API] Error processing message:', error);
            if (onError) onError(error as Error);
          }
        },

        onerror: (error: Event) => {
          console.error('[Live API] Session error:', error);
          console.error('[Live API] Error details:', JSON.stringify(error, null, 2));
          isConnected = false;
          if (onError) onError(new Error('Live API session error'));
        },

        onclose: (event: CloseEvent) => {
          console.log('[Live API] Session closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          isConnected = false;
          if (onSessionEnd) onSessionEnd();
        },
      },
    });

    // NOTE: Sending initial context via sendClientContent causes "invalid argument" error
    // The Live API might not support this, or requires a different format
    // For now, skip sending conversation history - the system instruction should be enough
    // if (conversationHistory.length > 0) {
    //   const recentHistory = conversationHistory.slice(-4);
    //   const turns = recentHistory.map(msg => ({
    //     role: msg.role,
    //     parts: [{ text: msg.text }],
    //   }));
    //   if (turns.length > 0) {
    //     await session.sendClientContent({ turns });
    //   }
    // }

    // Return session control object
    return {
      /**
       * Send audio data to Gemini
       */
      async send(audioData: Int16Array): Promise<void> {
        if (!session || !isConnected) {
          console.error('[Live API] Cannot send - session not connected');
          throw new Error('Session not connected');
        }

        try {
          // Convert Int16Array to base64
          const base64Audio = int16ArrayToBase64(audioData);

          // Use session.sendRealtimeInput() - this is the correct method for streaming audio
          // Based on the official audio-orb example
          await session.sendRealtimeInput({
            media: {
              data: base64Audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch (error) {
          console.error('[Live API] Error sending realtime audio:', error);
          console.error('[Live API] Error details:', error);
          throw error;
        }
      },

      /**
       * Send text message to Gemini
       */
      async sendText(text: string): Promise<void> {
        if (!session || !isConnected) {
          throw new Error('Session not connected');
        }

        try {
          // Use new sendClientContent API
          await session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
          });
        } catch (error) {
          console.error('[Live API] Error sending text:', error);
          throw error;
        }
      },

      /**
       * Close the session
       */
      async close(): Promise<void> {
        if (session) {
          try {
            await session.close();
          } catch (error) {
            console.error('[Live API] Error closing session:', error);
          }
          session = null;
          isConnected = false;
        }
      },

      /**
       * Check if session is connected
       */
      isConnected(): boolean {
        return isConnected;
      },
    };

  } catch (error) {
    console.error('[Live API] Failed to create session:', error);
    throw error;
  }
}

/**
 * Convert Int16Array to base64 string
 */
function int16ArrayToBase64(int16Array: Int16Array): string {
  // Convert Int16Array to Uint8Array (little-endian)
  const uint8Array = new Uint8Array(int16Array.buffer);

  // Convert to base64
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Int16Array
 */
function base64ToInt16Array(base64: string): Int16Array {
  // Decode base64 to binary string
  const binary = atob(base64);

  // Convert binary string to Uint8Array
  const uint8Array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8Array[i] = binary.charCodeAt(i);
  }

  // Convert Uint8Array to Int16Array (little-endian)
  return new Int16Array(uint8Array.buffer);
}
