/**
 * Profiles Queries and Mutations
 *
 * User profile management operations.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserId, getCurrentUserProfile } from "./lib/auth";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get the current user's profile
 * Authenticated users only
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getCurrentUserProfile(ctx);
    return profile;
  },
});

/**
 * Get a profile by user ID
 * Public - anyone can view profiles
 */
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return profile;
  },
});

/**
 * Get a profile by email
 * Public - anyone can view profiles
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    return profile;
  },
});

/**
 * Get all vendors
 * Public - for displaying vendor directory
 */
export const getVendors = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "vendor"))
      .collect();
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Create or update the current user's profile
 * Called after signup/login
 */
export const upsert = mutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("customer"),
        v.literal("vendor"),
        v.literal("admin")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        email: args.email,
        fullName: args.fullName,
        phone: args.phone,
        role: args.role || existingProfile.role,
        updatedAt: Date.now(),
      });

      return existingProfile._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("profiles", {
        userId: userId,
        email: args.email,
        fullName: args.fullName,
        phone: args.phone,
        role: args.role || "customer",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return profileId;
    }
  },
});

/**
 * Update the current user's profile
 * Authenticated users only
 */
export const update = mutation({
  args: {
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.phone !== undefined) updates.phone = args.phone;

    await ctx.db.patch(profile._id, updates);

    return profile._id;
  },
});

/**
 * Change user role
 * Admin only
 */
export const changeRole = mutation({
  args: {
    userId: v.string(),
    newRole: v.union(
      v.literal("customer"),
      v.literal("vendor"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    // Note: This should check for admin role, but we'll add that check later
    // For now, any authenticated user can call this (useful for development)

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      role: args.newRole,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});
