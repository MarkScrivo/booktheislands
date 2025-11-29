/**
 * CustomerBookingCalendar Component
 *
 * Calendar view for customers to see and select available time slots for booking.
 * Shows visual availability with green colors and capacity indicators.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react';
import { DaySessionsModal } from './DaySessionsModal';

interface CustomerBookingCalendarProps {
  listingId: Id<"listings">;
  onSelectSlot: (slot: any) => void;
  selectedSlotId?: Id<"slots"> | null;
}

export const CustomerBookingCalendar: React.FC<CustomerBookingCalendarProps> = ({
  listingId,
  onSelectSlot,
  selectedSlotId,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; slots: any[] } | null>(null);

  // Calculate date range (current month + next 2 months for better availability view)
  const startDate = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return date.toISOString().split('T')[0];
  }, [currentDate]);

  const endDate = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return date.toISOString().split('T')[0];
  }, [currentDate]);

  // Query available slots using the public query
  const slots = useQuery(api.availability.slots.getAvailableForBooking, {
    listingId,
    startDate,
    endDate,
  });

  // Calendar generation
  const calendar = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() || 7; // Convert Sunday from 0 to 7

    const weeks: Array<Array<Date | null>> = [];
    let currentWeek: Array<Date | null> = [];

    // Fill in empty days at start (Monday = 1)
    for (let i = 1; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Fill in days of month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(new Date(year, month, day));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill in remaining empty days
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [currentDate]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    if (!slots) return {};
    const grouped: Record<string, typeof slots> = {};
    slots.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  }, [slots]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getSlotColor = (slot: any) => {
    if (selectedSlotId && slot._id === selectedSlotId) {
      return 'bg-teal-500 text-white border-teal-600 ring-2 ring-teal-300';
    }

    // Different shades of green based on availability
    if (slot.booked === 0) {
      return 'bg-green-200 text-green-900 border-green-300 hover:bg-green-300';
    } else if (slot.available > 0) {
      return 'bg-green-300 text-green-900 border-green-400 hover:bg-green-400';
    } else {
      return 'bg-gray-300 text-gray-600 border-gray-400 cursor-not-allowed';
    }
  };

  const handleOpenDayModal = (day: Date, slots: any[]) => {
    setSelectedDay({ date: day, slots });
    setModalOpen(true);
  };

  const handleCloseDayModal = () => {
    setModalOpen(false);
    setSelectedDay(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Select a Time Slot
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-medium text-gray-900 dark:text-white min-w-[150px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-200 rounded border border-green-300"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-300 rounded border border-green-400"></div>
          <span>Limited spots</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-300 rounded border border-gray-400"></div>
          <span>Fully booked</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {calendar.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
              {week.map((day, dayIdx) => {
                const dateString = day?.toISOString().split('T')[0];
                const daySlots = dateString ? slotsByDate[dateString] || [] : [];
                const isToday = day && day.toDateString() === new Date().toDateString();
                const isPast = day && day < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[100px] p-2 ${
                      day ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
                    } ${isToday ? 'bg-teal-50 dark:bg-teal-900/20' : ''} ${
                      isPast ? 'opacity-50' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <div
                          className={`text-sm font-medium mb-2 ${
                            isToday ? 'text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {day.getDate()}
                        </div>

                        <div className="space-y-1">
                          {daySlots.length === 0 && !isPast && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                              No times
                            </div>
                          )}
                          {daySlots.length > 3 ? (
                            // Show summary button for days with more than 3 sessions
                            <button
                              onClick={() => day && handleOpenDayModal(day, daySlots)}
                              className="w-full p-2.5 rounded-lg border-2 border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span className="font-bold text-xs">
                                  {daySlots.length} sessions
                                </span>
                              </div>
                              <div className="text-[10px] mt-1 opacity-80">
                                Click to view
                              </div>
                            </button>
                          ) : (
                            // Show individual slots for 3 or fewer sessions
                            daySlots.map((slot) => (
                              <button
                                key={slot._id}
                                onClick={() => slot.available > 0 && onSelectSlot(slot)}
                                disabled={slot.available === 0}
                                className={`w-full text-xs p-1.5 rounded border ${getSlotColor(
                                  slot
                                )} transition-all ${
                                  slot.available > 0 ? 'cursor-pointer' : ''
                                }`}
                              >
                                <div className="font-medium">{slot.startTime}</div>
                                <div className="flex items-center gap-1 text-[10px] justify-center">
                                  <Users className="w-3 h-3" />
                                  {slot.booked}/{slot.capacity}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {slots && slots.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No available time slots for this month.</p>
          <p className="text-sm mt-2">Try selecting a different month.</p>
        </div>
      )}

      {/* Day Sessions Modal */}
      {modalOpen && selectedDay && (
        <DaySessionsModal
          date={selectedDay.date}
          slots={selectedDay.slots}
          onSelectSlot={onSelectSlot}
          onClose={handleCloseDayModal}
          selectedSlotId={selectedSlotId}
        />
      )}
    </div>
  );
};
