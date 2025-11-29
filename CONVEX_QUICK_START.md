# Convex Quick Start - Next Steps

## What We've Done So Far ✅

1. ✅ Installed Convex packages (`convex` and `@convex-dev/auth`)
2. ✅ Created `convex/` directory with initial files:
   - `schema.ts` - Complete database schema (profiles, listings, bookings, reviews, messages, etc.)
   - `auth.config.ts` - Email/password authentication configuration
   - `lib/auth.ts` - Helper functions for role-based access control
   - `listings.ts` - All listing queries and mutations (CRUD operations)

## What You Need To Do Next 🚀

### Step 1: Create Convex Account (5 minutes)

1. Open your browser and go to: **https://dashboard.convex.dev**
2. Click "Sign Up" and use GitHub or Google
3. Create a new project:
   - Click "Create Project"
   - Name it: **discover-phangan**
   - Select your preferred region (closest to you or your users)
4. **Copy your deployment URL** - it looks like:
   ```
   https://happy-animal-123.convex.cloud
   ```

### Step 2: Add Convex URL to Environment (1 minute)

Add this line to your `.env.local` file:

```env
VITE_CONVEX_URL=https://your-actual-url.convex.cloud
```

Replace `your-actual-url` with the deployment URL you copied in Step 1.

### Step 3: Initialize Convex Dev Server (2 minutes)

**Open a NEW terminal window** (keep your existing dev server running) and run:

```bash
npx convex dev
```

This will:
1. Ask you to log in (use the same account from Step 1)
2. Prompt you to select your project (choose "discover-phangan")
3. Generate TypeScript types in `convex/_generated/`
4. Start watching for changes
5. Deploy your schema and functions

**Keep this terminal running!** It's like your backend dev server.

### Step 4: Verify Setup (1 minute)

Check that these files were auto-generated:
```
convex/_generated/
  ├── api.d.ts      # TypeScript API types
  ├── dataModel.d.ts # Database types
  └── server.d.ts    # Server utilities
```

If you see these files, you're good to go! 🎉

---

## What's Next?

Once the above steps are complete, we'll continue with:

1. **Create more Convex functions** (bookings, reviews, messages)
2. **Set up Convex Auth in the frontend** (replace Supabase auth)
3. **Update React components** to use Convex hooks (`useQuery`, `useMutation`)
4. **Migrate your data** from Supabase to Convex
5. **Test everything** and remove Supabase dependencies

---

## Troubleshooting

### "Cannot find module '@convex-dev/auth'"
**Solution:** Run `npm install @convex-dev/auth`

### "Error: No Convex deployment configured"
**Solution:** Make sure you ran `npx convex dev` and followed the prompts

### "Module not found: Can't resolve 'convex/_generated/api'"
**Solution:** Wait for `npx convex dev` to finish generating files (takes 10-30 seconds)

### Convex dev command asks for project again
**Solution:** Check your `.convex/` directory - it should have a `deployment.json` file. If not, rerun `npx convex dev` and select the correct project.

---

## Visual Checklist

```
[✅] Convex packages installed
[✅] Schema defined (convex/schema.ts)
[✅] Auth config created (convex/auth.config.ts)
[✅] Helper functions created (convex/lib/auth.ts)
[✅] Listings functions created (convex/listings.ts)
[  ] Convex account created                    ← YOU ARE HERE
[  ] VITE_CONVEX_URL added to .env.local
[  ] npx convex dev running in separate terminal
[  ] convex/_generated/ files exist
[  ] Ready to continue migration!
```

---

## Expected Output

When you run `npx convex dev` successfully, you should see:

```
✔ Deployment URL: https://your-project.convex.cloud
✔ Schema pushed
✔ Functions deployed:
  - listings:list
  - listings:get
  - listings:search
  - listings:create
  - listings:update
  - listings:remove
  (and more...)
✔ Watching for changes...
```

---

**Once you complete Steps 1-4, let me know and we'll continue with the migration!** 🚀

The next phase will be creating the booking, review, and messaging functions, then updating your React components to use Convex instead of Supabase.
