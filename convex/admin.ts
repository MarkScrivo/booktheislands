/**
 * Admin Functions
 * User management and password reset functionality
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { Scrypt } from "lucia";

/**
 * Get all users (admin only)
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get all users
    const users = await ctx.db.query("users").collect();

    // Get profiles for each user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();

        return {
          _id: user._id,
          email: user.email,
          name: user.name || profile?.fullName || null,
          role: profile?.role || "customer",
          createdAt: user._creationTime,
        };
      })
    );

    return usersWithProfiles.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Reset a user's password (admin only)
 */
export const resetUserPassword = mutation({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Find the user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Find the password auth account
    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.userId).eq("provider", "password")
      )
      .first();

    if (!authAccount) {
      throw new Error("No password account found for this user");
    }

    // Hash the password using Scrypt (same as Convex Auth uses)
    const hashedPassword = await new Scrypt().hash(args.newPassword);

    // Update the auth account
    await ctx.db.patch(authAccount._id, {
      secret: hashedPassword,
    });

    return {
      success: true,
      message: `Password reset for ${user.email}`,
    };
  },
});

/**
 * Make a user an admin (admin only)
 */
export const makeAdmin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      role: "admin",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
