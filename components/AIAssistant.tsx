
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Listing, TimeSlotComponentProps } from '../types';
import { createLiveSession, LiveSession } from '../services/geminiLiveService';
import { AudioRecorder, AudioPlayer, checkAudioSupport } from '../services/audioUtils';
import { Sparkles, Send, X, Mic, MicOff, Volume2 } from 'lucide-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { ChatTimeSlots } from './chat/ChatTimeSlots';
import { BookingModal } from './BookingModal';

interface AIAssistantProps {
  listings: Listing[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ listings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hey! I\'m Nui 👋 What are you looking to do on the island?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Booking modal state
  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<any | null>(null);

  // Voice mode state
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioSupported, setAudioSupported] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Voice session references
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Fetch availability for next 30 days
  const availabilityData = useQuery(api.bookings.getAvailabilityNext30Days);

  // Convex actions for Gemini (secure backend calls)
  const chatWithGemini = useAction(api.ai.gemini.chat);
  const createVoiceToken = useAction(api.ai.gemini.createVoiceSession);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Auto-focus input when chat opens or after AI responds
  useEffect(() => {
    if (isOpen && !isLoading && !isVoiceMode) {
      inputRef.current?.focus();
    }
  }, [isOpen, isLoading, isVoiceMode]);

  // Check audio support on mount
  useEffect(() => {
    const support = checkAudioSupport();
    setAudioSupported(support.supported);
    if (!support.supported) {
      console.warn('Audio not supported:', support.missingFeatures);
    }
  }, []);

  // Cleanup voice session when component unmounts
  useEffect(() => {
    return () => {
      cleanupVoiceSession();
    };
  }, []);

