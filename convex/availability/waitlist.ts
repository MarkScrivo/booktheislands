/**
 * Waitlist Management
 *
 * Functions for managing customer waitlists when slots are full.
 * FIFO queue with email/in-app notifications when spots open up.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

// ============================================
// JOIN WAITLIST
// ============================================

export const join = mutation({
  args: {
    slotId: v.id("slots"),
    customerId: v.string(),
    customerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify slot exists
    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    // Check if slot is actually full
    if (slot.available > 0) {
      throw new Error("Slot has availability. Book directly instead of joining waitlist.");
    }

    // Check if customer is already on waitlist for this slot
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_slot_and_status", (q) =>
        q.eq("slotId", args.slotId).eq("status", "waiting")
      )
      .filter((q) => q.eq(q.field("customerId"), args.customerId))
      .first();

    if (existing) {
      throw new Error("You are already on the waitlist for this slot");
    }

    const now = Date.now();

    // Add to waitlist
    const waitlistId = await ctx.db.insert("waitlist", {
      slotId: args.slotId,
      listingId: slot.listingId,
      customerId: args.customerId,
      customerEmail: args.customerEmail,
      joinedAt: now,
      notified: false,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    });

    return waitlistId;
  },
});

// ============================================
// LEAVE WAITLIST
// ============================================

export const leave = mutation({
  args: {
    waitlistId: v.id("waitlist"),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.waitlistId);
    if (!entry) {
      throw new Error("Waitlist entry not found");
    }

    // Verify ownership
    if (entry.customerId !== args.customerId) {
      throw new Error("You can only leave your own waitlist entries");
    }

    // Remove from waitlist
    await ctx.db.delete(args.waitlistId);

    return { success: true };
  },
});

// ============================================
// NOTIFY NEXT IN WAITLIST (internal)
// ============================================

/**
 * Called when a spot opens up in a slot.
 * Notifies the next person in the FIFO queue.
 */
export const notifyNext = internalMutation({
  args: {
    slotId: v.id("slots"),
  },
  handler: async (ctx, args) => {
    // Get the slot
    const slot = await ctx.db.get(args.slotId);
    if (!slot || slot.available <= 0) {
      return { notified: false };
    }

    // Find the next waiting customer (FIFO - earliest joinedAt)
    const nextEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_slot_joined", (q) => q.eq("slotId", args.slotId))
      .filter((q) => q.eq(q.field("status"), "waiting"))
      .order("asc") // Order by joinedAt ascending (FIFO)
      .first();

    if (!nextEntry) {
      return { notified: false };
    }

    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

    // Update waitlist entry to notified
    await ctx.db.patch(nextEntry._id, {
      notified: true,
      notifiedAt: now,
      status: "notified",
      expiresAt,
      updatedAt: now,
    });

    // Get listing details for notifications
    const listing = await ctx.db.get(nextEntry.listingId);
    if (!listing) {
      return { notified: false };
    }

    // Get customer profile for name
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", nextEntry.customerId))
      .first();

    const customerName = profile?.fullName || "Customer";

    // Send in-app notification
    await ctx.scheduler.runAfter(0, internal.notifications.inApp.notifyWaitlistSpotAvailable, {
      userId: nextEntry.customerId,
      listingTitle: listing.title,
      slotDate: slot.date,
      slotTime: slot.startTime,
      listingId: slot.listingId,
      slotId: args.slotId,
      waitlistId: nextEntry._id,
    });

    // Send email notification
    await ctx.scheduler.runAfter(0, internal.notifications.email.sendWaitlistSpotAvailable, {
      to: nextEntry.customerEmail,
      customerName,
      listingTitle: listing.title,
      listingId: slot.listingId.toString(),
      slotDate: slot.date,
      slotTime: slot.startTime,
      expiresAt,
    });

    return {
      notified: true,
      customerId: nextEntry.customerId,
      customerEmail: nextEntry.customerEmail,
      waitlistId: nextEntry._id,
    };
  },
});

