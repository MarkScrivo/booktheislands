/**
 * Fix orphaned users who don't have profiles
 * Run this once to create profiles for users missing them
 */

import { mutation } from "./_generated/server";

export const fixOrphanedUsers = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all users from auth tables
    const allUsers = await ctx.db.query("users").collect();

    console.log(`Found ${allUsers.length} total users`);

    let fixed = 0;

    for (const user of allUsers) {
      // Check if profile exists
      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();

      if (!existingProfile) {
        console.log(`Creating profile for user ${user._id} (${user.email})`);

        // Create missing profile
        await ctx.db.insert("profiles", {
          userId: user._id,
          email: user.email ?? "",
          fullName: user.name ?? "Traveler",
          role: "customer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        fixed++;
      }
    }

    console.log(`Fixed ${fixed} orphaned users`);
    return { total: allUsers.length, fixed };
  },
});
