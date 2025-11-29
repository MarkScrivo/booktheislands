/**
 * In-App Notifications
 *
 * Functions for creating and managing in-app notifications for users.
 * Used for waitlist updates, booking cancellations, and reminders.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ============================================
// CREATE NOTIFICATION (internal)
// ============================================

export const create = internalMutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal("waitlist_spot_available"),
      v.literal("booking_cancelled_by_vendor"),
      v.literal("booking_confirmed"),
      v.literal("booking_reminder"),
      v.literal("new_sale")
    ),
    title: v.string(),
    message: v.string(),
    listingId: v.optional(v.id("listings")),
    bookingId: v.optional(v.id("bookings")),
    slotId: v.optional(v.id("slots")),
    waitlistId: v.optional(v.id("waitlist")),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      listingId: args.listingId,
      bookingId: args.bookingId,
      slotId: args.slotId,
      waitlistId: args.waitlistId,
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

// ============================================
// WAITLIST SPOT AVAILABLE NOTIFICATION
// ============================================

export const notifyWaitlistSpotAvailable = internalMutation({
  args: {
    userId: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    listingId: v.id("listings"),
    slotId: v.id("slots"),
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "waitlist_spot_available",
      title: "Spot Available!",
      message: `A spot opened up for ${args.listingTitle} on ${formattedDate} at ${args.slotTime}. Book now before it's gone!`,
      listingId: args.listingId,
      slotId: args.slotId,
      waitlistId: args.waitlistId,
      actionUrl: `/listings/${args.listingId}`,
      actionLabel: "Book Now",
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// BOOKING CANCELLED NOTIFICATION
// ============================================

export const notifyBookingCancelled = internalMutation({
  args: {
    userId: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    reason: v.string(),
    message: v.optional(v.string()),
    listingId: v.id("listings"),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    let reasonText = '';
    switch (args.reason) {
      case 'weather':
        reasonText = 'due to weather conditions';
        break;
      case 'emergency':
        reasonText = 'due to an emergency';
        break;
      case 'personal':
        reasonText = 'due to personal reasons';
        break;
      default:
        reasonText = '';
    }

    const messageText = `Your booking for ${args.listingTitle} on ${formattedDate} at ${args.slotTime} has been cancelled by the vendor ${reasonText}. You will receive a full refund.${
      args.message ? `\n\nVendor message: ${args.message}` : ''
    }`;

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "booking_cancelled_by_vendor",
      title: "Booking Cancelled",
      message: messageText,
      listingId: args.listingId,
      bookingId: args.bookingId,
      actionUrl: `/bookings`,
      actionLabel: "View Bookings",
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// BOOKING CONFIRMED NOTIFICATION
// ============================================

export const notifyBookingConfirmed = internalMutation({
  args: {
    userId: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    listingId: v.id("listings"),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "booking_confirmed",
      title: "Booking Confirmed!",
      message: `Your booking for ${args.listingTitle} on ${formattedDate} at ${args.slotTime} is confirmed. Get ready for your experience!`,
      listingId: args.listingId,
      bookingId: args.bookingId,
      actionUrl: `/bookings/${args.bookingId}`,
      actionLabel: "View Details",
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// GET USER NOTIFICATIONS
// ============================================

export const getByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc"); // Most recent first

    let notifications = await query.collect();

    if (args.limit) {
      notifications = notifications.slice(0, args.limit);
    }

    return notifications;
  },
});

// ============================================
// GET UNREAD COUNT
// ============================================

export const getUnreadCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

// ============================================
// MARK AS READ
// ============================================

export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    // Verify ownership
    if (notification.userId !== args.userId) {
      throw new Error("You can only mark your own notifications as read");
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// MARK ALL AS READ
// ============================================

export const markAllAsRead = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect();

    const now = Date.now();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
    }

    return { success: true, count: unread.length };
  },
});

// ============================================
// DELETE NOTIFICATION
// ============================================

export const remove = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    // Verify ownership
    if (notification.userId !== args.userId) {
      throw new Error("You can only delete your own notifications");
    }

    await ctx.db.delete(args.notificationId);

    return { success: true };
  },
});

// ============================================
// DELETE ALL READ
// ============================================

export const deleteAllRead = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const read = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", args.userId).eq("isRead", true)
      )
      .collect();

    for (const notification of read) {
      await ctx.db.delete(notification._id);
    }

    return { success: true, count: read.length };
  },
});

// ============================================
// NEW SALE NOTIFICATION (for vendors)
// ============================================

export const notifyNewSale = internalMutation({
  args: {
    vendorId: v.string(),
    customerName: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    guests: v.number(),
    totalAmount: v.number(),
    listingId: v.id("listings"),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    await ctx.db.insert("notifications", {
      userId: args.vendorId,
      type: "new_sale",
      title: "New Booking!",
      message: `${args.customerName} booked ${args.listingTitle} for ${formattedDate} at ${args.slotTime}. ${args.guests} guest${args.guests > 1 ? 's' : ''} - ฿${args.totalAmount.toLocaleString()}`,
      listingId: args.listingId,
      bookingId: args.bookingId,
      actionUrl: `/vendor/bookings`,
      actionLabel: "View Booking",
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
