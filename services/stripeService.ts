import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or initialize Stripe instance
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey || publishableKey === 'pk_test_YOUR_PUBLISHABLE_KEY_HERE') {
      console.warn('⚠️ Stripe publishable key not configured. Payment processing will not work.');
      console.warn('Please add VITE_STRIPE_PUBLISHABLE_KEY to your .env.local file');
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(publishableKey);
  }

  return stripePromise;
};

/**
 * Create a payment intent for a booking
 * In a production app, this should call your backend API
 * which then calls Stripe's API with your secret key
 */
export interface CreatePaymentIntentParams {
  amount: number; // Amount in cents (e.g., 5000 = $50.00)
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}

/**
 * Mock function - In production, this should call your backend
 * Backend example (Node.js):
 *
 * app.post('/create-payment-intent', async (req, res) => {
 *   const { amount, currency, description, metadata } = req.body;
 *
 *   const paymentIntent = await stripe.paymentIntents.create({
 *     amount,
 *     currency: currency || 'thb',
 *     description,
 *     metadata,
 *     automatic_payment_methods: { enabled: true }
 *   });
 *
 *   res.json({ clientSecret: paymentIntent.client_secret });
 * });
 */
export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<{ clientSecret: string } | null> => {
  try {
    // TODO: Replace this with actual backend API call
    // For now, returning mock for demonstration
    console.log('🔄 Creating payment intent:', params);

    // In production, you would do:
    // const response = await fetch('/api/create-payment-intent', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(params)
    // });
    // const data = await response.json();
    // return data;

    // Mock response for now
    console.warn('⚠️ Using mock payment intent. Set up backend API for production.');
    return {
      clientSecret: 'mock_client_secret_' + Date.now()
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return null;
  }
};

/**
 * Format amount for display
 * @param cents Amount in cents
 * @param currency Currency code (default: THB)
 */
export const formatAmount = (cents: number, currency: string = 'THB'): string => {
  const amount = cents / 100;

  if (currency === 'THB') {
    return `฿${amount.toFixed(2)}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount);
};

/**
 * Convert dollars to cents for Stripe
 */
export const toCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

/**
 * Convert cents to dollars
 */
export const toDollars = (cents: number): number => {
  return cents / 100;
};
