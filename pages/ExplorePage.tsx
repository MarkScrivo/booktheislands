import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Map, Loader2 } from 'lucide-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Listing, ActivityCategory, ChatMessage } from '../types';
import { ListingCard } from '../components/ListingCard';
import { ListingMap } from '../components/maps/ListingMap';
import { UnifiedSearchBar } from '../components/UnifiedSearchBar';
import { NuiResponsePanel } from '../components/NuiResponsePanel';
import { NuiFullScreen } from '../components/NuiFullScreen';
import { BookingModal } from '../components/BookingModal';
import { Id } from '../convex/_generated/dataModel';

interface ExplorePageProps {
  onBook: (listing: Listing) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ onBook }) => {
  // Convex data
  const convexListings = useQuery(api.listings.list);
  const availabilityData = useQuery(api.bookings.getAvailabilityNext30Days);
  const chatWithGemini = useAction(api.ai.gemini.chat);
  const createVoiceToken = useAction(api.ai.gemini.createVoiceSession);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Nui state
  const [nuiMode, setNuiMode] = useState<'search' | 'askNui'>('search');
  const [nuiMessages, setNuiMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hey! I\'m Nui 👋 What are you looking to do on the island?' }
  ]);
  const [isNuiLoading, setIsNuiLoading] = useState(false);
  const [nuiPanelOpen, setNuiPanelOpen] = useState(false);
  const [nuiFullScreenOpen, setNuiFullScreenOpen] = useState(false);
  const [nuiFilteredIds, setNuiFilteredIds] = useState<string[] | null>(null);
  const [startInVoiceMode, setStartInVoiceMode] = useState(false);

  // Ref for scrolling to Nui panel
  const nuiPanelRef = useRef<HTMLDivElement>(null);

  // Booking modal state
  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<any | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Scroll to Nui panel when it opens
  useEffect(() => {
    if (nuiPanelOpen && nuiPanelRef.current) {
      // Small delay to let the panel render
      setTimeout(() => {
        nuiPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [nuiPanelOpen, nuiMessages]);

  // Convert Convex listings to our Listing type
  const listings: Listing[] = (convexListings || []).map(listing => ({
    id: listing._id,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    price: listing.price,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    imageUrl: listing.imageUrl,
    category: listing.category as ActivityCategory,
    vendorName: listing.vendorName,
    vendorId: listing.vendorId || undefined,
    duration: listing.duration,
    galleryUrls: listing.galleryUrls,
    videoUrl: listing.videoUrl,
    maxCapacity: listing.maxCapacity,
    operatingDays: listing.operatingDays,
    latitude: listing.latitude,
    longitude: listing.longitude,
  }));

  const isLoading = convexListings === undefined;

  // Filter listings based on search, category, and Nui results
  const filteredListings = listings.filter(l => {
    // If Nui has filtered results, prioritize those
    if (nuiFilteredIds !== null) {
      return nuiFilteredIds.includes(l.id);
    }

    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || l.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle Nui query
  const handleAskNui = async (query: string) => {
    if (!query.trim() || isNuiLoading) return;

    // Add user message
    const updatedMessages = [...nuiMessages, { role: 'user' as const, text: query }];
    setNuiMessages(updatedMessages);
    setIsNuiLoading(true);

    // Open panel (or full screen on mobile)
    if (isMobile) {
      setNuiFullScreenOpen(true);
    } else {
      setNuiPanelOpen(true);
    }

    try {
      const conversationHistory = updatedMessages.slice(1);
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

      const responseText = await chatWithGemini({
        userQuery: query,
        listings: listingsData,
        conversationHistory: conversationHistory.map(m => ({ role: m.role, text: m.text })),
        availabilityData: availabilityData || {},
      });

      // Parse response
      let parsedResponse: ChatMessage = { role: 'model', text: responseText };
      let suggestedListingIds: string[] | null = null;

      try {
        let trimmed = responseText.trim();
        const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (codeBlockMatch) {
          trimmed = codeBlockMatch[1].trim();
        }

        const extractJson = (text: string): { json: string; startIdx: number } | null => {
          const startIdx = text.indexOf('{');
          if (startIdx === -1) return null;
          let depth = 0;
          let inString = false;
          let escape = false;
          for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (escape) { escape = false; continue; }
            if (char === '\\' && inString) { escape = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
              if (char === '{') depth++;
              else if (char === '}') {
                depth--;
                if (depth === 0) return { json: text.slice(startIdx, i + 1), startIdx };
              }
            }
          }
          return null;
        };

        let parsed = null;
        let textBeforeJson = '';

        if (trimmed.startsWith('{')) {
          try { parsed = JSON.parse(trimmed); } catch {}
        }

        if (!parsed) {
          const extracted = extractJson(trimmed);
          if (extracted) {
            try {
              const candidate = JSON.parse(extracted.json);
              if (candidate.message && (candidate.showSlots || candidate.showListingsForDate || candidate.component)) {
                parsed = candidate;
                textBeforeJson = trimmed.slice(0, extracted.startIdx).trim();
              }
            } catch {}
          }
        }

        if (parsed) {
          if (parsed.component && parsed.component.type === 'time_slots') {
            parsedResponse = {
              role: 'model',
              text: parsed.message || 'Here are the available times:',
              component: parsed.component,
            };
            // Extract listing ID for filtering
            if (parsed.component.props?.listingId) {
              suggestedListingIds = [parsed.component.props.listingId];
            }
          } else if (parsed.component && parsed.component.type === 'listings_for_date') {
            parsedResponse = {
              role: 'model',
              text: parsed.message || 'Here are the available activities:',
              component: parsed.component,
            };
            // Extract listing IDs for filtering
            if (parsed.component.props?.listings) {
              suggestedListingIds = parsed.component.props.listings.map((l: any) => l.id);
            }
          } else if (parsed.message) {
            const displayText = textBeforeJson
              ? `${textBeforeJson} ${parsed.message}`.replace(/\s+/g, ' ').trim()
              : parsed.message;
            parsedResponse = { role: 'model', text: displayText };
          }
        }
      } catch {}

      setNuiMessages(prev => [...prev, parsedResponse]);

      // Update filtered listings if Nui suggested specific ones
      if (suggestedListingIds) {
        setNuiFilteredIds(suggestedListingIds);
        // Don't auto-set category - it causes issues when user goes back to search mode
      }
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setNuiMessages(prev => [...prev, {
        role: 'model',
        text: "Sorry, I'm having trouble connecting right now. Please try again!"
      }]);
    } finally {
      setIsNuiLoading(false);
    }
  };

  // Handle slot selection from chat components
  const handleSlotSelect = (slot: any, listingId: string, listingTitle?: string) => {
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
      setBookingListing(listing);
      setSelectedSlotForBooking({
        ...slot,
        _id: slot.id || slot._id as Id<"slots">,
      });
    }
  };

  // Handle booking modal close
  const handleBookingModalClose = () => {
    setBookingListing(null);
    setSelectedSlotForBooking(null);
  };

  // Close Nui panel and clear filter
  const handleNuiClose = () => {
    setNuiPanelOpen(false);
    setNuiFullScreenOpen(false);
    setNuiFilteredIds(null);
    setStartInVoiceMode(false);
    // Keep mode as askNui if they were using it
  };

  // Open full chat from panel
  const handleOpenFullChat = () => {
    setNuiPanelOpen(false);
    setNuiFullScreenOpen(true);
  };

  // Handle voice button click - go straight to voice mode
  const handleVoiceClick = () => {
    setStartInVoiceMode(true);
    setNuiFullScreenOpen(true);
  };

  // Handle mode change
  const handleModeChange = (mode: 'search' | 'askNui') => {
    setNuiMode(mode);
    if (mode === 'search') {
      // Close Nui panel and clear filter when switching to search
      setNuiPanelOpen(false);
      setNuiFilteredIds(null);
      setSelectedCategory('All');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero / Search Section */}
      <div className="text-center mb-8 space-y-4">
        {/* Nui Greeting */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/coconut.png" alt="Nui" className="w-12 h-12 rounded-full" />
          <span className="text-lg text-gray-600 dark:text-gray-400">
            Hey! I'm <span className="font-semibold text-teal-600">Nui</span> - your island guide
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
          Book The <span className="text-teal-600 dark:text-teal-400">Islands</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Discover unforgettable island experiences, from hidden beaches to jungle adventures.
        </p>

        {/* Unified Search Bar */}
        <div className="mt-8">
          <UnifiedSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAskNui={handleAskNui}
            isNuiLoading={isNuiLoading}
            mode={nuiMode}
            onModeChange={handleModeChange}
            onVoiceClick={handleVoiceClick}
            showVoiceButton={true}
          />
        </div>

        {/* Nui Response Panel (Desktop) */}
        {nuiPanelOpen && !isMobile && (
          <div ref={nuiPanelRef}>
            <NuiResponsePanel
              messages={nuiMessages}
              isLoading={isNuiLoading}
              onSendFollowUp={handleAskNui}
              onClose={handleNuiClose}
              onOpenFullChat={handleOpenFullChat}
              onSlotSelect={handleSlotSelect}
              listings={listings}
            />
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 rounded-full transition-all ${
                viewMode === 'grid' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-3 rounded-full transition-all ${
                viewMode === 'map' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Map className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 justify-center no-scrollbar mt-4">
          {['All', ...Object.values(ActivityCategory)].map(cat => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                // Clear Nui filter when manually selecting category
                setNuiFilteredIds(null);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-gray-900 dark:bg-teal-600 text-white shadow-lg transform scale-105'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Nui Filter Indicator */}
        {nuiFilteredIds !== null && (
          <div className="flex items-center justify-center gap-2 text-sm text-teal-600 dark:text-teal-400">
            <img src="/coconut.png" alt="" className="w-5 h-5 rounded-full" />
            <span>Showing Nui's recommendations</span>
            <button
              onClick={() => setNuiFilteredIds(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredListings.map(l => (
                <ListingCard key={l.id} listing={l} onBook={onBook} />
              ))}
              {filteredListings.length === 0 && (
                <div className="col-span-full text-center py-20 text-gray-400 dark:text-gray-500">
                  {nuiFilteredIds !== null
                    ? "No activities found. Try asking Nui a different question!"
                    : "No activities found matching your criteria."
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="h-[700px] rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 relative">
              <ListingMap listings={filteredListings} onSelect={() => {}} />
            </div>
          )}
        </>
      )}

      {/* Nui Full Screen (Mobile) */}
      <NuiFullScreen
        isOpen={nuiFullScreenOpen}
        onClose={handleNuiClose}
        messages={nuiMessages}
        isLoading={isNuiLoading}
        onSendMessage={handleAskNui}
        onSlotSelect={handleSlotSelect}
        listings={listings}
        onCreateVoiceToken={createVoiceToken}
        startInVoiceMode={startInVoiceMode}
      />

      {/* Booking Modal */}
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
