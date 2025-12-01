/**
 * ChatListingsForDate Component
 *
 * Displays multiple listings available on a specific date.
 * Used when user asks "what yoga classes are available Monday" type questions.
 * Shows a header with the date and expandable listing cards with time slots.
 */

import React, { useState } from 'react';
import { Calendar, Clock, Users, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { ListingsForDateComponentProps } from '../../types';

interface ChatListingsForDateProps extends Omit<ListingsForDateComponentProps, 'type'> {
  onSelectSlot: (listingId: string, listingTitle: string, slot: ListingsForDateComponentProps['listings'][0]['slots'][0]) => void;
}

export const ChatListingsForDate: React.FC<ChatListingsForDateProps> = ({
  date,
  dateDisplay,
  category,
  listings,
  onSelectSlot,
}) => {
  const [expandedListing, setExpandedListing] = useState<string | null>(
    listings.length === 1 ? listings[0].id : null
  );

  const toggleExpand = (listingId: string) => {
    setExpandedListing(expandedListing === listingId ? null : listingId);
  };

  // Get slot availability color - cleaner styling
  const getSlotStyle = (available: number) => {
    if (available === 0) {
      return 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700';
    }
    if (available <= 2) {
      return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer border border-amber-200 dark:border-amber-700';
    }
    return 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 cursor-pointer border border-teal-200 dark:border-teal-700';
  };

  if (listings.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-center">
        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          No {category ? `${category} ` : ''}activities available on this date
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header - inline badge style */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-full text-sm font-medium">
          <Calendar className="w-4 h-4" />
          {dateDisplay}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {listings.length} option{listings.length !== 1 ? 's' : ''} available
          {category && ` • ${category}`}
        </span>
      </div>

      {/* Listings - card style */}
      <div className="space-y-2">
        {listings.map((listing) => {
          const isExpanded = expandedListing === listing.id;
          const availableSlots = listing.slots.filter(s => s.available > 0);
          const totalSpots = listing.slots.reduce((sum, s) => sum + s.available, 0);

          return (
            <div key={listing.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Listing Header - Clickable */}
              <button
                onClick={() => toggleExpand(listing.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                {/* Thumbnail */}
                {listing.imageUrl && (
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                    {listing.title}
                  </h5>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {listing.price}
                    </span>
                    {listing.duration && (
                      <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {listing.duration}
                      </span>
                    )}
                    <span className={`text-xs flex items-center gap-1 ${totalSpots > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      <Users className="w-3 h-3" />
                      {totalSpots > 0 ? `${totalSpots} spots` : 'Full'}
                    </span>
                  </div>
                </div>

                {/* Expand Icon */}
                <div className="text-gray-400">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {/* Expanded Time Slots */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                  {availableSlots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {listing.slots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => slot.available > 0 && onSelectSlot(listing.id, listing.title, slot)}
                          disabled={slot.available === 0}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${getSlotStyle(slot.available)}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-medium">{slot.startTime}</span>
                          <span className="text-xs opacity-75">
                            {slot.available > 0 ? `${slot.available} left` : 'Full'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">
                      All time slots are full
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
