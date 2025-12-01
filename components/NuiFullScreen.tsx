import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, Volume2 } from 'lucide-react';
import { ChatMessage, TimeSlotComponentProps, ListingsForDateComponentProps, Listing } from '../types';
import { ChatTimeSlots } from './chat/ChatTimeSlots';
import { ChatListingsForDate } from './chat/ChatListingsForDate';
import { Id } from '../convex/_generated/dataModel';
import { createLiveSession, LiveSession } from '../services/geminiLiveService';
import { AudioRecorder, AudioPlayer, checkAudioSupport } from '../services/audioUtils';

interface NuiFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onSlotSelect: (slot: any, listingId: string, listingTitle?: string) => void;
  listings: Listing[];
  // Voice mode props
  onCreateVoiceToken: () => Promise<{ token: string }>;
  startInVoiceMode?: boolean;
}

export const NuiFullScreen: React.FC<NuiFullScreenProps> = ({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onSlotSelect,
  listings,
  onCreateVoiceToken,
  startInVoiceMode = false,
}) => {
  const [input, setInput] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioSupported, setAudioSupported] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice session references
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Check audio support on mount
  useEffect(() => {
    const support = checkAudioSupport();
    setAudioSupported(support.supported);
  }, []);

  // Auto-start voice mode when requested
  useEffect(() => {
    if (isOpen && startInVoiceMode && audioSupported && !isVoiceMode) {
      // Small delay to let the component fully render
      const timer = setTimeout(() => {
        toggleVoiceMode();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startInVoiceMode, audioSupported]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      cleanupVoiceSession();
      setIsVoiceMode(false);
    }
    return () => {
      cleanupVoiceSession();
    };
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not in voice mode
  useEffect(() => {
    if (isOpen && !isVoiceMode && !isLoading) {
      inputRef.current?.focus();
    }
  }, [isOpen, isVoiceMode, isLoading]);

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
      await cleanupVoiceSession();
      setIsVoiceMode(false);
      setVoiceError(null);
    } else {
      try {
        setVoiceError(null);

        const { token } = await onCreateVoiceToken();

        const conversationHistory = messages.slice(1).map(msg => ({
          role: msg.role,
          text: msg.text,
        }));

        liveSessionRef.current = await createLiveSession({
          token,
          listings,
          conversationHistory,
          onAudioData: async (audioData) => {
            setIsSpeaking(true);
            if (speakingTimeoutRef.current) {
              clearTimeout(speakingTimeoutRef.current);
            }
            if (audioPlayerRef.current) {
              try {
                await audioPlayerRef.current.play(audioData);
              } catch (error) {
                console.error('[Voice] Error playing audio:', error);
              }
            }
            speakingTimeoutRef.current = setTimeout(() => {
              setIsSpeaking(false);
            }, 1500);
          },
          onTextResponse: (text) => {
            // Voice responses are handled by parent via onSendMessage callback
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

        audioRecorderRef.current = new AudioRecorder();
        await audioRecorderRef.current.initialize(async (audioData) => {
          if (isRecordingRef.current && liveSessionRef.current) {
            try {
              await liveSessionRef.current.send(audioData);
            } catch (error) {
              console.error('[Voice] Error streaming audio:', error);
            }
          }
        });

        audioPlayerRef.current = new AudioPlayer();
        await audioPlayerRef.current.initialize();

        setIsVoiceMode(true);
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting voice mode:', error);
        setVoiceError('Failed to start voice chat. Please try again.');
        await cleanupVoiceSession();
      }
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 safe-area-inset-top">
        <div className="flex items-center gap-3 text-white">
          <img src="/coconut.png" alt="Nui" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-medium">Nui</div>
            <div className="text-xs text-white/70">Your island guide</div>
          </div>
          {isVoiceMode && (
            <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full ml-2">
              <Volume2 className="w-3 h-3" />
              Voice
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoiceMode}
            disabled={!audioSupported}
            className={`p-2 rounded-full transition-all ${
              isVoiceMode
                ? 'bg-white/30 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            } ${!audioSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isVoiceMode ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Voice Mode View */}
      {isVoiceMode ? (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 relative">
          <div className="flex flex-col items-center w-full h-full justify-center">
            <div className="flex-1 flex items-center justify-center w-full">
              <img
                src="/coconut.png"
                alt="Nui the Coconut"
                className={isSpeaking ? 'animate-coconut-talk' : 'transition-all duration-300'}
                style={{
                  width: '280px',
                  height: '280px',
                  filter: isRecording ? 'drop-shadow(0 0 30px rgba(20, 184, 166, 0.5))' : 'none',
                  maxWidth: '80%',
                  maxHeight: '60%',
                  objectFit: 'contain'
                }}
              />
            </div>
            <div className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center px-4 pb-8">
              {isSpeaking ? 'Speaking...' : 'Listening...'}
            </div>
            {voiceError && (
              <div className="absolute bottom-20 text-sm text-red-600 bg-red-50 p-3 rounded-lg max-w-xs text-center mx-4">
                {voiceError}
              </div>
            )}
          </div>
          <style>{`
            @keyframes coconut-talk {
              0%, 100% { transform: scale(1) rotate(-2deg); }
              25% { transform: scale(1.08) rotate(2deg); }
              50% { transform: scale(1.12) rotate(-1deg); }
              75% { transform: scale(1.06) rotate(1deg); }
            }
            .animate-coconut-talk {
              animation: coconut-talk 0.8s ease-in-out infinite;
            }
          `}</style>
        </div>
      ) : (
        <>
          {/* Text Chat View */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2 items-start`}
              >
                {msg.role === 'model' && (
                  <img
                    src="/coconut.png"
                    alt="Nui"
                    className="w-10 h-10 rounded-full flex-shrink-0 mt-1"
                  />
                )}
                <div className="max-w-[85%] flex flex-col gap-2">
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-sm rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.component?.type === 'time_slots' && msg.component.props.type === 'time_slots' && (
                    <ChatTimeSlots
                      listingId={msg.component.props.listingId}
                      listingTitle={msg.component.props.listingTitle}
                      requestedDate={msg.component.props.requestedDate}
                      slots={msg.component.props.slots}
                      onSelectSlot={(slot) => onSlotSelect(slot, msg.component!.props.listingId)}
                    />
                  )}

                  {msg.component?.type === 'listings_for_date' && msg.component.props.type === 'listings_for_date' && (
                    <ChatListingsForDate
                      date={(msg.component.props as ListingsForDateComponentProps).date}
                      dateDisplay={(msg.component.props as ListingsForDateComponentProps).dateDisplay}
                      category={(msg.component.props as ListingsForDateComponentProps).category}
                      listings={(msg.component.props as ListingsForDateComponentProps).listings}
                      onSelectSlot={(listingId, listingTitle, slot) => {
                        onSlotSelect(
                          {
                            ...slot,
                            _id: slot.id as Id<"slots">,
                            date: (msg.component!.props as ListingsForDateComponentProps).date,
                          },
                          listingId,
                          listingTitle
                        );
                      }}
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
                  className="w-10 h-10 rounded-full flex-shrink-0 mt-1"
                />
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl rounded-bl-none shadow-sm">
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

          {/* Input */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/50 transition-shadow">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Nui anything..."
                  className="flex-grow bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400"
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
              <button
                onClick={toggleVoiceMode}
                disabled={!audioSupported}
                className={`p-3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg ${
                  !audioSupported ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
                } transition-all`}
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
