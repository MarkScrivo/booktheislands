/**
 * Slots Management
 *
 * Functions for managing bookable time slots, including generation from rules,
 * manual blocking/unblocking, and cancellation.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";
import { getCurrentUserId, requireVendor } from "../lib/auth";

// ============================================
// GENERATE SLOTS FROM RULE
// ============================================

/**
 * Generate slots from an availability rule for a date range
 * Called by cron job or manually by vendor
 */
export const generateFromRule = internalMutation({
  args: {
    ruleId: v.id("availabilityRules"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || !rule.active) {
      return { generated: 0 };
    }

    const slotsGenerated: Id<"slots">[] = [];

    if (rule.ruleType === "recurring" && rule.pattern) {
      // Generate recurring slots
      const { frequency, daysOfWeek, startTime, duration } = rule.pattern;

      const startDate = new Date(args.startDate);
      const endDate = new Date(args.endDate);
      const current = new Date(startDate);

      while (current <= endDate) {
        const dayOfWeek = current.getDay() || 7; // Convert Sunday from 0 to 7
        const dateString = current.toISOString().split('T')[0];

        // Check if this day matches the pattern
        let shouldGenerate = false;

        if (frequency === "daily") {
          shouldGenerate = true;
        } else if (frequency === "weekly") {
          shouldGenerate = daysOfWeek.includes(dayOfWeek);
        } else if (frequency === "monthly") {
          // For monthly, use day of month
          const dayOfMonth = current.getDate();
          shouldGenerate = daysOfWeek.includes(dayOfMonth);
        }

        if (shouldGenerate) {
          // Check if slot already exists
          const existing = await ctx.db
            .query("slots")
            .withIndex("by_listing_date_time", (q) =>
              q
                .eq("listingId", rule.listingId)
                .eq("date", dateString)
                .eq("startTime", startTime)
            )
            .first();

          if (!existing) {
            // Calculate end time
            const [hours, minutes] = startTime.split(':').map(Number);
            const endMinutes = hours * 60 + minutes + duration;
            const endHours = Math.floor(endMinutes / 60);
            const endMins = endMinutes % 60;
            const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

            // Calculate booking deadline timestamp
            const slotDateTime = new Date(`${dateString}T${startTime}:00`);
            const bookingDeadline = slotDateTime.getTime() - (rule.bookingDeadlineHours * 60 * 60 * 1000);

            const now = Date.now();

            const slotId = await ctx.db.insert("slots", {
              listingId: rule.listingId,
              vendorId: rule.vendorId,
              ruleId: args.ruleId,
              date: dateString,
              startTime,
              endTime,
              capacity: rule.capacity,
              booked: 0,
              available: rule.capacity,
              status: "active",
              bookingDeadline,
              createdAt: now,
              updatedAt: now,
            });

            slotsGenerated.push(slotId);
          }
        }

        // Move to next day
        current.setDate(current.getDate() + 1);
      }
    } else if (rule.ruleType === "one-time") {
      // Generate single one-time slot
      if (!rule.oneTimeDate || !rule.oneTimeStartTime || !rule.oneTimeDuration) {
        throw new Error("One-time rule missing required fields");
      }

      // Check if slot already exists
      const existing = await ctx.db
        .query("slots")
        .withIndex("by_listing_date_time", (q) =>
          q
            .eq("listingId", rule.listingId)
            .eq("date", rule.oneTimeDate!)
            .eq("startTime", rule.oneTimeStartTime!)
        )
        .first();

      if (!existing) {
        // Calculate end time
        const [hours, minutes] = rule.oneTimeStartTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + rule.oneTimeDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

        // Calculate booking deadline timestamp
        const slotDateTime = new Date(`${rule.oneTimeDate}T${rule.oneTimeStartTime}:00`);
        const bookingDeadline = slotDateTime.getTime() - (rule.bookingDeadlineHours * 60 * 60 * 1000);

        const now = Date.now();

        const slotId = await ctx.db.insert("slots", {
          listingId: rule.listingId,
          vendorId: rule.vendorId,
          ruleId: args.ruleId,
          date: rule.oneTimeDate,
          startTime: rule.oneTimeStartTime,
          endTime,
          capacity: rule.capacity,
          booked: 0,
          available: rule.capacity,
          status: "active",
          bookingDeadline,
          createdAt: now,
          updatedAt: now,
        });

        slotsGenerated.push(slotId);
      }
    }

    return { generated: slotsGenerated.length, slotIds: slotsGenerated };
  },
});

