/**
 * DaySessionsModal Component
 *
 * Modal that displays all available sessions for a specific day
 * Used when a day has more than 3 sessions to avoid cluttering the calendar
 */

import React from 'react';
import { X, Users, Clock } from 'lucide-react';
import { Id } from '../convex/_generated/dataModel';

interface DaySessionsModalProps {
  date: Date;
  slots: any[];
  onSelectSlot: (slot: any) => void;
  onClose: () => void;
  selectedSlotId?: Id<"slots"> | null;
}

export const DaySessionsModal: React.FC<DaySessionsModalProps> = ({
  date,
  slots,
  onSelectSlot,
  onClose,
  selectedSlotId,
}) => {
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

  const handleSelectSlot = (slot: any) => {
    if (slot.available > 0) {
      onSelectSlot(slot);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Available Sessions
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {slots.map((slot) => (
            <button
              key={slot._id}
              onClick={() => handleSelectSlot(slot)}
              disabled={slot.available === 0}
              className={`w-full p-4 rounded-xl border-2 ${getSlotColor(
                slot
              )} transition-all text-left ${
                slot.available > 0 ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-base">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm mt-1">
                      <Users className="w-4 h-4" />
                      <span>
                        {slot.available > 0 ? (
                          <>
                            <span className="font-medium">{slot.available}</span> spot
                            {slot.available !== 1 ? 's' : ''} available
                          </>
                        ) : (
                          <span className="font-medium">Fully booked</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs font-medium px-3 py-1.5 bg-white/50 dark:bg-gray-900/30 rounded-full">
                  {slot.booked}/{slot.capacity}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Select a time slot to continue booking
          </p>
        </div>
      </div>
    </div>
  );
};
