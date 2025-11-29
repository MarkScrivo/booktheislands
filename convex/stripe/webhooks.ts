/**
 * Stripe Webhook Event Handlers
 *
 * Internal mutations called from the HTTP webhook endpoint
 * to process Stripe events and update the database
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Handle successful payment intent
 * Called when customer payment succeeds
 */
export const handlePaymentSuccess = internalMutation({
  args: {
    paymentIntentId: v.string(),
    chargeId: v.string(),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find payment record
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique();

    if (!payment) {
      console.error(`Payment not found for intent ${args.paymentIntentId}`);
      return { success: false, error: "Payment not found" };
    }

    // Update payment status
    await ctx.db.patch(payment._id, {
      status: "succeeded",
      chargeId: args.chargeId,
      paymentMethod: args.paymentMethod,
      updatedAt: Date.now(),
    });

    // Update booking status
    await ctx.db.patch(payment.bookingId, {
      status: "confirmed",
      paymentStatus: "paid",
      updatedAt: Date.now(),
    });

    // Get booking details for notifications
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) {
      console.error(`Booking not found for payment ${args.paymentIntentId}`);
      return { success: false, error: "Booking not found" };
    }

    // Get listing details
    const listing = await ctx.db.get(booking.listingId);
    if (!listing) {
      console.error(`Listing not found for booking ${booking._id}`);
      return { success: false, error: "Listing not found" };
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

    const customerName = customerProfile?.fullName || "Customer";
    const customerEmail = customerProfile?.email || "";
    const vendorName = vendorProfile?.fullName || "Vendor";
    const vendorEmail = vendorProfile?.email || "";
    const slotDate = slot?.date || booking.date || "";
    const slotTime = slot?.time || booking.time || "";

    // Calculate vendor earnings (assuming 10% platform fee)
    const platformFeePercent = 10;
    const platformFee = Math.round(payment.amount * (platformFeePercent / 100));
    const vendorEarnings = payment.amount - platformFee;

    // Send notification to customer
    await ctx.scheduler.runAfter(0, internal.notifications.inApp.notifyBookingConfirmed, {
      userId: booking.customerId,
      listingTitle: listing.title,
      slotDate,
      slotTime,
      listingId: listing._id,
      bookingId: booking._id,
    });

    // Send email to customer
    await ctx.scheduler.runAfter(0, internal.notifications.email.sendBookingConfirmed, {
      to: customerEmail,
      customerName,
      listingTitle: listing.title,
      slotDate,
      slotTime,
      guests: booking.guests,
      totalPrice: payment.amount,
      bookingId: booking._id,
    });

    // Send notification to vendor
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

    console.log(`Payment ${args.paymentIntentId} succeeded - notifications sent`);
    return { success: true };
  },
});

/**
 * Handle failed payment intent
 * Called when customer payment fails
 */
export const handlePaymentFailed = internalMutation({
  args: {
    paymentIntentId: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find payment record
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique();

    if (!payment) {
      console.error(`Payment not found for intent ${args.paymentIntentId}`);
      return { success: false, error: "Payment not found" };
    }

    // Update payment status
    await ctx.db.patch(payment._id, {
      status: "failed",
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });

    // Update booking status
    await ctx.db.patch(payment.bookingId, {
      status: "cancelled",
      paymentStatus: "failed",
      updatedAt: Date.now(),
    });

    console.log(`Payment ${args.paymentIntentId} failed: ${args.errorMessage}`);
    return { success: true };
  },
});

/**
 * Handle Connect account updates
 * Called when vendor completes or updates onboarding
 */
export const handleAccountUpdate = internalMutation({
  args: {
    accountId: v.string(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find vendor profile by Stripe account ID
    const vendorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_stripeAccount", (q) =>
        q.eq("stripeConnectAccountId", args.accountId)
      )
      .unique();

    if (!vendorProfile) {
      console.error(`No vendor found for Stripe account ${args.accountId}`);
      return { success: false, error: "Vendor not found" };
    }

    // Onboarding is complete when charges and payouts are both enabled
    const onboardingComplete = args.chargesEnabled && args.payoutsEnabled;

    await ctx.db.patch(vendorProfile._id, {
      onboardingComplete,
      updatedAt: Date.now(),
    });

    console.log(
      `Account ${args.accountId} updated - onboarding complete: ${onboardingComplete}`
    );

    return { success: true, onboardingComplete };
  },
});

