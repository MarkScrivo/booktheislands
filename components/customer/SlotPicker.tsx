/**
 * SlotPicker Component
 *
 * Allows customers to view and select available time slots for booking.
 * Shows capacity, waitlist option when full, and booking deadline.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, Clock, Users, AlertCircle, Bell } from 'lucide-react';
import { Slot } from '../../types';

interface SlotPickerProps {
  listingId: Id<"listings">;
  customerId?: string;
  customerEmail?: string;
  onSelectSlot: (slot: Slot) => void;
  selectedSlotId?: string;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({
  listingId,
  customerId,
  customerEmail,
  onSelectSlot,
  selectedSlotId,
}) => {
  // State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Calculate date range (next 30 days)
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  // Queries
  const slots = useQuery(api.availability.slots.getAvailableForBooking, {
    listingId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const waitlistStatus = customerId
    ? useQuery(api.availability.waitlist.isCustomerOnWaitlist, {
        slotId: selectedSlotId as Id<"slots">,
        customerId,
      })
    : undefined;

  // Mutations
  const joinWaitlist = useMutation(api.availability.waitlist.join);

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

  // Available dates
  const availableDates = useMemo(() => {
    return Object.keys(slotsByDate).sort();
  }, [slotsByDate]);

  const handleJoinWaitlist = async (slotId: Id<"slots">) => {
    if (!customerId || !customerEmail) {
      alert('Please sign in to join the waitlist');
      return;
    }

    try {
      await joinWaitlist({
        slotId,
        customerId,
        customerEmail,
      });
      alert('Successfully joined waitlist! We\'ll notify you when a spot opens up.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to join waitlist');
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeUntilDeadline = (deadline: number) => {
    const now = Date.now();
    const diff = deadline - now;
    if (diff <= 0) return 'Booking closed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  if (slots === undefined) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading available times...</p>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No available time slots at the moment.</p>
        <p className="text-sm mt-2">Please check back later or contact the vendor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Select a Time Slot</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              viewMode === 'calendar'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Date Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-2">
              {availableDates.map((date) => {
                const dateObj = new Date(date);
                const slotsCount = slotsByDate[date].length;
                const isSelected = selectedDate === date;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {dateObj.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {slotsCount} slot{slotsCount !== 1 ? 's' : ''} available
                        </p>
                      </div>
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {selectedDate ? 'Available Times' : 'Select a date first'}
            </label>
            {selectedDate ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {slotsByDate[selectedDate].map((slot) => {
                  const isSelected = selectedSlotId === slot._id;
                  const isFull = slot.available === 0;
                  const deadline = getTimeUntilDeadline(slot.bookingDeadline);

                  return (
                    <button
                      key={slot._id}
                      onClick={() => !isFull && onSelectSlot(slot as Slot)}
                      disabled={isFull}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-teal-50 border-teal-600'
                          : isFull
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-gray-600" />
                            <span className="font-medium text-gray-900">
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {slot.available} / {slot.capacity} spots
                            </span>
                            {deadline !== 'Booking closed' && (
                              <span className="text-xs text-amber-600">{deadline}</span>
                            )}
                          </div>
                          {isFull && customerId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinWaitlist(slot._id);
                              }}
                              className="mt-2 flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                            >
                              <Bell className="w-3 h-3" />
                              Join Waitlist
                            </button>
                          )}
                        </div>
                        {isFull && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            FULL
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-gray-400">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-2" />
                  <p>Select a date to see available times</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {availableDates.map((date) => {
            const dateObj = new Date(date);
            const dateSlots = slotsByDate[date];

            return (
              <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">
                    {dateObj.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h4>
                </div>
                <div className="divide-y divide-gray-200">
                  {dateSlots.map((slot) => {
                    const isSelected = selectedSlotId === slot._id;
                    const isFull = slot.available === 0;
                    const deadline = getTimeUntilDeadline(slot.bookingDeadline);

                    return (
                      <button
                        key={slot._id}
                        onClick={() => !isFull && onSelectSlot(slot as Slot)}
                        disabled={isFull}
                        className={`w-full text-left p-4 transition-colors ${
                          isSelected
                            ? 'bg-teal-50'
                            : isFull
                            ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                            : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-5 h-5 text-gray-600" />
                              <span className="font-medium text-gray-900">
                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>
                                {slot.available} / {slot.capacity} available
                              </span>
                            </div>
                            {deadline !== 'Booking closed' && (
                              <span className="text-xs text-amber-600">{deadline}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isFull ? (
                              <>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                  FULL
                                </span>
                                {customerId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJoinWaitlist(slot._id);
                                    }}
                                    className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 px-2 py-1 border border-teal-600 rounded"
                                  >
                                    <Bell className="w-3 h-3" />
                                    Waitlist
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-teal-600 font-medium">
                                Select →
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Booking Information</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Bookings close a few hours before the activity starts</li>
              <li>Join the waitlist if your preferred time is full</li>
              <li>You'll receive a confirmation email after booking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Waitlist Status */}
      {waitlistStatus?.onWaitlist && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-2">
            <Bell className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">You're on the waitlist</p>
              <p className="text-amber-700 mt-1">
                Position: {waitlistStatus.position} of {waitlistStatus.total}
              </p>
              <p className="text-amber-700">
                We'll notify you if a spot opens up!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
