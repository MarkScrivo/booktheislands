# Stripe Connect Setup Instructions

## Step 1: Add Environment Variables to Convex

1. Go to **Convex Dashboard**: https://dashboard.convex.dev
2. Select your project: **discover-phangan**
3. Navigate to: **Settings → Environment Variables**
4. Click **Add Variable** and add these three:

```
Variable Name: STRIPE_SECRET_KEY
Value: sk_test_YOUR_STRIPE_SECRET_KEY_HERE
```

```
Variable Name: SITE_URL
Value: http://localhost:3000
```

```
Variable Name: STRIPE_WEBHOOKS_SECRET
Value: (leave empty for now - add later when testing webhooks)
```

5. Click **Save** after adding each variable

## Step 2: Initialize Platform Settings

Once the environment variables are saved:

1. Open your app: http://localhost:3000
2. Navigate to: http://localhost:3000/#/setup
3. You'll see the **Platform Setup** page
4. Set your default commission rate (recommended: 10%)
5. Click **Initialize Platform**
6. You should see "Setup Complete!" and be redirected to the homepage

## Step 3: Verify Setup

After initialization, you can verify everything is working:

1. Go to http://localhost:3000/#/setup again
2. You should see "Platform Already Configured" with your commission rate
3. This means the setup was successful!

## What's Next?

Now you're ready to:
- ✅ Create vendor accounts and test onboarding
- ✅ Make test payments with Stripe test cards
- ✅ See commission splits in action

## Webhook Testing (Optional - For Later)

To test webhooks locally:

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to http://localhost:3001/stripe/webhook`
4. Copy the webhook signing secret (starts with `whsec_`)
5. Add it to Convex as `STRIPE_WEBHOOKS_SECRET`

Without webhooks, payments will still work, but you won't see real-time status updates from Stripe events. This is fine for development!

## Troubleshooting

### "Environment variables not found" error
- Make sure you saved all 3 variables in Convex Dashboard
- Wait 10-15 seconds for Convex to reload with new env vars
- Refresh your browser

### Setup page won't initialize
- Check browser console for errors
- Verify Convex is running (should see functions in dashboard)
- Make sure you're logged in (create an account if needed)

### Questions?
Check the comprehensive implementation plan in your conversation history for full details on the Stripe Connect architecture!
