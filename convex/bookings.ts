/**
 * Bookings Queries and Mutations
 *
 * All operations for managing bookings on the platform.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  getCurrentUserId,
  requireUserProfile,
  isAdmin,
  isVendor,
} from "./lib/auth";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get the current user's bookings (as a customer)
 * Customer-only
 */
export const myBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    return await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get bookings for the current vendor's listings
 * Vendor-only
 */
export const vendorBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    return await ctx.db
      .query("bookings")
      .withIndex("by_vendor", (q) => q.eq("vendorId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get all bookings for a specific listing
 * Vendor/Admin only
 */
export const getByListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const adminUser = await isAdmin(ctx);

    // Get the listing to check ownership
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Check if user is vendor of this listing or admin
    if (listing.vendorId !== userId && !adminUser) {
      throw new Error("Unauthorized: You can only view bookings for your own listings");
    }

    return await ctx.db
      .query("bookings")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .collect();
  },
});

/**
 * Get bookings for a specific date (for availability checking)
 * Public - needed for showing availability to customers
 */
export const getByListingAndDate = query({
  args: {
    listingId: v.id("listings"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_listing_and_date", (q) =>
        q.eq("listingId", args.listingId).eq("bookingDate", args.date)
      )
      .collect();
  },
});

/**
 * Get availability summary for next 30 days for all listings
 * Public - used by AI chatbot to answer availability questions
 */
export const getAvailabilityNext30Days = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Get all bookings in the next 30 days
    const allBookings = await ctx.db.query("bookings").collect();

    // Filter bookings within next 30 days
    const upcomingBookings = allBookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= today && bookingDate <= thirtyDaysFromNow;
    });

    // Get all listings to check capacity
    const listings = await ctx.db.query("listings").collect();
    const listingMap = new Map(listings.map(l => [l._id, l]));

    // Initialize availability map with ALL dates for ALL listings as available
    const availabilityMap: Record<string, Record<string, { booked: number; capacity: number; available: number }>> = {};

    // Pre-populate all listings with all dates in next 30 days as fully available
    listings.forEach(listing => {
      availabilityMap[listing._id] = {};

      // Generate all dates in the next 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

        availabilityMap[listing._id][dateStr] = {
          booked: 0,
          capacity: listing.maxCapacity,
          available: listing.maxCapacity
        };
      }
    });

    // Now subtract bookings from availability
    upcomingBookings.forEach(booking => {
      const listing = listingMap.get(booking.listingId);
      if (!listing) return;

      if (availabilityMap[booking.listingId] && availabilityMap[booking.listingId][booking.bookingDate]) {
        availabilityMap[booking.listingId][booking.bookingDate].booked += booking.guests;
        availabilityMap[booking.listingId][booking.bookingDate].available =
          listing.maxCapacity - availabilityMap[booking.listingId][booking.bookingDate].booked;
      }
    });

    return availabilityMap;
  },
});

/**
 * Get a single booking by ID
 * Customer (if owns) or Vendor (if owns listing) or Admin
 */
export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const booking = await ctx.db.get(args.id);

    if (!booking) {
      throw new Error("Booking not found");
    }

    const adminUser = await isAdmin(ctx);

    // Check access: customer, vendor, or admin
    if (
      booking.customerId !== userId &&
      booking.vendorId !== userId &&
      !adminUser
    ) {
      throw new Error("Unauthorized: You cannot view this booking");
    }

    return booking;
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Create a new booking
 * Authenticated users only
 */
export const create = mutation({
  args: {
    listingId: v.id("listings"),
    bookingDate: v.string(),
    guests: v.number(),
    totalPrice: v.number(),
    timeSlot: v.optional(
      v.union(
        v.literal("morning"),
        v.literal("afternoon"),
        v.literal("evening"),
        v.literal("full_day")
      )
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireUserProfile(ctx);
    const userId = await getCurrentUserId(ctx);

    // Get the listing
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Check availability (basic check - can be enhanced)
    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_listing_and_date", (q) =>
        q.eq("listingId", args.listingId).eq("bookingDate", args.bookingDate)
      )
      .collect();

    const totalGuests = existingBookings.reduce(
      (sum, booking) => sum + booking.guests,
      0
    );

    if (totalGuests + args.guests > listing.maxCapacity) {
      throw new Error("Not enough availability for this date");
    }

    // Create the booking
    const bookingId = await ctx.db.insert("bookings", {
      listingId: args.listingId,
      listingTitle: listing.title,
      customerId: userId,
      customerName: profile.fullName || profile.email,
      customerEmail: profile.email,
      vendorId: listing.vendorId || "",
      bookingDate: args.bookingDate,
      guests: args.guests,
      totalPrice: args.totalPrice,
      status: "pending",
      timeSlot: args.timeSlot || "full_day",
      paymentStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return bookingId;
  },
});

/**
 * Create a new booking from a specific slot
 * This is the new booking flow using the availability system
 * Authenticated users only
 */
export const createSlotBooking = mutation({
  args: {
    slotId: v.id("slots"),
    guests: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await requireUserProfile(ctx);
    const userId = await getCurrentUserId(ctx);

    // Get the slot
    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Time slot not found");
    }

    // Check slot status
    if (slot.status !== "active") {
      throw new Error("This time slot is no longer available");
    }

    // Check if enough availability
    if (slot.available < args.guests) {
      throw new Error(`Only ${slot.available} spots remaining for this time slot`);
    }

    // Check booking deadline
    if (Date.now() > slot.bookingDeadline) {
      throw new Error("Booking deadline has passed for this time slot");
    }

    // Get the listing
    const listing = await ctx.db.get(slot.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Calculate total price
    const totalPrice = listing.price * args.guests;

    // Create the booking
    const bookingId = await ctx.db.insert("bookings", {
      listingId: slot.listingId,
      listingTitle: listing.title,
      customerId: userId,
      customerName: profile.fullName || profile.email,
      customerEmail: profile.email,
      vendorId: slot.vendorId,
      slotId: args.slotId, // Link to the slot
      bookingDate: slot.date,
      guests: args.guests,
      totalPrice,
      status: "pending",
      timeSlot: "full_day", // Keep for backward compatibility
      paymentStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return bookingId;
  },
});

/**
 * Update booking status
 * Vendor (if owns listing) or Admin
 */
export const updateStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("pending"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const adminUser = await isAdmin(ctx);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if user is vendor of this booking's listing or admin
    if (booking.vendorId !== userId && !adminUser) {
      throw new Error("Unauthorized: Only the vendor or admin can update booking status");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Update payment status
 * Internal use (called after payment processing)
 */
export const updatePaymentStatus = mutation({
  args: {
    id: v.id("bookings"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("refunded"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });

    // If payment succeeded, confirm the booking
    if (args.paymentStatus === "paid") {
      await ctx.db.patch(args.id, {
        status: "confirmed",
      });
    }

    return args.id;
  },
});

/**
 * Cancel a booking
 * Customer (if owns) or Vendor (if owns listing) or Admin
 */
export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const adminUser = await isAdmin(ctx);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check access: customer, vendor, or admin
    if (
      booking.customerId !== userId &&
      booking.vendorId !== userId &&
      !adminUser
    ) {
      throw new Error("Unauthorized: You cannot cancel this booking");
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Delete a booking
 * Admin only
 */
export const remove = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const adminUser = await isAdmin(ctx);
    if (!adminUser) {
      throw new Error("Unauthorized: Admin only");
    }

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.db.delete(args.id);

    return { success: true };
  },
});
