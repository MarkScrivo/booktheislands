/**
 * ChatTimeSlots Component
 *
 * Compact inline time slot picker for chat messages.
 * Displays a horizontal date picker (next 7 days) and time slots for the selected date.
 */

import React, { useState, useMemo } from 'react';
import { Clock, Users, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { TimeSlotComponentProps } from '../../types';

interface ChatTimeSlotsProps extends Omit<TimeSlotComponentProps, 'type'> {
  onSelectSlot: (slot: TimeSlotComponentProps['slots'][0]) => void;
}

export const ChatTimeSlots: React.FC<ChatTimeSlotsProps> = ({
  listingId,
  listingTitle,
  requestedDate,
  slots,
  onSelectSlot,
}) => {
  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, typeof slots> = {};
    slots.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    // Sort slots within each date by start time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [slots]);

  // Get sorted unique dates
  const dates = useMemo(() => {
    return Object.keys(slotsByDate).sort();
  }, [slotsByDate]);

  // Determine initial selected date and scroll position
  const { initialDate, initialScrollIndex } = useMemo(() => {
    // If requestedDate is provided and exists in our dates, use it
    if (requestedDate && dates.includes(requestedDate)) {
      const index = dates.indexOf(requestedDate);
      // Position the requested date roughly in the middle of visible dates
      const scrollIndex = Math.max(0, index - 2);
      return { initialDate: requestedDate, initialScrollIndex: scrollIndex };
    }
    // Otherwise default to first available date
    return { initialDate: dates[0] || '', initialScrollIndex: 0 };
  }, [dates, requestedDate]);

  // Track selected date
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [dateStartIndex, setDateStartIndex] = useState(initialScrollIndex);

  // Show 5 dates at a time on mobile, 7 on desktop
  const visibleDates = dates.slice(dateStartIndex, dateStartIndex + 7);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    return { dayName, dayNum };
  };

  // Format date for header
  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get slot color based on availability
  const getSlotStyle = (slot: typeof slots[0]) => {
    if (slot.available === 0) {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed';
    }
    if (slot.available <= 2) {
      return 'bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer border-amber-200';
    }
    return 'bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer border-green-200';
  };

  const canScrollLeft = dateStartIndex > 0;
  const canScrollRight = dateStartIndex + 7 < dates.length;

  if (dates.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-center">
        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No available slots found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3">
        <h4 className="font-medium text-white text-sm">{listingTitle}</h4>
        <p className="text-teal-100 text-xs mt-0.5">Select a time to book</p>
      </div>

      {/* Date Picker */}
      <div className="border-b border-gray-100 p-3">
        <div className="flex items-center gap-1">
          {/* Left Arrow */}
          <button
            onClick={() => setDateStartIndex(Math.max(0, dateStartIndex - 7))}
            disabled={!canScrollLeft}
            className={`p-1 rounded-full transition-colors ${
              canScrollLeft
                ? 'hover:bg-gray-100 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Date Buttons */}
          <div className="flex-1 flex gap-1 justify-center overflow-hidden">
            {visibleDates.map((date) => {
              const { dayName, dayNum } = formatDate(date);
              const isSelected = date === selectedDate;
              const hasSlots = slotsByDate[date]?.some((s) => s.available > 0);

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all min-w-[44px] ${
                    isSelected
                      ? 'bg-teal-500 text-white'
                      : hasSlots
                      ? 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase">{dayName}</span>
                  <span className="text-sm font-bold">{dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => setDateStartIndex(Math.min(dates.length - 7, dateStartIndex + 7))}
            disabled={!canScrollRight}
            className={`p-1 rounded-full transition-colors ${
              canScrollRight
                ? 'hover:bg-gray-100 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Time Slots */}
      <div className="p-3">
        <p className="text-xs text-gray-500 mb-2">{formatFullDate(selectedDate)}</p>
        <div className="grid grid-cols-2 gap-2">
          {slotsByDate[selectedDate]?.map((slot) => (
            <button
              key={slot.id}
              onClick={() => slot.available > 0 && onSelectSlot(slot)}
              disabled={slot.available === 0}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${getSlotStyle(
                slot
              )}`}
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
              <div className="text-[10px] font-medium bg-white/50 px-1.5 py-0.5 rounded">
                {slot.booked}/{slot.capacity}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
