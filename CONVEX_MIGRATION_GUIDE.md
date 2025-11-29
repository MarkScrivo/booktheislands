# Convex Migration Guide - Discover Phangan

## Overview
This guide walks you through migrating from Supabase to Convex for the Discover Phangan application.

## Why Convex?
- ✅ No RLS complexity or timeout issues
- ✅ Built-in real-time subscriptions (automatic)
- ✅ TypeScript-first with end-to-end type safety
- ✅ Function-level auth (simpler than row-level)
- ✅ Generous free tier (1M function calls/month)
- ✅ Zero-config real-time messaging

## Prerequisites
- Node.js 18+ installed
- npm installed
- Convex account (create at [convex.dev](https://www.convex.dev))

---

## Phase 1: Initial Setup (30 minutes)

### Step 1: Create Convex Account
1. Go to [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Sign up with GitHub or Google
3. Create a new project named "discover-phangan"
4. Copy your deployment URL (looks like: `https://your-project.convex.cloud`)

### Step 2: Initialize Convex (Already Done)
```bash
npm install convex  # ✅ Already installed
mkdir convex        # ✅ Already created
```

### Step 3: Configure Convex
Create `.env.local` entry:
```env
VITE_CONVEX_URL=https://your-project.convex.cloud
```

### Step 4: Run Convex Dev Server
In a **new terminal window**, run:
```bash
npx convex dev
```

This will:
- Prompt you to log in (use the account from Step 1)
- Link your local project to your Convex deployment
- Start watching for changes in the `convex/` folder
- Automatically deploy changes

**Keep this terminal running** - it's your development server for the backend.

---

## Phase 2: Understanding Convex Concepts (15 minutes)

### Key Differences from Supabase

| Concept | Supabase | Convex |
|---------|----------|--------|
| Database | PostgreSQL with SQL | Document-based with TypeScript queries |
| Queries | SQL SELECT | TypeScript query functions |
| Mutations | SQL INSERT/UPDATE/DELETE | TypeScript mutation functions |
| Auth | Supabase Auth + RLS | Convex Auth + function-level checks |
| Real-time | `.on('postgres_changes')` | Automatic with `useQuery()` |
| Schema | SQL CREATE TABLE | TypeScript schema definitions |

### Convex File Structure

```
convex/
├── schema.ts           # Database schema (like SQL CREATE TABLE)
├── auth.config.ts      # Authentication configuration
├── listings.ts         # Listing queries and mutations
├── bookings.ts         # Booking operations
├── messages.ts         # Messaging with real-time
├── reviews.ts          # Review operations
└── lib/
    └── auth.ts         # Auth helper functions
```

### Three Types of Functions

1. **Queries** (`query`) - Read data (like SELECT)
   - Cannot modify data
   - Automatically reactive (real-time updates)
   - Can be called from `useQuery()` hook

2. **Mutations** (`mutation`) - Write data (like INSERT/UPDATE/DELETE)
   - Can modify data
   - Not automatically reactive
   - Called from `useMutation()` hook

3. **Actions** (`action`) - External operations
   - Call third-party APIs (Stripe, email, etc.)
   - Cannot directly access database
   - Can call queries/mutations internally

---

## Phase 3: Schema Definition (1 hour)

The schema files have been created in `convex/schema.ts`. Review and understand:

### Key Schema Concepts

```typescript
// Define a table
defineTable({
  title: v.string(),           // Required string
  price: v.number(),            // Required number
  category: v.union(            // Enum-like validation
    v.literal("Water Sports"),
    v.literal("Wellness"),
    // ...
  ),
  vendorId: v.optional(v.id("profiles")),  // Foreign key
  createdAt: v.number(),        // Timestamp (milliseconds)
})
.index("by_vendor", ["vendorId"])  // Index for fast lookups
.index("by_category", ["category"])
```

### Schema vs Supabase

| Supabase SQL | Convex Schema |
|--------------|---------------|
| `VARCHAR(255)` | `v.string()` |
| `INTEGER` | `v.number()` |
| `BOOLEAN` | `v.boolean()` |
| `TIMESTAMP` | `v.number()` (milliseconds) |
| `TEXT[]` | `v.array(v.string())` |
| `UUID REFERENCES` | `v.id("tableName")` |
| `CHECK (col IN (...))` | `v.union(v.literal(), ...)` |

---

## Phase 4: Writing Queries & Mutations (2-3 hours)

### Example: Fetch All Listings

**Supabase (old):**
```typescript
const { data, error } = await supabase
  .from('listings')
  .select('*')
  .order('created_at', { ascending: false });
```

**Convex (new):**
```typescript
// In convex/listings.ts
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("listings")
      .order("desc")
      .collect();
  },
});

// In React component
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const listings = useQuery(api.listings.list);
// listings automatically updates when data changes! 🎉
```

### Example: Create a Booking

**Supabase (old):**
```typescript
const { data, error } = await supabase
  .from('bookings')
  .insert({
    listing_id: listingId,
    customer_id: userId,
    // ...
  });
```

**Convex (new):**
```typescript
// In convex/bookings.ts
export const create = mutation({
  args: {
    listingId: v.id("listings"),
    bookingDate: v.string(),
    guests: v.number(),
    totalPrice: v.number(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Insert booking
    const bookingId = await ctx.db.insert("bookings", {
      listingId: args.listingId,
      customerId: identity.subject,
      bookingDate: args.bookingDate,
      guests: args.guests,
      totalPrice: args.totalPrice,
      status: "confirmed",
      createdAt: Date.now(),
    });

    return bookingId;
  },
});

// In React component
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const createBooking = useMutation(api.bookings.create);

// Usage
await createBooking({
  listingId: listing._id,
  bookingDate: "2025-01-15",
  guests: 4,
  totalPrice: 125.00,
});
```

### Example: Real-time Messaging

**Supabase (old - complex setup):**
```typescript
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, payload => {
    // Handle new message
  })
  .subscribe();
```

**Convex (new - automatic):**
```typescript
// In convex/messages.ts
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
  },
});

// In React component - automatically reactive!
const messages = useQuery(api.messages.list, {
  conversationId: conversation._id
});
// Messages automatically update when new ones arrive! No subscription setup needed!
```

---

## Phase 5: Authentication Setup (2-3 hours)

### Convex Auth Setup

We'll use Convex Auth for email/password authentication.

```bash
npm install @convex-dev/auth
```

Configuration files created:
- `convex/auth.config.ts` - Auth provider configuration
- `convex/lib/auth.ts` - Helper functions for role-based access

### Role-Based Access

**Supabase (old - RLS):**
```sql
CREATE POLICY "vendors_only" ON listings
FOR SELECT USING (auth.uid() = vendor_id);
```

**Convex (new - function-level):**
```typescript
export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Get user profile to check role
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (profile?.role !== "vendor") {
      throw new Error("Unauthorized: Vendors only");
    }

    return await ctx.db
      .query("listings")
      .withIndex("by_vendor", (q) => q.eq("vendorId", identity.subject))
      .collect();
  },
});
```

---

## Phase 6: Frontend Integration (2-3 hours)

### Update Main App Component

**Old (Supabase):**
```typescript
import { supabase } from './services/supabaseClient';
```

**New (Convex):**
```typescript
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function App() {
  return (
    <ConvexProvider client={convex}>
      {/* Your app */}
    </ConvexProvider>
  );
}
```

### Update Data Fetching

**Old (Supabase):**
```typescript
const [listings, setListings] = useState([]);

useEffect(() => {
  const load = async () => {
    const { data } = await supabase.from('listings').select('*');
    setListings(data);
  };
  load();
}, []);
```

**New (Convex):**
```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const listings = useQuery(api.listings.list);
// That's it! No useState, no useEffect, automatically updates! 🎉
```

### Update Mutations

**Old (Supabase):**
```typescript
const handleBooking = async () => {
  const { error } = await supabase.from('bookings').insert({ /* ... */ });
  if (error) console.error(error);
};
```

**New (Convex):**
```typescript
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const createBooking = useMutation(api.bookings.create);

const handleBooking = async () => {
  try {
    await createBooking({ /* ... */ });
  } catch (error) {
    console.error(error);
  }
};
```

---

## Phase 7: Data Migration (2-3 hours)

### Export Data from Supabase

```sql
-- In Supabase SQL Editor
COPY (SELECT * FROM profiles) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM listings) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM bookings) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM reviews) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM messages) TO STDOUT WITH CSV HEADER;
```

Save each as CSV files.

### Import Data to Convex

Create `convex/migrations/importData.ts`:

```typescript
import { mutation } from "./_generated/server";

export const importListings = mutation({
  args: { listings: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const listing of args.listings) {
      await ctx.db.insert("listings", {
        title: listing.title,
        description: listing.description,
        // ... map all fields
        createdAt: new Date(listing.created_at).getTime(),
      });
    }
  },
});
```

Run via Convex dashboard or CLI.

---

## Phase 8: Testing & Deployment (1-2 days)

### Testing Checklist

- [ ] User signup/login works
- [ ] Listings display correctly
- [ ] Search and filters work
- [ ] Booking creation works
- [ ] Vendor dashboard shows their listings
- [ ] Admin dashboard shows all data
- [ ] Real-time messaging works
- [ ] File uploads work
- [ ] Stripe integration works
- [ ] All role-based access enforced

### Deploy to Production

```bash
npx convex deploy
```

This creates a production deployment. Update your `.env.local`:
```env
VITE_CONVEX_URL=https://your-production-url.convex.cloud
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Trying to use SQL
**Problem:** Old habits die hard
**Solution:** Think in terms of JavaScript/TypeScript methods, not SQL

### Pitfall 2: Forgetting auth checks
**Problem:** Queries without authentication
**Solution:** Always check `await ctx.auth.getUserIdentity()` in protected functions

### Pitfall 3: Using Date objects
**Problem:** Convex doesn't support Date objects in database
**Solution:** Use `Date.now()` (milliseconds) for timestamps

### Pitfall 4: Missing indexes
**Problem:** Slow queries on large datasets
**Solution:** Add indexes in schema for fields you query by

### Pitfall 5: Mixing queries and mutations
**Problem:** Trying to modify data in a query
**Solution:** Use queries for reads, mutations for writes

---

## Performance Comparison

| Operation | Supabase (Your Experience) | Convex (Expected) |
|-----------|---------------------------|-------------------|
| Fetch 5 listings | 8-10s timeout | <100ms |
| Create booking | 3-5s | <50ms |
| Real-time message | Complex setup, delayed | Instant, automatic |
| Auth check | RLS overhead, timeouts | Function-level, fast |
| Complex query | Timeout issues | Optimized, cached |

---

## Next Steps

1. ✅ Review this guide
2. ✅ Set up Convex account
3. ✅ Run `npx convex dev`
4. 📝 Test basic queries in Convex dashboard
5. 🔨 Start migrating one feature at a time
6. 🧪 Test thoroughly
7. 🚀 Deploy to production

---

## Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Convex Auth Docs](https://docs.convex.dev/auth/convex-auth)
- [Convex Discord Community](https://convex.dev/community)
- [React Integration Guide](https://docs.convex.dev/client/react)
- [Migration from Firebase](https://docs.convex.dev/migration/firebase) (similar concepts)

---

## Questions?

Refer to the Convex documentation or ask in their Discord community. The team is very responsive!
