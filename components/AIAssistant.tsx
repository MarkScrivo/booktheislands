
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Listing } from '../types';
import { Sparkles, Send, X } from 'lucide-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';

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

  // Fetch availability for next 30 days
  const availabilityData = useQuery(api.bookings.getAvailabilityNext30Days);

  // Convex action for Gemini chat (secure backend call)
  const chatWithGemini = useAction(api.ai.gemini.chat);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Auto-focus input when chat opens or after AI responds
  useEffect(() => {
    if (isOpen && !isLoading) {
      inputRef.current?.focus();
    }
  }, [isOpen, isLoading]);

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

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset conversation when chat is closed
  const handleClose = () => {
    setIsOpen(false);
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
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
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
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-none'
                  }`}
                >
                  {msg.text}
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

          {/* Input */}
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
    </div>
  );
};