import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Users, Loader2, AlertCircle, Lock, CheckCircle } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAuth } from '../contexts/AuthContext';
import { Listing } from '../types';
import { getStripe } from '../services/stripeService';
import { PaymentForm } from './PaymentForm';
import { CustomerBookingCalendar } from './CustomerBookingCalendar';

interface BookingModalProps {
  listing: Listing;
  onClose: () => void;
  preSelectedSlot?: {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    available: number;
    capacity: number;
  };
}

export const BookingModal: React.FC<BookingModalProps> = ({ listing, onClose, preSelectedSlot }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step 1: Select slot from calendar
  // Step 2: Enter guest count and review
  // Step 3: Payment
  // Step 4: Success
  // If preSelectedSlot is provided, skip directly to step 2
  const [step, setStep] = useState(preSelectedSlot ? 2 : 1);

  const [selectedSlot, setSelectedSlot] = useState<any | null>(preSelectedSlot || null);
  const [guests, setGuests] = useState(1);
  const [booking, setBooking] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<any>(null);

  const [stripePromise] = useState(() => getStripe());

  const createBookingMutation = useMutation(api.bookings.createSlotBooking);
  const createPaymentIntentAction = useAction(api.stripe.payments.createPaymentIntent);

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
    setStep(2); // Move to guest selection
  };

  const handleContinueToPayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedSlot) {
      alert('Please select a time slot');
      return;
    }

    setBooking(true);
    try {
      // Step 1: Create booking with pending status
      const bookingId = await createBookingMutation({
        slotId: selectedSlot._id,
        guests: guests,
      });

      console.log('✅ Booking created:', bookingId);
      setCreatedBookingId(bookingId);

      // Step 2: Create payment intent with commission calculation
      const totalAmountInCents = Math.round((listing.price * guests) * 100);
      const paymentResult = await createPaymentIntentAction({
        bookingId,
        amount: totalAmountInCents,
      });

      console.log('✅ Payment intent created:', paymentResult.paymentIntentId);
      setClientSecret(paymentResult.clientSecret);

      // Set up payment options
      setPaymentOptions({
        clientSecret: paymentResult.clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#14b8a6',
            borderRadius: '12px',
          },
        },
      });

      setBooking(false);
      setStep(3); // Go to payment step
    } catch (error: any) {
      console.error('❌ Setup error:', error);
      setBooking(false);
      alert(error.message || "Failed to initialize payment. Please try again.");
    }
  };

  const handlePaymentSuccess = async () => {
    // Payment succeeded - webhook will update booking status
    setStep(4); // Success step
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const totalAmount = listing.price * guests;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Step 1: Select Time Slot from Calendar */}
        {step === 1 && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Book {listing.title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">${listing.price} / person</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <CustomerBookingCalendar
              listingId={listing.id as Id<"listings">}
              onSelectSlot={handleSlotSelect}
              selectedSlotId={selectedSlot?._id}
            />
          </div>
        )}

        {/* Step 2: Guest Count and Review */}
        {step === 2 && selectedSlot && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review Booking</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{listing.title}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Selected Slot Info */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Time</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {new Date(selectedSlot.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div className="text-teal-600 dark:text-teal-400 font-medium mt-1">
                  {selectedSlot.startTime} - {selectedSlot.endTime}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {selectedSlot.available} of {selectedSlot.capacity} spots remaining
                </div>
              </div>

              {/* Guest Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Number of Guests
                </label>
                <div className="relative">
                  <select
                    value={guests}
                    onChange={e => setGuests(parseInt(e.target.value))}
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {[...Array(Math.min(selectedSlot.available, 10))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} {i + 1 === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-4 pointer-events-none text-gray-500 dark:text-gray-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-teal-50 dark:bg-teal-900/30 p-6 rounded-xl space-y-2">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>${listing.price} × {guests} {guests === 1 ? 'guest' : 'guests'}</span>
                  <span>${listing.price * guests}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-teal-200 dark:border-teal-700">
                  <span>Total</span>
                  <span>${totalAmount}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedSlot(null);
                  }}
                  className="flex-1 py-4 rounded-xl font-bold border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinueToPayment}
                  disabled={booking}
                  className="flex-1 py-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {booking ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Continue to Payment
                      <Lock className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && paymentOptions && stripePromise && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Complete your booking</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total Amount</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">${totalAmount}</span>
              </div>
            </div>

            <Elements stripe={stripePromise} options={paymentOptions}>
              <PaymentForm
                amount={totalAmount}
                bookingId={createdBookingId!}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={() => setStep(2)}
              />
            </Elements>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="p-8 text-center">
            <div className="inline-block p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Booking Confirmed!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Your booking for {listing.title} has been confirmed.
            </p>
            {selectedSlot && (
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                {new Date(selectedSlot.date).toLocaleDateString()} at {selectedSlot.startTime}
              </p>
            )}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/customer/bookings')}
                className="w-full py-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors"
              >
                View My Bookings
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