// ============================================
// GENERATE SLOTS (PUBLIC MUTATION FOR VENDORS)
// ============================================

/**
 * Public mutation allowing vendors to manually generate slots from their rules
 * Automatically called after rule creation/update
 */
export const generateSlotsFromRule = mutation({
  args: {
    ruleId: v.id("availabilityRules"),
    daysInAdvance: v.optional(v.number()), // If not provided, uses rule's generateDaysInAdvance
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    // Get the rule and verify ownership
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Availability rule not found");
    }
    if (rule.vendorId !== userId) {
      throw new Error("You can only generate slots for your own rules");
    }

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = today.toISOString().split('T')[0];

    // Handle generateDaysInAdvance - default to 30 if 'indefinite' or not specified
    let daysToGenerate = args.daysInAdvance || rule.generateDaysInAdvance;
    if (typeof daysToGenerate !== 'number' || daysToGenerate < 1) {
      daysToGenerate = 30; // Default to 30 days
    }

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysToGenerate);
    const endDateString = endDate.toISOString().split('T')[0];

    // Call the internal mutation
    const result = await ctx.scheduler.runAfter(0, internal.availability.slots.generateFromRule, {
      ruleId: args.ruleId,
      startDate,
      endDate: endDateString,
    });

    return {
      success: true,
      startDate,
      endDate: endDateString,
      daysGenerated: daysToGenerate,
    };
  },
});

// ============================================
// CREATE MANUAL SLOT
// ============================================

export const createManual = mutation({
  args: {
    listingId: v.id("listings"),
    vendorId: v.string(),
    date: v.string(),
    startTime: v.string(),
    duration: v.number(), // minutes
    capacity: v.number(),
    bookingDeadlineHours: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify listing ownership
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (listing.vendorId !== args.vendorId) {
      throw new Error("You can only create slots for your own listings");
    }

    // Calculate end time
    const [hours, minutes] = args.startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + args.duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    // Calculate booking deadline
    const slotDateTime = new Date(`${args.date}T${args.startTime}:00`);
    const bookingDeadline = slotDateTime.getTime() - (args.bookingDeadlineHours * 60 * 60 * 1000);

    // Check if slot already exists
    const existing = await ctx.db
      .query("slots")
      .withIndex("by_listing_date_time", (q) =>
        q
          .eq("listingId", args.listingId)
          .eq("date", args.date)
          .eq("startTime", args.startTime)
      )
      .first();

    if (existing) {
      throw new Error("A slot already exists for this date and time");
    }

    const now = Date.now();

    const slotId = await ctx.db.insert("slots", {
      listingId: args.listingId,
      vendorId: args.vendorId,
      // No ruleId - this is a manual slot
      date: args.date,
      startTime: args.startTime,
      endTime,
      capacity: args.capacity,
      booked: 0,
      available: args.capacity,
      status: "active",
      bookingDeadline,
      createdAt: now,
      updatedAt: now,
    });

    return slotId;
  },
});

// ============================================
// BLOCK SLOT
// ============================================

