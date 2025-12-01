import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { ChatMessage, TimeSlotComponentProps, ListingsForDateComponentProps, Listing } from '../types';
import { ChatTimeSlots } from './chat/ChatTimeSlots';
import { ChatListingsForDate } from './chat/ChatListingsForDate';
import { Id } from '../convex/_generated/dataModel';

interface NuiResponsePanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendFollowUp: (query: string) => void;
  onClose: () => void;
  onOpenFullChat: () => void;
  onSlotSelect: (slot: any, listingId: string, listingTitle?: string) => void;
  listings: Listing[];
}

export const NuiResponsePanel: React.FC<NuiResponsePanelProps> = ({
  messages,
  isLoading,
  onSendFollowUp,
  onClose,
  onOpenFullChat,
  onSlotSelect,
  listings,
}) => {
  const [followUpInput, setFollowUpInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when loading completes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSend = () => {
    if (!followUpInput.trim() || isLoading) return;
    onSendFollowUp(followUpInput);
    setFollowUpInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get only the conversation after initial greeting (for display)
  // Show last few exchanges to keep panel compact
  const displayMessages = messages.slice(-4); // Show last 4 messages max

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 animate-in slide-in-from-top-2 fade-in duration-300">
      {/* Header with personality */}
      <div className="flex items-center justify-between px-3 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 rounded-t-xl border border-gray-200 dark:border-gray-700 border-b-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src="/coconut.png" alt="Nui" className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-gray-700 shadow-sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
          </div>
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">Nui</span>
            <p className="text-xs text-teal-600 dark:text-teal-400">Your island guide</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenFullChat}
            className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Full chat
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages area with subtle background */}
      <div className="max-h-[450px] overflow-y-auto py-5 px-4 space-y-5 bg-white dark:bg-gray-900 border-x border-gray-200 dark:border-gray-700">
          {displayMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3 items-start`}
            >
              {/* Nui avatar for model messages */}
              {msg.role === 'model' && (
                <img
                  src="/coconut.png"
                  alt="Nui"
                  className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-teal-100 dark:ring-gray-700"
                />
              )}

              <div className="max-w-[85%] flex flex-col gap-3">
                {/* Text with improved typography */}
                <div
                  className={`leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white px-5 py-3 rounded-2xl rounded-br-sm text-base shadow-sm'
                      : 'text-gray-800 dark:text-gray-100 text-base'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Interactive components */}
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

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start gap-3 items-start">
              <img
                src="/coconut.png"
                alt="Nui"
                className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-teal-100 dark:ring-gray-700"
              />
              <div className="flex items-center gap-1.5 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-2xl">
                <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

      {/* Follow-up Input - polished styling */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-xl">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={followUpInput}
            onChange={(e) => setFollowUpInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nui a follow-up question..."
            className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-5 py-3 text-base text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-300 dark:focus:border-teal-500 transition-all shadow-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!followUpInput.trim() || isLoading}
            className="p-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