  const cleanupVoiceSession = async () => {
    try {
      if (audioRecorderRef.current) {
        await audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
      }
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.stop();
        audioPlayerRef.current = null;
      }
      if (liveSessionRef.current) {
        await liveSessionRef.current.close();
        liveSessionRef.current = null;
      }
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsSpeaking(false);
    } catch (error) {
      console.error('Error cleaning up voice session:', error);
    }
  };

  const toggleVoiceMode = async () => {
    if (!audioSupported) {
      setVoiceError('Voice chat not supported in this browser');
      return;
    }

    if (isVoiceMode) {
      // Turn off voice mode
      await cleanupVoiceSession();
      setIsVoiceMode(false);
      setVoiceError(null);
    } else {
      // Turn on voice mode
      try {
        setVoiceError(null);
        setIsLoading(true);

        // Get ephemeral token from backend (secure - API key never exposed)
        const { token } = await createVoiceToken({});

        // Create Live API session with ephemeral token
        const conversationHistory = messages.slice(1).map(msg => ({
          role: msg.role,
          text: msg.text,
        }));

        liveSessionRef.current = await createLiveSession({
          token,
          listings,
          conversationHistory,
          onAudioData: async (audioData) => {
            // Set speaking state
            setIsSpeaking(true);

            // Clear any existing timeout
            if (speakingTimeoutRef.current) {
              clearTimeout(speakingTimeoutRef.current);
            }

            // Play received audio
            if (audioPlayerRef.current) {
              try {
                await audioPlayerRef.current.play(audioData);
              } catch (error) {
                console.error('[Voice] Error playing audio:', error);
              }
            }

            // Reset speaking state after no audio for 1500ms
            speakingTimeoutRef.current = setTimeout(() => {
              setIsSpeaking(false);
            }, 1500);
          },
          onTextResponse: (text) => {
            // Add AI response to chat
            setMessages(prev => [...prev, { role: 'model', text }]);
          },
          onError: (error) => {
            console.error('Live session error:', error);
            setVoiceError('Voice connection error. Please try again.');
            setIsVoiceMode(false);
            cleanupVoiceSession();
          },
          onSessionEnd: () => {
            setIsVoiceMode(false);
            cleanupVoiceSession();
          },
        });

        // Initialize audio recorder
        audioRecorderRef.current = new AudioRecorder();
        await audioRecorderRef.current.initialize(async (audioData) => {
          // Stream audio in real-time while recording
          if (isRecordingRef.current && liveSessionRef.current) {
            try {
              await liveSessionRef.current.send(audioData);
            } catch (error) {
              console.error('[Voice] Error streaming audio:', error);
            }
          }
        });

        // Initialize audio player
        audioPlayerRef.current = new AudioPlayer();
        await audioPlayerRef.current.initialize();

        setIsVoiceMode(true);
        setIsLoading(false);

        // Auto-start recording
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting voice mode:', error);
        setVoiceError('Failed to start voice chat. Please try again.');
        setIsLoading(false);
        await cleanupVoiceSession();
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');

    // Add user message to history
    const updatedMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Pass conversation history for context (excluding initial greeting)
      const conversationHistory = updatedMessages.slice(1); // Skip initial greeting

      // Prepare listings data for the backend
      const listingsData = listings.map(l => ({
        id: l.id,
        title: l.title,
        location: l.location,
        category: l.category,
        price: l.price,
        duration: l.duration,
        maxCapacity: l.maxCapacity,
        operatingDays: l.operatingDays,
        description: l.description,
      }));

      // Call secure backend action
      const responseText = await chatWithGemini({
        userQuery: userMessage,
        listings: listingsData,
        conversationHistory: conversationHistory.map(m => ({ role: m.role, text: m.text })),
        availabilityData: availabilityData || {},
      });

      // Check if response is JSON with component data
      let parsedResponse: ChatMessage = { role: 'model', text: responseText };

      try {
        const trimmed = responseText.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(trimmed);
          if (parsed.component && parsed.component.type === 'time_slots') {
            parsedResponse = {
              role: 'model',
              text: parsed.message || 'Here are the available times:',
              component: parsed.component,
            };
          } else if (parsed.message) {
            parsedResponse = { role: 'model', text: parsed.message };
          }
        }
      } catch {
        // Not JSON, use as plain text
      }

      setMessages(prev => [...prev, parsedResponse]);
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset conversation when chat is closed
  const handleClose = async () => {
    setIsOpen(false);
    // Cleanup voice session
    await cleanupVoiceSession();
    setIsVoiceMode(false);
    setVoiceError(null);
    // Reset to initial greeting after a delay so user doesn't see it flash
    setTimeout(() => {
      setMessages([{ role: 'model', text: 'Hey! I\'m Nui 👋 What are you looking to do on the island?' }]);
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle slot selection from ChatTimeSlots component
  const handleSlotSelect = (slot: TimeSlotComponentProps['slots'][0], listingId: string) => {
    // Find the listing from the listings prop
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
      setBookingListing(listing);
      setSelectedSlotForBooking({
        ...slot,
        _id: slot.id as Id<"slots">,
      });
    } else {
      // If listing not found in props, add a message to let user know
      setMessages(prev => [...prev, {
        role: 'model',
        text: `Great choice! To complete your booking for this slot, please visit the listing page directly.`
      }]);
    }
  };

  // Handle booking modal close
  const handleBookingModalClose = () => {
    setBookingListing(null);
    setSelectedSlotForBooking(null);
    // Add confirmation message
    if (selectedSlotForBooking) {
      setMessages(prev => [...prev, {
        role: 'model',
        text: `Need help with anything else? 🌴`
      }]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] md:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-4 flex justify-between items-center">
            <div className="flex items-center gap-3 text-white">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Nui - Your Island Guide</span>
              {isVoiceMode && (
                <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                  <Volume2 className="w-3 h-3" />
                  Voice
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Voice Mode Toggle */}
              <button
                onClick={toggleVoiceMode}
                disabled={isLoading || !audioSupported}
                className={`p-2 rounded-full transition-all ${
                  isVoiceMode
                    ? 'bg-white/30 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                } ${!audioSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isVoiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
              >
                {isVoiceMode ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={handleClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages - Hidden in voice mode */}
          {!isVoiceMode && (
            <div className="h-[400px] overflow-y-auto p-4 bg-gray-50 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2 items-start`}
                >
                  {/* Nui's coconut avatar - only for model messages */}
                  {msg.role === 'model' && (
                    <img
                      src="/coconut.png"
                      alt="Nui"
                      className="w-14 h-14 rounded-full flex-shrink-0 mt-1"
                    />
                  )}
                  <div className="max-w-[85%] flex flex-col gap-2">
                    {/* Text message */}
                    <div
                      className={`p-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-teal-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Interactive component (if present) */}
                    {msg.component?.type === 'time_slots' && msg.component.props.type === 'time_slots' && (
                      <ChatTimeSlots
                        listingId={msg.component.props.listingId}
                        listingTitle={msg.component.props.listingTitle}
                        requestedDate={msg.component.props.requestedDate}
                        slots={msg.component.props.slots}
                        onSelectSlot={(slot) => handleSlotSelect(slot, msg.component!.props.listingId)}
                      />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start gap-2 items-start">
                  <img
                    src="/coconut.png"
                    alt="Nui"
                    className="w-14 h-14 rounded-full flex-shrink-0 mt-1"
                  />
                  <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Voice Mode - Full screen coconut */}
          {isVoiceMode && (
            <div className="h-[500px] flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 relative">
              <div className="flex flex-col items-center w-full h-full justify-center">
                {/* Large animated coconut */}
                <div className="flex-1 flex items-center justify-center w-full">
                  <img
                    src="/coconut.png"
                    alt="Nui the Coconut"
                    className={isSpeaking ? 'animate-coconut-talk' : 'transition-all duration-300'}
                    style={{
                      width: '350px',
                      height: '350px',
                      filter: isRecording ? 'drop-shadow(0 0 30px rgba(20, 184, 166, 0.5))' : 'none',
                      maxWidth: '95%',
                      maxHeight: '85%',
                      objectFit: 'contain'
                    }}
                  />
                </div>

                {/* Status text */}
                <div className="text-lg font-medium text-gray-700 text-center px-4 pb-6">
                  {isSpeaking ? 'Speaking...' : 'Listening...'}
                </div>

                {voiceError && (
                  <div className="absolute bottom-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg max-w-xs text-center">
                    {voiceError}
                  </div>
                )}
              </div>

              {/* Custom animation styles */}
              <style>{`
                @keyframes coconut-talk {
                  0%, 100% {
                    transform: scale(1) rotate(-2deg);
                  }
                  25% {
                    transform: scale(1.08) rotate(2deg);
                  }
                  50% {
                    transform: scale(1.12) rotate(-1deg);
                  }
                  75% {
                    transform: scale(1.06) rotate(1deg);
                  }
                }
                .animate-coconut-talk {
                  animation: coconut-talk 0.8s ease-in-out infinite;
                }
              `}</style>
            </div>
          )}

          {/* Input - Only show in text mode */}
          {!isVoiceMode && (
            <div className="p-3 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-teal-500/50 transition-shadow">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about ferries, parties, or secret beaches..."
                  className="flex-grow bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="text-teal-600 hover:text-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          <img
            src="/coconut.png"
            alt="Nui"
            className="w-14 h-14 rounded-full"
          />
          <span className="font-medium pr-2">Ask Nui</span>
        </button>
      )}

      {/* Booking Modal - Opens when slot is selected from chat */}
      {bookingListing && (
        <BookingModal
          listing={bookingListing}
          onClose={handleBookingModalClose}
          preSelectedSlot={selectedSlotForBooking}
        />
      )}
    </div>
  );
};