/**
 * Handle charge refunded event
 * Called when a charge is refunded (full or partial)
 */
export const handleRefund = internalMutation({
  args: {
    paymentIntentId: v.string(),
    refundAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Find payment record
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique();

    if (!payment) {
      console.error(`Payment not found for intent ${args.paymentIntentId}`);
      return { success: false, error: "Payment not found" };
    }

    // Update refund amount
    const totalRefunded = payment.refundAmount + args.refundAmount;
    const fullyRefunded = totalRefunded >= payment.amount;

    await ctx.db.patch(payment._id, {
      refundAmount: totalRefunded,
      status: fullyRefunded ? "refunded" : payment.status,
      updatedAt: Date.now(),
    });

    // Update booking if fully refunded
    if (fullyRefunded) {
      await ctx.db.patch(payment.bookingId, {
        paymentStatus: "refunded",
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }

    console.log(
      `Refunded ${args.refundAmount} for payment ${args.paymentIntentId} (total: ${totalRefunded})`
    );

    return { success: true, totalRefunded, fullyRefunded };
  },
});

/**
 * Handle payout paid event
 * Called when funds are sent to vendor's bank account
 */
export const handlePayoutPaid = internalMutation({
  args: {
    payoutId: v.string(),
    amount: v.number(),
    arrivalDate: v.number(),
    destination: v.string(), // Bank account ID
  },
  handler: async (ctx, args) => {
    // Note: We don't currently track individual payouts in the database
    // This is primarily for logging purposes
    // In a production system, you might want to create a payouts table

    console.log(
      `Payout ${args.payoutId} paid: ${args.amount} to ${args.destination}`
    );

    // Could update transfer statuses for payments included in this payout
    // For now, we'll just log it

    return { success: true };
  },
});

/**
 * Handle payout failed event
 * Called when payout to vendor fails
 */
export const handlePayoutFailed = internalMutation({
  args: {
    payoutId: v.string(),
    failureCode: v.optional(v.string()),
    failureMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.error(
      `Payout ${args.payoutId} failed: ${args.failureCode} - ${args.failureMessage}`
    );

    // In a production system, you might:
    // - Notify the vendor
    // - Mark associated transfers as failed
    // - Create an admin alert

    return { success: true };
  },
});

/**
 * Handle transfer created event
 * Called when funds are transferred to vendor Connect account
 */
export const handleTransferCreated = internalMutation({
  args: {
    transferId: v.string(),
    amount: v.number(),
    destination: v.string(), // Connect account ID
  },
  handler: async (ctx, args) => {
    // Find payment by looking for matching vendor and amount
    // This is tricky because we don't have direct transfer ID mapping yet
    // For now, just log it

    console.log(
      `Transfer ${args.transferId} created: ${args.amount} to ${args.destination}`
    );

    // TODO: Link transfer ID to payment record
    // This would require storing transfer ID when creating payment intent

    return { success: true };
  },
});

/**
 * Handle application fee created event
 * Called when platform commission is charged
 */
export const handleApplicationFeeCreated = internalMutation({
  args: {
    feeId: v.string(),
    amount: v.number(),
    chargeId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `Application fee ${args.feeId} created: ${args.amount} from charge ${args.chargeId}`
    );

    // This is primarily for platform revenue tracking
    // Could aggregate these for analytics

    return { success: true };
  },
});

/**
 * Handle application fee refunded event
 * Called when platform commission is refunded
 */
export const handleApplicationFeeRefunded = internalMutation({
  args: {
    feeId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(
      `Application fee ${args.feeId} refunded: ${args.amount}`
    );

    // Platform commission was refunded as part of a refund
    // This is already handled in the refund flow

    return { success: true };
  },
});

/**
 * Handle dispute created event
 * Called when customer disputes a charge
 */
export const handleDisputeCreated = internalMutation({
  args: {
    disputeId: v.string(),
    chargeId: v.string(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Find payment by charge ID
    const payment = await ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("chargeId"), args.chargeId))
      .unique();

    if (!payment) {
      console.error(`Payment not found for charge ${args.chargeId}`);
      return { success: false, error: "Payment not found" };
    }

    console.error(
      `Dispute ${args.disputeId} created for charge ${args.chargeId}: ${args.reason}`
    );

    // In production, you would:
    // - Notify the vendor and platform admin
    // - Mark the booking as disputed
    // - Provide interface to submit evidence
    // - Create a disputes table to track status

    return { success: true, paymentId: payment._id };
  },
});
