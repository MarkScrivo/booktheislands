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

  // Get slot availability color
  const getSlotStyle = (available: number) => {
    if (available === 0) {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed';
    }
    if (available <= 2) {
      return 'bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer border-amber-200';
    }
    return 'bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer border-green-200';
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <Calendar className="w-4 h-4" />
          <h4 className="font-medium text-sm">{dateDisplay}</h4>
        </div>
        {category && (
          <p className="text-teal-100 text-xs mt-0.5">{category} activities</p>
        )}
        <p className="text-teal-100 text-xs mt-0.5">
          {listings.length} option{listings.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Listings */}
      <div className="divide-y divide-gray-100">
        {listings.map((listing) => {
          const isExpanded = expandedListing === listing.id;
          const availableSlots = listing.slots.filter(s => s.available > 0);
          const totalSpots = listing.slots.reduce((sum, s) => sum + s.available, 0);

          return (
            <div key={listing.id} className="bg-white">
              {/* Listing Header - Clickable */}
              <button
                onClick={() => toggleExpand(listing.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Thumbnail */}
                {listing.imageUrl && (
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-gray-900 text-sm truncate">
                    {listing.title}
                  </h5>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {listing.price}
                    </span>
                    {listing.duration && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {listing.duration}
                      </span>
                    )}
                    <span className={`text-xs flex items-center gap-1 ${totalSpots > 0 ? 'text-green-600' : 'text-gray-400'}`}>
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
                <div className="px-3 pb-3 bg-gray-50">
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {listing.slots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => slot.available > 0 && onSelectSlot(listing.id, listing.title, slot)}
                          disabled={slot.available === 0}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${getSlotStyle(slot.available)}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="font-medium text-sm">{slot.startTime}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3 flex-shrink-0 opacity-60" />
                              <span className="text-xs">
                                {slot.available > 0 ? `${slot.available} spots` : 'Full'}
                              </span>
                            </div>
                          </div>
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
