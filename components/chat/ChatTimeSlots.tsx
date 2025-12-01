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

  // Get slot color based on availability - cleaner styling
  const getSlotStyle = (slot: typeof slots[0]) => {
    if (slot.available === 0) {
      return 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700';
    }
    if (slot.available <= 2) {
      return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer border border-amber-200 dark:border-amber-700';
    }
    return 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 cursor-pointer border border-teal-200 dark:border-teal-700';
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
    <div className="space-y-3">
      {/* Header - inline style */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{listingTitle}</h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">Select a time</span>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-1">
        {/* Left Arrow */}
        <button
          onClick={() => setDateStartIndex(Math.max(0, dateStartIndex - 7))}
          disabled={!canScrollLeft}
          className={`p-1.5 rounded-full transition-colors ${
            canScrollLeft
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Date Buttons */}
        <div className="flex-1 flex gap-1.5 justify-center overflow-hidden">
          {visibleDates.map((date) => {
            const { dayName, dayNum } = formatDate(date);
            const isSelected = date === selectedDate;
            const hasSlots = slotsByDate[date]?.some((s) => s.available > 0);

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center px-2.5 py-2 rounded-lg transition-all min-w-[48px] ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-sm'
                    : hasSlots
                    ? 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'
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
          className={`p-1.5 rounded-full transition-colors ${
            canScrollRight
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Time Slots */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatFullDate(selectedDate)}</p>
        <div className="flex flex-wrap gap-2">
          {slotsByDate[selectedDate]?.map((slot) => (
            <button
              key={slot.id}
              onClick={() => slot.available > 0 && onSelectSlot(slot)}
              disabled={slot.available === 0}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${getSlotStyle(slot)}`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">{slot.startTime}</span>
              <span className="text-xs opacity-75">
                {slot.available > 0 ? `${slot.available} left` : 'Full'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
