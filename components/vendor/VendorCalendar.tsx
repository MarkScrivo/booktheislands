/**
 * VendorCalendar Component
 *
 * Calendar view for vendors to see their slots, bookings, and manage availability.
 * Allows blocking/unblocking slots and canceling with automatic refunds.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ChevronLeft, ChevronRight, Calendar, Users, X, AlertCircle, Ban, CheckCircle } from 'lucide-react';

interface VendorCalendarProps {
  listingId: Id<"listings">;
}

interface CancelSlotModalProps {
  slotId: Id<"slots">;
  date: string;
  time: string;
  bookedCount: number;
  onClose: () => void;
  onConfirm: (reason: string, message?: string) => void;
}

const CancelSlotModal: React.FC<CancelSlotModalProps> = ({
  slotId,
  date,
  time,
  bookedCount,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState<'weather' | 'emergency' | 'personal' | 'other'>('other');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason, message || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Cancel Slot</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">
                This will cancel {bookedCount} booking{bookedCount !== 1 ? 's' : ''}
              </p>
              <p>
                Customers will be automatically refunded and notified via email about the
                cancellation.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          <p>
            <strong>Date:</strong> {new Date(date).toLocaleDateString()}
          </p>
          <p>
            <strong>Time:</strong> {time}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cancellation Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="weather">Weather Conditions</option>
              <option value="emergency">Emergency</option>
              <option value="personal">Personal Reasons</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Customers (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide additional details about the cancellation..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const VendorCalendar: React.FC<VendorCalendarProps> = ({ listingId }) => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Id<"slots"> | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSlot, setCancellingSlot] = useState<any>(null);

  // Calculate date range (current month)
  const startDate = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return date.toISOString().split('T')[0];
  }, [currentDate]);

  const endDate = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return date.toISOString().split('T')[0];
  }, [currentDate]);

  // Queries
  const slots = useQuery(api.availability.slots.getByListing, {
    listingId,
    startDate,
    endDate,
  });

  // Mutations
  const blockSlot = useMutation(api.availability.slots.block);
  const unblockSlot = useMutation(api.availability.slots.unblock);
  const cancelSlot = useMutation(api.availability.slots.cancel);

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

    // Fill in empty days at start
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

  const handleBlockSlot = async (slotId: Id<"slots">) => {
    try {
      await blockSlot({ slotId });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to block slot');
    }
  };

  const handleUnblockSlot = async (slotId: Id<"slots">) => {
    try {
      await unblockSlot({ slotId });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unblock slot');
    }
  };

  const handleCancelClick = (slot: any) => {
    setCancellingSlot(slot);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async (reason: string, message?: string) => {
    if (!cancellingSlot) return;

    try {
      await cancelSlot({
        slotId: cancellingSlot._id,
        reason: reason as any,
        message,
      });
      setShowCancelModal(false);
      setCancellingSlot(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel slot');
    }
  };

  const getSlotStatusColor = (status: string, booked: number, available: number) => {
    switch (status) {
      case 'active':
        // Different shades of green based on availability
        if (booked === 0) {
          // No bookings yet - bright green
          return 'bg-green-200 text-green-900 border-green-300';
        } else if (available > 0) {
          // Partially booked - medium green
          return 'bg-green-300 text-green-900 border-green-400';
        } else {
          // Fully booked - dark green
          return 'bg-green-500 text-white border-green-600';
        }
      case 'blocked':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-medium text-gray-900 min-w-[180px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Cancelled</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="divide-y divide-gray-200">
          {calendar.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200">
              {week.map((day, dayIdx) => {
                const dateString = day?.toISOString().split('T')[0];
                const daySlots = dateString ? slotsByDate[dateString] || [] : [];
                const isToday =
                  day &&
                  day.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[120px] p-2 ${
                      day ? 'bg-white' : 'bg-gray-50'
                    } ${isToday ? 'bg-teal-50' : ''}`}
                  >
                    {day && (
                      <>
                        <div
                          className={`text-sm font-medium mb-2 ${
                            isToday ? 'text-teal-700' : 'text-gray-700'
                          }`}
                        >
                          {day.getDate()}
                        </div>

                        <div className="space-y-1">
                          {daySlots.map((slot) => (
                            <div
                              key={slot._id}
                              className={`text-xs p-1.5 rounded border ${getSlotStatusColor(
                                slot.status,
                                slot.booked,
                                slot.available
                              )} cursor-pointer hover:shadow-sm transition-shadow`}
                              onClick={() => setSelectedSlot(slot._id)}
                            >
                              <div className="font-medium">{slot.startTime}</div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <Users className="w-3 h-3" />
                                {slot.booked}/{slot.capacity}
                              </div>
                            </div>
                          ))}
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

      {/* Slot Details Panel */}
      {selectedSlot && (() => {
        const slot = slots?.find((s) => s._id === selectedSlot);
        if (!slot) return null;

        return (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 p-6 overflow-y-auto z-40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Slot Details</h3>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Date</label>
                <p className="text-gray-900">
                  {new Date(slot.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Time</label>
                <p className="text-gray-900">
                  {slot.startTime} - {slot.endTime}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className={`inline-block px-2 py-1 text-sm rounded ${getSlotStatusColor(slot.status, slot.booked, slot.available)}`}>
                  {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Capacity</label>
                <p className="text-gray-900">
                  {slot.booked} / {slot.capacity} booked ({slot.available} available)
                </p>
              </div>

              {slot.status === 'cancelled' && slot.cancellationReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Cancelled</p>
                  <p className="text-sm text-red-700">
                    Reason: {slot.cancellationReason}
                  </p>
                  {slot.cancellationMessage && (
                    <p className="text-sm text-red-700 mt-1">{slot.cancellationMessage}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t space-y-2">
                {slot.status === 'active' && slot.booked === 0 && (
                  <button
                    onClick={() => handleBlockSlot(slot._id)}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Block Slot
                  </button>
                )}

                {slot.status === 'blocked' && (
                  <button
                    onClick={() => handleUnblockSlot(slot._id)}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unblock Slot
                  </button>
                )}

                {slot.status === 'active' && slot.booked > 0 && (
                  <button
                    onClick={() => handleCancelClick(slot)}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel Slot ({slot.booked} booking{slot.booked !== 1 ? 's' : ''})
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancel Modal */}
      {showCancelModal && cancellingSlot && (
        <CancelSlotModal
          slotId={cancellingSlot._id}
          date={cancellingSlot.date}
          time={cancellingSlot.startTime}
          bookedCount={cancellingSlot.booked}
          onClose={() => {
            setShowCancelModal(false);
            setCancellingSlot(null);
          }}
          onConfirm={handleCancelConfirm}
        />
      )}
    </div>
  );
};
