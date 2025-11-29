/**
 * Availability Rules Management
 *
 * CRUD operations for vendor availability rules (recurring and one-time).
 * Vendors use these to define when their services are available for booking.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserId, requireVendor } from "../lib/auth";

// ============================================
// CREATE AVAILABILITY RULE
// ============================================

export const create = mutation({
  args: {
    listingId: v.id("listings"),
    name: v.string(),
    ruleType: v.union(v.literal("recurring"), v.literal("one-time")),
    // Recurring pattern (optional, for recurring rules)
    pattern: v.optional(v.object({
      frequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly")
      ),
      daysOfWeek: v.array(v.number()),
      startTime: v.string(),
      duration: v.number(),
    })),
    // One-time details (optional, for one-time rules)
    oneTimeDate: v.optional(v.string()),
    oneTimeStartTime: v.optional(v.string()),
    oneTimeDuration: v.optional(v.number()),
    // Capacity and settings
    capacity: v.number(),
    bookingDeadlineHours: v.number(),
    generateDaysInAdvance: v.union(v.number(), v.literal("indefinite")),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's ID
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    // Verify the listing exists and belongs to the vendor
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (listing.vendorId !== userId) {
      throw new Error("You can only create rules for your own listings");
    }

    // Validate rule data based on type
    if (args.ruleType === "recurring") {
      if (!args.pattern) {
        throw new Error("Pattern is required for recurring rules");
      }
      if (args.pattern.daysOfWeek.length === 0) {
        throw new Error("At least one day of week is required");
      }
    } else {
      // one-time rule
      if (!args.oneTimeDate || !args.oneTimeStartTime || !args.oneTimeDuration) {
        throw new Error("Date, start time, and duration are required for one-time rules");
      }
    }

    const now = Date.now();

    // Create the availability rule
    const ruleId = await ctx.db.insert("availabilityRules", {
      listingId: args.listingId,
      vendorId: userId,
      name: args.name,
      ruleType: args.ruleType,
      pattern: args.pattern,
      oneTimeDate: args.oneTimeDate,
      oneTimeStartTime: args.oneTimeStartTime,
      oneTimeDuration: args.oneTimeDuration,
      capacity: args.capacity,
      bookingDeadlineHours: args.bookingDeadlineHours,
      generateDaysInAdvance: args.generateDaysInAdvance,
      active: args.active,
      createdAt: now,
      updatedAt: now,
    });

    return ruleId;
  },
});

// ============================================
// UPDATE AVAILABILITY RULE
// ============================================

export const update = mutation({
  args: {
    ruleId: v.id("availabilityRules"),
    // Optional fields that can be updated
    name: v.optional(v.string()),
    pattern: v.optional(v.object({
      frequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly")
      ),
      daysOfWeek: v.array(v.number()),
      startTime: v.string(),
      duration: v.number(),
    })),
    oneTimeDate: v.optional(v.string()),
    oneTimeStartTime: v.optional(v.string()),
    oneTimeDuration: v.optional(v.number()),
    capacity: v.optional(v.number()),
    bookingDeadlineHours: v.optional(v.number()),
    generateDaysInAdvance: v.optional(v.union(v.number(), v.literal("indefinite"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Rule not found");
    }

    // Verify ownership
    if (rule.vendorId !== userId) {
      throw new Error("You can only update your own rules");
    }

    // Build update object with only provided fields
    const updates: Partial<Doc<"availabilityRules">> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.pattern !== undefined) updates.pattern = args.pattern;
    if (args.oneTimeDate !== undefined) updates.oneTimeDate = args.oneTimeDate;
    if (args.oneTimeStartTime !== undefined) updates.oneTimeStartTime = args.oneTimeStartTime;
    if (args.oneTimeDuration !== undefined) updates.oneTimeDuration = args.oneTimeDuration;
    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.bookingDeadlineHours !== undefined) updates.bookingDeadlineHours = args.bookingDeadlineHours;
    if (args.generateDaysInAdvance !== undefined) updates.generateDaysInAdvance = args.generateDaysInAdvance;
    if (args.active !== undefined) updates.active = args.active;

    await ctx.db.patch(args.ruleId, updates);

    return args.ruleId;
  },
});

// ============================================
// DELETE AVAILABILITY RULE
// ============================================

export const remove = mutation({
  args: {
    ruleId: v.id("availabilityRules"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Rule not found");
    }

    // Verify ownership
    if (rule.vendorId !== userId) {
      throw new Error("You can only delete your own rules");
    }

    // Delete all future slots generated from this rule
    const slots = await ctx.db
      .query("slots")
      .withIndex("by_listing", (q) => q.eq("listingId", rule.listingId))
      .filter((q) => q.eq(q.field("ruleId"), args.ruleId))
      .collect();

    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];

    for (const slot of slots) {
      // Only delete future slots with no bookings
      if (slot.date >= today && slot.booked === 0) {
        await ctx.db.delete(slot._id);
      }
    }

    // Delete the rule
    await ctx.db.delete(args.ruleId);

    return { success: true };
  },
});

// ============================================
// GET RULES FOR LISTING
// ============================================

export const getByListing = query({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("availabilityRules")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    return rules;
  },
});

// ============================================
// GET RULES FOR VENDOR
// ============================================

export const getByVendor = query({
  args: {
    vendorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("availabilityRules")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .collect();

    return rules;
  },
});

// ============================================
// GET ACTIVE RULES FOR LISTING
// ============================================

export const getActiveByListing = query({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("availabilityRules")
      .withIndex("by_listing_and_active", (q) =>
        q.eq("listingId", args.listingId).eq("active", true)
      )
      .collect();

    return rules;
  },
});

// ============================================
// GET SINGLE RULE
// ============================================

export const get = query({
  args: {
    ruleId: v.id("availabilityRules"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    return rule;
  },
});

// ============================================
// TOGGLE RULE ACTIVE STATUS
// ============================================

export const toggleActive = mutation({
  args: {
    ruleId: v.id("availabilityRules"),
    vendorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Rule not found");
    }

    // Verify ownership
    if (rule.vendorId !== args.vendorId) {
      throw new Error("You can only modify your own rules");
    }

    await ctx.db.patch(args.ruleId, {
      active: !rule.active,
      updatedAt: Date.now(),
    });

    return { success: true, active: !rule.active };
  },
});
