# Quick Start - Fresh Supabase Setup

## TL;DR (Copy/Paste Checklist)

### 1. Create Project
- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New Project"
- [ ] Name: `discover-phangan-v2`
- [ ] Wait 2-3 minutes

### 2. Get Keys
- [ ] Settings → API
- [ ] Copy **Project URL**
- [ ] Copy **anon public** key

### 3. Update .env.local
```env
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...YOUR_NEW_KEY
```

### 4. Run Schema Script
- [ ] SQL Editor → New query
- [ ] Copy/paste ALL of `FRESH_SUPABASE_SCHEMA.sql`
- [ ] Click Run
- [ ] Wait for "✅ DATABASE SETUP COMPLETE!"

### 5. Restart Everything
```bash
# In terminal
Ctrl+C  # Stop server
npm run dev  # Restart

# In browser console (F12)
localStorage.clear(); sessionStorage.clear(); location.reload();
```

### 6. Test
- [ ] Open http://localhost:3001
- [ ] See 5 listings load in <1 second
- [ ] No timeouts in console
- [ ] ✅ Success!

---

## Time Estimate: 7 minutes ⏱️

---

**Full Guide**: See `FRESH_SUPABASE_SETUP.md`
**Schema**: See `FRESH_SUPABASE_SCHEMA.sql`
