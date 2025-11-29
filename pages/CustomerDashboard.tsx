import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { Booking, TimeSlot } from '../types';
import { Loader2, Palmtree, Calendar, Users, CheckCircle, ShoppingBag } from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 🎉 Convex: Automatically fetch customer bookings
  const convexBookings = useQuery(api.bookings.myBookings, user ? {} : "skip");

  // Convert Convex data to app types
  const bookings: Booking[] = (convexBookings || []).map(b => ({
    id: b._id,
    listingId: b.listingId,
    listingTitle: b.listingTitle,
    customerId: b.customerId,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    vendorId: b.vendorId,
    date: b.bookingDate,
    guests: b.guests,
    totalPrice: b.totalPrice,
    status: b.status as 'pending' | 'confirmed' | 'completed' | 'cancelled',
    paymentStatus: b.paymentStatus as 'pending' | 'paid' | 'refunded',
    timeSlot: b.timeSlot as TimeSlot | undefined,
    createdAt: new Date(b.createdAt).toISOString(),
  }));

  const isLoading = convexBookings === undefined;

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">My Trips</h1>

        <div className="space-y-4">
          {bookings.length > 0 ? (
            bookings.map(b => (
              <div
                key={b.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <Palmtree className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{b.listingTitle}</h3>
                    <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {b.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" /> {b.guests} Guests
                      </span>
                    </div>
                    {b.timeSlot && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-600 dark:text-gray-300 uppercase">
                        {b.timeSlot.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">${b.totalPrice}</div>
                  <div className="text-green-600 dark:text-green-400 font-bold text-sm flex items-center justify-end gap-1 mt-1">
                    <CheckCircle className="w-4 h-4" /> Confirmed
                  </div>
                  <Link
                    to={`/listing/${b.listingId}`}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-2 block"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-dashed border-2 border-gray-200 dark:border-gray-700">
              <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">No trips booked yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Start your adventure in Koh Phangan today.</p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors"
              >
                Explore Activities
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
