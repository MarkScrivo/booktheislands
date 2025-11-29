import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Users, DollarSign, Package, Plus, Edit, TrendingUp, Wallet } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { Listing, ActivityCategory, Booking, TimeSlot } from '../types';
import { BookingCalendar } from '../components/BookingCalendar';
import { VendorOnboarding } from '../components/VendorOnboarding';
import { StripeAccountDetails } from '../components/StripeAccountDetails';
import { AvailabilitySetup } from '../components/vendor/AvailabilitySetup';
import { VendorCalendar } from '../components/vendor/VendorCalendar';

interface VendorDashboardProps {
  onAddListing: (listing: Listing) => void;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({ onAddListing }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'bookings' | 'calendar' | 'listings' | 'availability' | 'account'>('bookings');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // 🎉 Convex: Automatically fetch vendor bookings and listings
  const convexBookings = useQuery(api.bookings.vendorBookings, user ? {} : "skip");
  const convexListings = useQuery(api.listings.myListings, user ? {} : "skip");
  const earnings = useQuery(api.stripe.payments.vendorEarningsSummary, user ? {} : "skip");
  const accountStatus = useQuery(api.stripe.connect.getAccountStatus, user ? {} : "skip");

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

  const myListings: Listing[] = (convexListings || []).map(l => ({
    id: l._id,
    title: l.title,
    description: l.description,
    location: l.location,
    price: l.price,
    rating: l.rating,
    reviewCount: l.reviewCount,
    imageUrl: l.imageUrl,
    category: l.category as ActivityCategory,
    vendorName: l.vendorName,
    vendorId: l.vendorId || undefined,
    duration: l.duration,
    galleryUrls: l.galleryUrls,
    videoUrl: l.videoUrl,
    maxCapacity: l.maxCapacity,
    operatingDays: l.operatingDays,
    latitude: l.latitude,
    longitude: l.longitude,
  }));

  const isLoadingBookings = convexBookings === undefined;
  const isLoadingListings = convexListings === undefined;

  useEffect(() => {
    if (!loading && user && profile && profile.role !== 'vendor') {
      navigate('/');
    }
  }, [user, profile, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // Calculate stats
  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const upcomingBookings = bookings.filter(b => new Date(b.date) >= new Date()).length;
  const totalBookings = bookings.length;

  // Real earnings from Stripe (in cents, convert to dollars)
  const netEarnings = earnings ? (earnings.netEarnings / 100).toFixed(2) : '0.00';
  const platformFees = earnings ? (earnings.platformFees / 100).toFixed(2) : '0.00';
  const totalEarnings = earnings ? (earnings.totalEarnings / 100).toFixed(2) : '0.00';
  const commissionRate = accountStatus?.commissionRate || 10;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Vendor Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your listings and bookings</p>
        </div>

        {/* Onboarding Section */}
        {accountStatus && !accountStatus.onboardingComplete && (
          <div className="mb-8">
            <VendorOnboarding />
          </div>
        )}

        {/* Earnings Breakdown */}
        {accountStatus?.onboardingComplete && earnings && earnings.totalPayments > 0 && (
          <div className="mb-8 bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20 rounded-2xl p-6 border border-teal-100 dark:border-teal-800">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Earnings Overview</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bookings Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalEarnings}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{earnings.totalPayments} paid bookings</p>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Platform Commission ({commissionRate}%)</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">-${platformFees}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Service fees deducted</p>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-xl border-2 border-teal-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Net Earnings</p>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">${netEarnings}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Available for payout</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Net Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${netEarnings}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">After {commissionRate}% commission</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{upcomingBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Listings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{myListings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  activeTab === 'bookings'
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Bookings ({bookings.length})
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  activeTab === 'calendar'
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setActiveTab('listings')}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  activeTab === 'listings'
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                My Listings ({myListings.length})
              </button>
              <button
                onClick={() => setActiveTab('availability')}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  activeTab === 'availability'
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Availability
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  activeTab === 'account'
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Stripe Account
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Calendar Tab */}
            {activeTab === 'calendar' && (
              <div>
                {isLoadingBookings ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                  </div>
                ) : (
                  <BookingCalendar bookings={bookings} />
                )}
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                {isLoadingBookings ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                  </div>
                ) : bookings.length > 0 ? (
                  bookings.map(b => (
                    <div
                      key={b.id}
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">{b.listingTitle}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {b.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" /> {b.guests} guests
                          </span>
                          {b.timeSlot && (
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs uppercase dark:text-gray-200">
                              {b.timeSlot.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                          Customer: {b.customerName} ({b.customerEmail})
                        </p>
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
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Payment: {b.paymentStatus}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No bookings yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Listings Tab */}
            {activeTab === 'listings' && (
              <div className="space-y-4">
                {/* Create Listing Button */}
                <button
                  onClick={() => navigate('/vendor/create-listing')}
                  className="w-full bg-teal-600 dark:bg-teal-500 text-white py-3 px-6 rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 font-bold transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create New Listing
                </button>

                {isLoadingListings ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                  </div>
                ) : myListings.length > 0 ? (
                  myListings.map(l => (
                    <div
                      key={l.id}
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex gap-4"
                    >
                      <img
                        src={l.imageUrl}
                        alt={l.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{l.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{l.description}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-teal-600 dark:text-teal-400 font-bold">${l.price}/person</span>
                          <span className="text-gray-500 dark:text-gray-400">⭐ {l.rating} ({l.reviewCount} reviews)</span>
                          <span className="text-gray-500 dark:text-gray-400">Max: {l.maxCapacity} guests</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => navigate(`/vendor/edit-listing?id=${l.id}`)}
                          className="px-4 py-2 bg-gray-900 dark:bg-teal-600 text-white rounded-lg hover:bg-teal-600 dark:hover:bg-teal-700 font-bold transition flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No listings yet</p>
                    <p className="text-sm mt-2">Create your first listing to start accepting bookings</p>
                  </div>
                )}
              </div>
            )}

            {/* Availability Tab */}
            {activeTab === 'availability' && (
              <div>
                {isLoadingListings ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                  </div>
                ) : myListings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No listings yet</p>
                    <p className="text-sm mt-2">Create a listing first to manage availability</p>
                    <button
                      onClick={() => navigate('/vendor/create-listing')}
                      className="mt-4 bg-teal-600 dark:bg-teal-500 text-white py-2 px-6 rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 font-bold transition inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Listing
                    </button>
                  </div>
                ) : !selectedListingId ? (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select a Listing to Manage Availability</h3>
                    <div className="space-y-3">
                      {myListings.map(l => (
                        <button
                          key={l.id}
                          onClick={() => setSelectedListingId(l.id)}
                          className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-teal-500 dark:hover:border-teal-500 transition flex gap-4 items-center text-left"
                        >
                          <img
                            src={l.imageUrl}
                            alt={l.title}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">{l.title}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              ${l.price}/person • Max {l.maxCapacity} guests
                            </p>
                          </div>
                          <div className="text-teal-600 dark:text-teal-400">→</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setSelectedListingId(null)}
                      className="mb-4 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold"
                    >
                      ← Back to listings
                    </button>

                    {/* Show both availability setup and calendar for the selected listing */}
                    <div className="space-y-6">
                      <AvailabilitySetup
                        listingId={selectedListingId as any}
                      />

                      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Calendar View</h3>
                        <VendorCalendar
                          listingId={selectedListingId as any}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stripe Account Tab */}
            {activeTab === 'account' && (
              <div>
                {accountStatus?.onboardingComplete ? (
                  <StripeAccountDetails />
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Complete Stripe onboarding to view account details</p>
                    <p className="text-sm mt-2">Set up your Stripe Connect account to start receiving payments</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
