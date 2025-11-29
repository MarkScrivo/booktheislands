-- ============================================
-- Change User Role (Customer → Vendor → Admin)
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- OPTION 1: Change by email
-- Replace 'user@example.com' with the actual email
UPDATE profiles
SET role = 'vendor'  -- Change to: 'customer', 'vendor', or 'admin'
WHERE email = 'user@example.com';

-- OPTION 2: Change by user ID
-- Replace 'user-uuid-here' with the actual UUID
-- UPDATE profiles
-- SET role = 'vendor'
-- WHERE id = 'user-uuid-here';

-- OPTION 3: See all users and their current roles
SELECT
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles
ORDER BY created_at DESC;

-- ============================================
-- EXAMPLES
-- ============================================

-- Make someone a vendor:
-- UPDATE profiles SET role = 'vendor' WHERE email = 'john@example.com';

-- Make someone an admin:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- Make someone a customer again:
-- UPDATE profiles SET role = 'customer' WHERE email = 'jane@example.com';

-- ============================================
-- VERIFICATION
-- ============================================

-- After running UPDATE, verify the change:
SELECT email, role FROM profiles WHERE email = 'user@example.com';
