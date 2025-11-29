# Fix the Timeout Issue - Quick Guide

## The Problem

Your Explore page is showing a spinning loader that times out after 10 seconds because the database query for listings is hanging. This is due to Row Level Security (RLS) policies that need to be refreshed.

## The Solution (5 Minutes)

### Step 1: Open Supabase Dashboard

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script

1. Open the file: `supabase_fix_listings_timeout.sql` (in this directory)
2. **Select all** the content (Cmd+A or Ctrl+A)
3. **Copy** it (Cmd+C or Ctrl+C)
4. Go back to Supabase SQL Editor
5. **Paste** the content (Cmd+V or Ctrl+V)
6. Click the **Run** button (or press Cmd+Enter)

### Step 3: Wait for Success

You should see output like this:

```
✅ FIX APPLIED SUCCESSFULLY!

📋 What was fixed:
   ✓ Dropped all old policies on listings table
   ✓ Created fresh public read policy (USING true)
   ✓ Created vendor write policies
   ✓ Confirmed listings query works
```

### Step 4: Test Your App

1. Go back to your app at <http://localhost:3001>
2. **Hard refresh** the page:
   - Mac: Cmd+Shift+R
   - Windows/Linux: Ctrl+Shift+R
3. The Explore page should load immediately!

### Step 5: Verify It's Working

Check your browser console (F12 → Console tab). You should see:

```
🔄 Fetching listings...
✅ Fetched 10 listings
```

(Or however many listings you have)

## If It Still Doesn't Work

### Try This:

1. **Log out and log back in** to your app
2. **Clear browser cache completely**:
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Settings → Privacy → Clear Data
3. **Check for errors** in browser console (F12)

### Still Having Issues?

Run the diagnostic script to see what's happening:

1. Open: `supabase_diagnose_rls.sql`
2. Copy all content
3. Paste in Supabase SQL Editor
4. Click Run
5. Look for errors or timeouts

## What This Fix Does

The script will:

1. Check current RLS status on listings table
2. Drop all existing policies (clean slate)
3. Re-enable RLS
4. Create fresh public read policy: `USING (true)`
5. Create vendor policies for write operations
6. Test that the query actually works
7. Show you the results

## Why This Happened

RLS policies can sometimes get into a conflicting state, especially after:

- Multiple policy updates
- Auth session changes
- Database migrations

The fix drops everything and starts fresh with clean policies.

## Current Status

- Your mock payment: ✅ Working
- Your app refactoring: ✅ Complete
- Your build: ✅ Success
- Your database query: ⚠️ Needs this fix

After running this script, everything should be working perfectly!

---

**Need help?** Check the other documentation files:

- `SESSION_SUMMARY.md` - Complete session overview
- `TROUBLESHOOTING.md` - Detailed debug guide
- `STRIPE_INTEGRATION.md` - Payment setup guide