export const block = mutation({
  args: {
    slotId: v.id("slots"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    // Verify ownership
    if (slot.vendorId !== userId) {
      throw new Error("You can only block your own slots");
    }

    // Can't block if there are bookings
    if (slot.booked > 0) {
      throw new Error("Cannot block a slot with existing bookings. Cancel the slot instead.");
    }

    await ctx.db.patch(args.slotId, {
      status: "blocked",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// UNBLOCK SLOT
// ============================================

export const unblock = mutation({
  args: {
    slotId: v.id("slots"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    // Verify ownership
    if (slot.vendorId !== userId) {
      throw new Error("You can only unblock your own slots");
    }

    if (slot.status !== "blocked") {
      throw new Error("Slot is not blocked");
    }

    await ctx.db.patch(args.slotId, {
      status: "active",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// CANCEL SLOT (with bookings)
// ============================================

export const cancel = mutation({
  args: {
    slotId: v.id("slots"),
    reason: v.union(
      v.literal("weather"),
      v.literal("emergency"),
      v.literal("personal"),
      v.literal("other")
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await requireVendor(ctx);

    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    // Verify ownership
    if (slot.vendorId !== userId) {
      throw new Error("You can only cancel your own slots");
    }

    // Update slot status
    await ctx.db.patch(args.slotId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancellationReason: args.reason,
      cancellationMessage: args.message,
      updatedAt: Date.now(),
    });

    // Get all bookings for this slot
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_slot", (q) => q.eq("slotId", args.slotId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "pending")
        )
      )
      .collect();

    // Get listing details for notifications
    const listing = await ctx.db.get(slot.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Cancel each booking and send notifications
    for (const booking of bookings) {
      await ctx.db.patch(booking._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: userId,
        cancellationReason: args.reason,
        cancellationMessage: args.message,
        updatedAt: Date.now(),
      });

      // Send in-app notification
      await ctx.scheduler.runAfter(0, internal.notifications.inApp.notifyBookingCancelled, {
        userId: booking.customerId,
        listingTitle: listing.title,
        slotDate: slot.date,
        slotTime: slot.startTime,
        reason: args.reason,
        message: args.message,
        listingId: slot.listingId,
        bookingId: booking._id,
      });

      // Send email notification
      await ctx.scheduler.runAfter(0, internal.notifications.email.sendBookingCancelled, {
        to: booking.customerEmail,
        customerName: booking.customerName,
        listingTitle: listing.title,
        slotDate: slot.date,
        slotTime: slot.startTime,
        reason: args.reason,
        vendorMessage: args.message,
      });

      // TODO: Trigger refund via Stripe (will implement when integrating with payments)
    }

    return {
      success: true,
      bookingsCancelled: bookings.length,
    };
  },
});

// ============================================
// GET SLOTS FOR LISTING
// ============================================

export const getByListing = query({
  args: {
    listingId: v.id("listings"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("blocked"),
      v.literal("cancelled"),
      v.literal("completed")
    )),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("slots")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId));

    let slots = await query.collect();

    // Apply filters
    if (args.startDate) {
      slots = slots.filter((s) => s.date >= args.startDate!);
    }
    if (args.endDate) {
      slots = slots.filter((s) => s.date <= args.endDate!);
    }
    if (args.status) {
      slots = slots.filter((s) => s.status === args.status);
    }

    // Sort by date and time
    slots.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    return slots;
  },
});

// ============================================
// GET AVAILABLE SLOTS FOR BOOKING
// ============================================

export const getAvailableForBooking = query({
  args: {
    listingId: v.id("listings"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const slots = await ctx.db
      .query("slots")
      .withIndex("by_listing_and_date", (q) =>
        q.eq("listingId", args.listingId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate),
          q.gt(q.field("available"), 0),
          q.gt(q.field("bookingDeadline"), now) // Deadline not passed
        )
      )
      .collect();

    // Sort by date and time
    slots.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    return slots;
  },
});

// ============================================
// GET SINGLE SLOT
// ============================================

export const get = query({
  args: {
    slotId: v.id("slots"),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    return slot;
  },
});

// ============================================
// DECREMENT SLOT AVAILABILITY (internal)
// ============================================

export const decrementAvailability = internalMutation({
  args: {
    slotId: v.id("slots"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    if (slot.available < args.amount) {
      throw new Error("Not enough availability");
    }

    await ctx.db.patch(args.slotId, {
      booked: slot.booked + args.amount,
      available: slot.available - args.amount,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// INCREMENT SLOT AVAILABILITY (internal)
// ============================================

export const incrementAvailability = internalMutation({
  args: {
    slotId: v.id("slots"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Slot not found");
    }

    await ctx.db.patch(args.slotId, {
      booked: Math.max(0, slot.booked - args.amount),
      available: Math.min(slot.capacity, slot.available + args.amount),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
