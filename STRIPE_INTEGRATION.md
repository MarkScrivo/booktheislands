# 💳 Stripe Payment Integration Guide

## Overview

Discover Phangan now includes Stripe payment integration for secure booking payments. This guide will help you set up and test the payment system.

---

## 🚀 Quick Setup

### 1. Get Your Stripe API Keys

1. Sign up for a free Stripe account: https://dashboard.stripe.com/register
2. Go to: https://dashboard.stripe.com/test/apikeys
3. Copy your **Publishable Key** (starts with `pk_test_...`)

### 2. Configure Environment Variables

Add your Stripe publishable key to `.env.local`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

**Important:** The key MUST start with `VITE_` for Vite to expose it to the client.

### 3. Run the Database Migration

Execute the payments table SQL in your Supabase dashboard:

1. Open Supabase Dashboard → SQL Editor
2. Copy the content from `supabase_payments_table.sql`
3. Paste and click **Run**

This creates:
- `payments` table for transaction tracking
- RLS policies for secure access
- Indexes for performance
- `payment_status` column in bookings table

---

## 🎯 How It Works

### Current Implementation (Test Mode)

The integration is currently set up for **development/testing** with a mock payment flow:

1. **Customer selects dates & guests** → Step 1
2. **Mock payment form** → Step 3 (skips old confirmation step)
3. **Booking created** → After "payment" success
4. **Success confirmation** → Step 4

### Booking Flow

```
User clicks "Check Availability"
  ↓
Select Date, Guests, Time Slot
  ↓
Click "Continue to Payment"
  ↓
[PAYMENT FORM]
  - Shows booking summary
  - Mock card form (for testing)
  - Test card: 4242 4242 4242 4242
  ↓
Click "Pay $XX"
  ↓
2-second processing simulation
  ↓
Booking created in database
  ↓
Success screen
```

---

## 🧪 Testing

### Test Cards

Use these Stripe test cards (any future expiry, any CVC):

| Card Number | Brand | Result |
|-------------|-------|--------|
| 4242 4242 4242 4242 | Visa | Success ✅ |
| 4000 0000 0000 9995 | Visa | Declined ❌ |
| 4000 0025 0000 3155 | Visa | Requires authentication |
| 5555 5555 5555 4444 | Mastercard | Success ✅ |

### Testing the Flow

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3001
3. Click on any activity
4. Click "Check Availability"
5. Select a date, guests, and time slot
6. Click "Continue to Payment"
7. Use test card: `4242 4242 4242 4242`
8. Any future expiry date (e.g., 12/25)
9. Any 3-digit CVC (e.g., 123)
10. Click "Pay $XX"
11. Wait 2 seconds for mock processing
12. See success screen ✅

---

## 🏗️ Architecture

### Files Created

```
services/
  └─ stripeService.ts          # Stripe initialization & helpers

components/
  └─ PaymentForm.tsx            # Payment form with mock elements

components/
  └─ BookingModal.tsx           # Updated with payment step

supabase_payments_table.sql    # Database schema for payments
```

### Key Components

#### 1. Stripe Service (`services/stripeService.ts`)

```typescript
// Initialize Stripe
const stripe = await getStripe();

// Format amounts
const formatted = formatAmount(5000, 'THB'); // ฿50.00

// Convert for Stripe (uses cents)
const cents = toCents(50); // 5000
```

#### 2. Payment Form (`components/PaymentForm.tsx`)

- Mock card input fields (replace with real Stripe Elements)
- Processing state management
- Error handling
- Success callback

#### 3. Updated Booking Modal

**New Flow:**
- Step 1: Date & Guest selection
- ~~Step 2: Removed~~
- Step 3: Payment
- Step 4: Success

---

## 🔐 Security

### Current Setup (Test Mode)

✅ **Secure:**
- RLS policies protect payment data
- Customers only see their payments
- Vendors only see payments for their listings

⚠️ **Not Production Ready:**
- Mock payment processing (no real Stripe API)
- No backend payment intent creation
- Test keys only

### For Production

You'll need to:

1. **Create a backend API endpoint** (Node.js example):

