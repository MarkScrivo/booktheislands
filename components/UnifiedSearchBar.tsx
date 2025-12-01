import React, { useState, useRef, useEffect } from 'react';
import { Search, Mic, Sparkles } from 'lucide-react';

interface UnifiedSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAskNui: (query: string) => void;
  isNuiLoading?: boolean;
  mode: 'search' | 'askNui';
  onModeChange: (mode: 'search' | 'askNui') => void;
  onVoiceClick?: () => void;
  showVoiceButton?: boolean;
}

// Patterns that indicate a conversational query
const CONVERSATIONAL_PATTERNS = [
  /^what\b/i,
  /^when\b/i,
  /^where\b/i,
  /^how\b/i,
  /^which\b/i,
  /^why\b/i,
  /^can\s+(you|i)\b/i,
  /^show\s+me\b/i,
  /^help\s+me\b/i,
  /^find\s+me\b/i,
  /^looking\s+for\b/i,
  /^recommend\b/i,
  /^suggest\b/i,
  /^tell\s+me\b/i,
  /^is\s+there\b/i,
  /^are\s+there\b/i,
  /\?$/,  // Ends with question mark
];

const isConversationalQuery = (query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  return CONVERSATIONAL_PATTERNS.some(pattern => pattern.test(trimmed));
};

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onAskNui,
  isNuiLoading = false,
  mode,
  onModeChange,
  onVoiceClick,
  showVoiceButton = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Sync local query with external searchQuery when in search mode
  useEffect(() => {
    if (mode === 'search') {
      setLocalQuery(searchQuery);
    }
  }, [searchQuery, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);

    // In search mode, update immediately for live filtering
    if (mode === 'search') {
      onSearchChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const query = localQuery.trim();
      if (!query) return;

      if (mode === 'askNui') {
        // Already in Nui mode, send to Nui
        onAskNui(query);
      } else {
        // In search mode - check if query is conversational
        if (isConversationalQuery(query)) {
          // Smart switch: auto-switch to Nui mode and send
          onModeChange('askNui');
          onAskNui(query);
        }
        // Otherwise, just stay in search mode (live filtering is already happening)
      }
    }
  };

  const handleModeToggle = (newMode: 'search' | 'askNui') => {
    onModeChange(newMode);

    // If switching to search mode, sync the query
    if (newMode === 'search') {
      onSearchChange(localQuery);
    }

    // Focus input after mode change
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Main Search Input */}
      <div className="relative">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
          mode === 'askNui' ? 'text-teal-500' : 'text-gray-400'
        }`}>
          {mode === 'askNui' ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'askNui'
              ? 'Ask Nui anything... "what yoga classes are there Monday?"'
              : 'Search for "kayaking" or "thong sala"...'
          }
          className={`w-full pl-12 pr-14 py-3.5 rounded-full border shadow-sm focus:ring-2 outline-none transition-all ${
            mode === 'askNui'
              ? 'border-teal-300 bg-teal-50/50 dark:bg-teal-900/20 focus:ring-teal-500 dark:border-teal-600'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-teal-500'
          } text-gray-900 dark:text-gray-100`}
          disabled={isNuiLoading}
        />

        {/* Voice button inside input (desktop) */}
        {showVoiceButton && (
          <button
            onClick={onVoiceClick}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors hidden md:block"
            title="Voice chat with Nui"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode Toggle + Mobile Voice Button */}
      <div className="flex items-center justify-center gap-3">
        {/* Mode Toggle */}
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => handleModeToggle('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'search'
                ? 'bg-gray-900 dark:bg-teal-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={() => handleModeToggle('askNui')}
            disabled={isNuiLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'askNui'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            } ${isNuiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <img src="/coconut.png" alt="" className="w-4 h-4 rounded-full" />
            Ask Nui
          </button>
        </div>

        {/* Mobile Voice Button */}
        {showVoiceButton && (
          <button
            onClick={onVoiceClick}
            className="md:hidden flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm font-medium"
          >
            <Mic className="w-4 h-4" />
            Voice
          </button>
        )}
      </div>
    </div>
  );
};
