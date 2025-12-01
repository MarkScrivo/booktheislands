import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

interface PaymentFormProps {
  amount: number;
  bookingId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  bookingId,
  onSuccess,
  onError,
  onCancel
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updatePaymentStatusMutation = useMutation(api.stripe.payments.updatePaymentStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe hasn't loaded yet
      setMessage('Stripe is still loading. Please try again.');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: 'if_required', // Only redirect if 3D Secure is required
      });

      if (error) {
        // Payment failed
        const errorMessage = error.message || 'Payment failed. Please try again.';
        console.error('❌ Payment error:', error);
        setMessage(errorMessage);
        onError(errorMessage);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded - update database and trigger notifications
        console.log('✅ Payment succeeded:', paymentIntent.id);

        try {
          await updatePaymentStatusMutation({
            paymentIntentId: paymentIntent.id,
            status: 'succeeded',
            chargeId: paymentIntent.latest_charge as string | undefined,
            paymentMethod: paymentIntent.payment_method as string | undefined,
          });
          console.log('✅ Payment status updated in database');
        } catch (dbError: any) {
          console.error('❌ Failed to update payment status:', dbError);
          // Still call onSuccess since payment went through
        }

        onSuccess();
      } else {
        // Unexpected state
        console.error('⚠️ Unexpected payment state:', paymentIntent?.status);
        setMessage('Payment is being processed. Please check your bookings.');
        onSuccess(); // Still call onSuccess since payment might be processing
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred.';
      console.error('❌ Payment exception:', error);
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Amount Display */}
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-700">
            <CreditCard className="w-5 h-5" />
            <span className="font-bold">Payment Amount</span>
          </div>
          <div className="text-2xl font-bold text-teal-900">฿{amount.toFixed(2)}</div>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="mb-4">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-gray-400" />
            Payment Details
          </label>
          <p className="text-xs text-gray-500 mb-4">
            Your payment is secured with 256-bit SSL encryption
          </p>
        </div>

        {/* Real Stripe Payment Element - shows all available methods including PromptPay */}
        <div className="min-h-[200px]">
          <PaymentElement
            options={{
              layout: 'tabs',
              paymentMethodOrder: ['card', 'promptpay'],
            }}
          />
        </div>
      </div>

      {/* Error Message */}
      {message && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Secure</span>
        </div>
        <span>•</span>
        <span>Powered by Stripe</span>
        <span>•</span>
        <span>PCI Compliant</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing}
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay ฿{amount.toFixed(2)}
            </>
          )}
        </button>
      </div>

      {/* Test Mode Notice - only show in development */}
      {import.meta.env.DEV && (
        <div className="text-center">
          <p className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-lg inline-block">
            🧪 Test Mode: Use test card 4242 4242 4242 4242 | Decline: 4000 0000 0000 9995
          </p>
        </div>
      )}
    </form>
  );
};