```javascript
// backend/api/create-payment-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, currency, bookingId } = req.body;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: currency || 'thb',
    metadata: { bookingId },
    automatic_payment_methods: { enabled: true }
  });

  res.json({ clientSecret: paymentIntent.client_secret });
});
```

2. **Update `stripeService.ts`** to call your backend:

```typescript
export const createPaymentIntent = async (params) => {
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return await response.json();
};
```

3. **Replace mock PaymentForm** with real Stripe Elements:

```tsx
// In PaymentForm.tsx
import { PaymentElement } from '@stripe/react-stripe-js';

// Replace mock inputs with:
<PaymentElement />
```

4. **Confirm the payment** in PaymentForm:

```typescript
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: window.location.origin + '/payment-success',
  },
});
```

---

## 💰 Pricing & Fees

### Stripe Fees (Thailand)

- **Domestic cards:** 2.9% + ฿10 per transaction
- **International cards:** 3.4% + ฿10 per transaction
- **No monthly fees** for standard account

### Currency Support

Currently configured for:
- **THB** (Thai Baht) - Primary
- **USD** (US Dollars) - Secondary

Change default currency in `stripeService.ts`:
```typescript
currency: 'thb' // or 'usd'
```

---

## 📊 Database Schema

### `payments` Table

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id),

    amount INTEGER NOT NULL,        -- Amount in cents
    currency VARCHAR(3),            -- 'THB', 'USD'
    status VARCHAR(50),             -- 'pending', 'succeeded', 'failed'

    payment_intent_id VARCHAR(255), -- Stripe PaymentIntent ID
    charge_id VARCHAR(255),         -- Stripe Charge ID

    customer_id UUID,
    vendor_id UUID,

    payment_method VARCHAR(50),     -- 'card', 'wallet'
    last_four VARCHAR(4),           -- Last 4 digits
    card_brand VARCHAR(50),         -- 'visa', 'mastercard'

    error_message TEXT,
    refund_amount INTEGER,

    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Row Level Security

```sql
-- Customers can view their own payments
CREATE POLICY "payments_select_customer"
ON payments FOR SELECT
USING (auth.uid() = customer_id);

-- Vendors can view payments for their bookings
CREATE POLICY "payments_select_vendor"
ON payments FOR SELECT
USING (auth.uid() = vendor_id);
```

---

## 🐛 Troubleshooting

### Issue: "Stripe publishable key not configured"

**Solution:** Add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env.local`

### Issue: Payment form not showing

**Check:**
1. Stripe key starts with `pk_test_`
2. Environment variable has `VITE_` prefix
3. Restarted dev server after adding `.env.local`

### Issue: "Elements" error

**Solution:** Ensure `<Elements>` wrapper is present in BookingModal

### Issue: RLS blocking payment reads

**Solution:** Run `supabase_payments_table.sql` to set up policies

---

## 🔜 Next Steps

### To Go Live with Real Payments:

1. ✅ Get Stripe account approved
2. ⏳ Create backend API for payment intents
3. ⏳ Replace mock PaymentForm with real Stripe Elements
4. ⏳ Add webhook handler for payment status updates
5. ⏳ Switch to live API keys (starts with `pk_live_`)
6. ⏳ Test with real cards in live mode
7. ⏳ Add email notifications for successful payments
8. ⏳ Implement refund functionality

### Recommended Enhancements:

- **Webhooks:** Listen for payment events from Stripe
- **Email receipts:** Send confirmation emails
- **Refund management:** Allow vendors to issue refunds
- **Failed payment retries:** Handle declined cards gracefully
- **Payment history:** Show payment history in dashboards
- **Multi-currency:** Support multiple currencies automatically

---

## 📞 Support

### Stripe Resources

- **Dashboard:** https://dashboard.stripe.com
- **Documentation:** https://stripe.com/docs
- **Test Cards:** https://stripe.com/docs/testing
- **API Reference:** https://stripe.com/docs/api

### In Your App

- File issues in your project repository
- Check console logs for error messages
- Review Supabase logs for RLS issues

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
**Status:** ✅ Test Mode Ready | ⏳ Production Setup Pending
