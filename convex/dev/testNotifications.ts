/**
 * Development utility to manually test notification sending
 * Use this when webhooks aren't firing in local development
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Manually trigger vendor sale notifications for a specific booking
 * This simulates what would happen when a Stripe webhook fires
 */
export const sendVendorSaleNotifications = internalMutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    // Get booking
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error(`Booking not found: ${args.bookingId}`);
    }

    // Get listing
    const listing = await ctx.db.get(booking.listingId);
    if (!listing) {
      throw new Error(`Listing not found for booking ${args.bookingId}`);
    }

    // Get customer profile
    const customerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", booking.customerId))
      .unique();

    // Get vendor profile
    const vendorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", listing.vendorId))
      .unique();

    // Get slot details
    const slot = booking.slotId ? await ctx.db.get(booking.slotId) : null;

    // Get payment to calculate earnings
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .unique();

    if (!payment) {
      throw new Error(`Payment not found for booking ${args.bookingId}`);
    }

    const customerName = customerProfile?.fullName || "Customer";
    const customerEmail = customerProfile?.email || "";
    const vendorName = vendorProfile?.fullName || "Vendor";
    const vendorEmail = vendorProfile?.email || "";
    const slotDate = slot?.date || booking.date || "";
    const slotTime = slot?.time || booking.time || "";

    // Calculate vendor earnings (10% platform fee)
    const platformFeePercent = 10;
    const platformFee = Math.round(payment.amount * (platformFeePercent / 100));
    const vendorEarnings = payment.amount - platformFee;

    console.log("Sending vendor sale notifications:", {
      vendorId: listing.vendorId,
      vendorEmail,
      customerName,
      listingTitle: listing.title,
      amount: payment.amount,
      earnings: vendorEarnings,
    });

    // Send in-app notification to vendor
    await ctx.scheduler.runAfter(0, internal.notifications.inApp.notifyNewSale, {
      vendorId: listing.vendorId,
      customerName,
      listingTitle: listing.title,
      slotDate,
      slotTime,
      guests: booking.guests,
      totalAmount: payment.amount,
      listingId: listing._id,
      bookingId: booking._id,
    });

    // Send email to vendor
    await ctx.scheduler.runAfter(0, internal.notifications.email.sendNewSale, {
      to: vendorEmail,
      vendorName,
      customerName,
      listingTitle: listing.title,
      slotDate,
      slotTime,
      guests: booking.guests,
      totalPrice: payment.amount,
      vendorEarnings,
      platformFee,
      bookingId: booking._id,
    });

    return {
      success: true,
      message: `Notifications sent to ${vendorEmail} for booking ${args.bookingId}`,
      vendorEmail,
      customerName,
      listingTitle: listing.title,
      amount: payment.amount,
      earnings: vendorEarnings,
    };
  },
});