// ============================================
// MARK AS BOOKED (internal)
// ============================================

/**
 * Called when a notified customer successfully books the slot
 */
export const markAsBooked = internalMutation({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.waitlistId);
    if (!entry) {
      throw new Error("Waitlist entry not found");
    }

    await ctx.db.patch(args.waitlistId, {
      status: "booked",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// EXPIRE STALE NOTIFICATIONS (internal)
// ============================================

/**
 * Called by cron job to expire notifications that are past 24 hours
 * and notify the next person in line
 */
export const expireStaleNotifications = internalMutation({
  args: {},
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find all notified entries that have expired
    const expiredEntries = await ctx.db
      .query("waitlist")
      .withIndex("by_status", (q) => q.eq("status", "notified"))
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), undefined),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .collect();

    const expiredCount = expiredEntries.length;
    const slotsToNotify = new Set<Id<"slots">>();

    for (const entry of expiredEntries) {
      // Mark as expired
      await ctx.db.patch(entry._id, {
        status: "expired",
        updatedAt: now,
      });

      // Track which slots need new notifications
      slotsToNotify.add(entry.slotId);
    }

    // Notify next person for each affected slot
    // Note: We'll need to call notifyNext separately for each slot
    // This will be handled by the cron job

    return {
      expired: expiredCount,
      slotsNeedingNotification: Array.from(slotsToNotify),
    };
  },
});

// ============================================
// GET WAITLIST FOR SLOT
// ============================================

export const getBySlot = query({
  args: {
    slotId: v.id("slots"),
    status: v.optional(v.union(
      v.literal("waiting"),
      v.literal("notified"),
      v.literal("expired"),
      v.literal("booked")
    )),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("waitlist")
      .withIndex("by_slot", (q) => q.eq("slotId", args.slotId));

    let entries = await query.collect();

    if (args.status) {
      entries = entries.filter((e) => e.status === args.status);
    }

    // Sort by FIFO (joinedAt)
    entries.sort((a, b) => a.joinedAt - b.joinedAt);

    return entries;
  },
});

// ============================================
// GET CUSTOMER'S WAITLIST ENTRIES
// ============================================

export const getByCustomer = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    // Sort by most recent first
    entries.sort((a, b) => b.joinedAt - a.joinedAt);

    return entries;
  },
});

// ============================================
// GET WAITLIST POSITION
// ============================================

export const getPosition = query({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.waitlistId);
    if (!entry) {
      return null;
    }

    // Get all waiting entries for this slot that joined before this one
    const earlierEntries = await ctx.db
      .query("waitlist")
      .withIndex("by_slot_and_status", (q) =>
        q.eq("slotId", entry.slotId).eq("status", "waiting")
      )
      .filter((q) => q.lt(q.field("joinedAt"), entry.joinedAt))
      .collect();

    // Position is number of people ahead + 1
    const position = earlierEntries.length + 1;

    // Get total waitlist size
    const totalWaiting = await ctx.db
      .query("waitlist")
      .withIndex("by_slot_and_status", (q) =>
        q.eq("slotId", entry.slotId).eq("status", "waiting")
      )
      .collect();

    return {
      position,
      total: totalWaiting.length,
    };
  },
});

// ============================================
// CHECK IF CUSTOMER IS ON WAITLIST
// ============================================

export const isCustomerOnWaitlist = query({
  args: {
    slotId: v.id("slots"),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_slot_and_status", (q) =>
        q.eq("slotId", args.slotId).eq("status", "waiting")
      )
      .filter((q) => q.eq(q.field("customerId"), args.customerId))
      .first();

    if (!entry) {
      return { onWaitlist: false };
    }

    // Get position
    const positionInfo = await ctx.runQuery(internal.availability.waitlist.getPosition, {
      waitlistId: entry._id,
    });

    return {
      onWaitlist: true,
      waitlistId: entry._id,
      position: positionInfo?.position,
      total: positionInfo?.total,
    };
  },
});
