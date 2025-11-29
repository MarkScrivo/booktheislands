# Fix: Clear Stale Auth Session

## The Problem

Your Supabase queries work fine in the SQL Editor, but hang when called from the browser. This means your browser has a **stale/corrupted auth session** that's interfering with queries.

## The Fix (Choose One)

### Option 1: Clear Browser Storage (Recommended)

1. Open your app at <http://localhost:3001>
2. Open DevTools (F12 or Right-click → Inspect)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. On the left sidebar:
   - Click **Local Storage** → `http://localhost:3001`
   - Click **Clear All** or delete all entries
   - Click **Session Storage** → `http://localhost:3001`
   - Click **Clear All** or delete all entries
   - Click **Cookies** → `http://localhost:3001`
   - Delete all cookies
5. **Close DevTools**
6. **Hard Refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

### Option 2: Incognito Mode Test

1. Open a **new incognito/private window**
2. Go to <http://localhost:3001>
3. Check if listings load

If they load in incognito → confirms it's browser storage issue

### Option 3: JavaScript Console Clear

1. Open DevTools (F12)
2. Go to **Console** tab
3. Paste and run:

```javascript
// Clear all Supabase auth data
localStorage.clear();
sessionStorage.clear();
console.log('✅ Storage cleared!');
location.reload();
```

### Option 4: Log Out in App

1. In your app, click **Log Out** (if you see it in the navbar)
2. Wait for logout to complete
3. **Hard refresh** the page
4. Try accessing Explore page without logging in

## What's Happening

Your browser is sending an **expired or invalid auth token** with every Supabase query:

```
Browser → Supabase: "SELECT * FROM listings" + [stale auth token]
Supabase → Auth Service: "Is this token valid?"
Auth Service → [hangs/times out trying to validate]
Query → Never completes
```

When you query from SQL Editor, there's no auth token, so it works instantly.

## After Clearing Storage

You should see:

```
🔄 Fetching listings...
📡 Supabase client exists, starting query...
🔵 Executing Supabase query (5s timeout)...
🔵 Query completed in 234ms
🟢 Supabase returned 10 rows
✅ Fetched 10 listings in 235 ms
```

Instead of timeout warnings.

## If This Doesn't Work

It could be a Supabase project issue. Check your Supabase dashboard:

1. Go to your Supabase project
2. Click **Database** → **API Logs**
3. Look for hanging requests
4. Check if your project is paused or has quota issues

---

**Most Likely Solution**: Option 1 (Clear Browser Storage)
