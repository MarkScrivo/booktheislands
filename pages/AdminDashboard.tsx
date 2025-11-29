import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, Package, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import type { Booking, TimeSlot } from '../types';

export const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // 🎉 Convex: Fetch all data for admin (admin-only queries will check permission)
  const allListings = useQuery(api.listings.list);
  const allBookings = useQuery(api.bookings.myBookings, user ? {} : "skip"); // TODO: Add admin.getAllBookings

  const isLoading = allListings === undefined || allBookings === undefined;

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      navigate('/');
    }
  }, [user, profile, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // Calculate stats client-side
  const bookings: Booking[] = (allBookings || []).map(b => ({
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

  const stats = {
    totalRevenue: bookings.reduce((sum, b) => sum + b.totalPrice, 0),
    bookingCount: bookings.length,
    listingCount: (allListings || []).length,
    userCount: 0, // Would need separate query
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">${stats.totalRevenue}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase mb-1">Bookings</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bookingCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase mb-1">Listings</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.listingCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase mb-1">Users</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">-</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Bookings</h2>
          </div>
          <div className="p-6">
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.slice(0, 10).map(b => (
                  <div
                    key={b.id}
                    className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">{b.listingTitle}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                        <span>📅 {b.date}</span>
                        <span>👥 {b.guests} guests</span>
                        <span>👤 {b.customerName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">${b.totalPrice}</div>
                      <div className={`text-sm font-bold mt-1 ${
                        b.status === 'confirmed' ? 'text-green-600 dark:text-green-400' :
                        b.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                        b.status === 'completed' ? 'text-blue-600 dark:text-blue-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {b.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No bookings yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
