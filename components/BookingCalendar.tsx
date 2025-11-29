import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Booking } from '../types';

interface BookingCalendarProps {
  bookings: Booking[];
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group bookings by date
  const bookingsByDate = new Map<string, Booking[]>();
  bookings.forEach(booking => {
    const dateKey = booking.date; // Format: YYYY-MM-DD
    if (!bookingsByDate.has(dateKey)) {
      bookingsByDate.set(dateKey, []);
    }
    bookingsByDate.get(dateKey)!.push(booking);
  });

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDateKey = (day: number): string => {
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const getBookingsForDay = (day: number): Booking[] => {
    const dateKey = getDateKey(day);
    return bookingsByDate.get(dateKey) || [];
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isPastDate = (day: number): boolean => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Generate calendar days
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          {monthNames[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {dayNames.map(day => (
          <div
            key={day}
            className="text-center text-xs font-bold text-gray-500 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayBookings = getBookingsForDay(day);
          const hasBookings = dayBookings.length > 0;
          const today = isToday(day);
          const past = isPastDate(day);

          return (
            <div
              key={day}
              className={`aspect-square border border-gray-200 dark:border-gray-700 rounded-lg p-2 relative ${
                today ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-500' : 'bg-white dark:bg-gray-700'
              } ${past ? 'opacity-60' : ''} ${
                hasBookings ? 'hover:shadow-lg transition cursor-pointer' : ''
              }`}
              title={
                hasBookings
                  ? `${dayBookings.length} booking${dayBookings.length > 1 ? 's' : ''}`
                  : ''
              }
            >
              {/* Day number */}
              <div
                className={`text-sm font-bold ${
                  today ? 'text-teal-700 dark:text-teal-300' : past ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'
                }`}
              >
                {day}
              </div>

              {/* Booking indicators */}
              {hasBookings && (
                <div className="mt-1 space-y-0.5">
                  {dayBookings.slice(0, 3).map((booking, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-1 py-0.5 rounded truncate ${
                        booking.status === 'confirmed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : booking.status === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : booking.status === 'completed'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}
                      title={`${booking.listingTitle} - ${booking.guests} guests`}
                    >
                      {booking.listingTitle.length > 8
                        ? booking.listingTitle.substring(0, 8) + '...'
                        : booking.listingTitle}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Cancelled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-teal-50 dark:bg-teal-900/30 border border-teal-300 dark:border-teal-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Today</span>
        </div>
      </div>

      {/* Summary */}
      {bookings.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>{bookings.length}</strong> total bookings this month
          </p>
        </div>
      )}
    </div>
  );
};
