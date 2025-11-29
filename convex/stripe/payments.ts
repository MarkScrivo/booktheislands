/**
 * Stripe Payment Processing with Marketplace Commissions
 *
 * Functions for processing payments with automatic commission deduction:
 * - Creating payment intents with application fees
 * - Confirming payments
 * - Processing refunds
 * - Managing payment records
 */

import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { getCurrentUserId } from "../lib/auth";
import { api, internal } from "../_generated/api";
import Stripe from "stripe";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get a payment by booking ID
 */
export const getByBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .unique();

    return payment;
  },
});

/**
 * Get all payments for the current user (as customer)
 */
export const myPayments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .collect();

    return payments;
  },
});

/**
 * Get all payments for the current vendor
 * Used for vendor dashboard and earnings tracking
 */
export const vendorPayments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_vendor", (q) => q.eq("vendorId", userId))
      .collect();

    return payments;
  },
});

/**
 * Calculate vendor earnings summary
 * Total earnings, pending balance, completed payouts
 */
export const vendorEarningsSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_vendor", (q) => q.eq("vendorId", userId))
      .filter((q) => q.eq(q.field("status"), "succeeded"))
      .collect();

    const totalEarnings = payments.reduce(
      (sum, p) => sum + (p.vendorPayoutAmount || 0),
      0
    );

    const platformFees = payments.reduce(
      (sum, p) => sum + (p.applicationFeeAmount || 0),
      0
    );

    const refundedAmount = payments.reduce(
      (sum, p) => sum + (p.refundAmount || 0),
      0
    );

    // Count payments by transfer status
    const paidOut = payments.filter(
      (p) => p.transferStatus === "paid"
    ).length;

    const pending = payments.filter(
      (p) => p.transferStatus === "pending" || !p.transferStatus
    ).length;

    return {
      totalEarnings, // What vendor received after commission
      platformFees, // What platform took as commission
      refundedAmount,
      totalPayments: payments.length,
      paidOut,
      pending,
      netEarnings: totalEarnings - refundedAmount,
    };
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Internal mutation to create a payment record
 */
export const createPaymentRecord = mutation({
  args: {
    bookingId: v.id("bookings"),
    customerId: v.string(),
    vendorId: v.string(),
    amount: v.number(),
    currency: v.string(),
    paymentIntentId: v.string(),
    applicationFeeAmount: v.number(),
    vendorPayoutAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert("payments", {
      bookingId: args.bookingId,
      customerId: args.customerId,
      vendorId: args.vendorId,
      amount: args.amount,
      currency: args.currency,
      status: "pending",
      paymentIntentId: args.paymentIntentId,
      applicationFeeAmount: args.applicationFeeAmount,
      vendorPayoutAmount: args.vendorPayoutAmount,
      refundAmount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return paymentId;
  },
});

/**
 * Update payment status
 * Called from frontend when payment succeeds, or from webhooks
 * Requires user to be either the customer or vendor of the payment
 */
export const updatePaymentStatus = mutation({
  args: {
    paymentIntentId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    chargeId: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current user - must be authenticated
    const userId = await getCurrentUserId(ctx);

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique();

    if (!payment) {
      console.error(`Payment not found for intent ${args.paymentIntentId}`);
      return { success: false };
    }

    // Verify the user is either the customer or vendor of this payment
    if (payment.customerId !== userId && payment.vendorId !== userId) {
      console.error(`Unauthorized: User ${userId} cannot update payment ${args.paymentIntentId}`);
      throw new Error("Unauthorized: You can only update your own payments");
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      chargeId: args.chargeId,
      paymentMethod: args.paymentMethod,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });

    // Update booking status if payment succeeded
    if (args.status === "succeeded") {
      await ctx.db.patch(payment.bookingId, {
        status: "confirmed",
        paymentStatus: "paid",
        updatedAt: Date.now(),
      });

      // Send notifications to vendor and customer
      // Get all necessary data
      const booking = await ctx.db.get(payment.bookingId);
      if (booking) {
        const listing = await ctx.db.get(booking.listingId);
        const customerProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", booking.customerId))
          .unique();
        const vendorProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", listing?.vendorId || ""))
          .unique();
        const slot = booking.slotId ? await ctx.db.get(booking.slotId) : null;

        if (listing && customerProfile && vendorProfile) {
          const customerName = customerProfile.fullName || "Customer";
          const customerEmail = customerProfile.email || "";
          const vendorName = vendorProfile.fullName || "Vendor";
          const vendorEmail = vendorProfile.email || "";
          const slotDate = slot?.date || booking.date || "";
          const slotTime = slot?.time || booking.time || "";

          // Calculate vendor earnings (10% platform fee)
          const platformFeePercent = 10;
          const platformFee = Math.round(payment.amount * (platformFeePercent / 100));
          const vendorEarnings = payment.amount - platformFee;

          // Send in-app notification to customer
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

          console.log(`Payment ${args.paymentIntentId} succeeded - notifications sent`);
        }
      }
    } else if (args.status === "failed") {
      await ctx.db.patch(payment.bookingId, {
        status: "cancelled",
        paymentStatus: "failed",
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Internal mutation to update transfer status
 * Called from webhooks when payout completes
 */
export const updateTransferStatus = mutation({
  args: {
    transferId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("canceled"),
      v.literal("reversed")
    ),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("transferId"), args.transferId))
      .unique();

    if (!payment) {
      console.error(`Payment not found for transfer ${args.transferId}`);
      return { success: false };
    }

    await ctx.db.patch(payment._id, {
      transferStatus: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to record a refund
 */
export const recordRefund = mutation({
  args: {
    paymentIntentId: v.string(),
    refundAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique();

    if (!payment) {
      throw new Error("Payment not found");
    }

    const totalRefunded = payment.refundAmount + args.refundAmount;

    await ctx.db.patch(payment._id, {
      refundAmount: totalRefunded,
      status: totalRefunded >= payment.amount ? "refunded" : payment.status,
      updatedAt: Date.now(),
    });

    // Update booking if fully refunded
    if (totalRefunded >= payment.amount) {
      await ctx.db.patch(payment.bookingId, {
        paymentStatus: "refunded",
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ============================================
// ACTIONS (External API Calls)
// ============================================

/**
 * Create a payment intent with marketplace commission
 * This is the main entry point for creating a payment
 */
export const createPaymentIntent = action({
  args: {
    bookingId: v.id("bookings"),
    amount: v.number(), // Amount in cents (smallest currency unit)
  },
  handler: async (ctx, args) => {
    // Get booking details
    const booking = await ctx.runQuery(api.bookings.get, {
      id: args.bookingId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Get vendor profile to check onboarding status
    const vendorProfile = await ctx.runQuery(api.profiles.get, {
      userId: booking.vendorId,
    });

    if (!vendorProfile?.stripeConnectAccountId) {
      throw new Error(
        "Vendor has not completed payment setup. Please contact the vendor."
      );
    }

    if (!vendorProfile.onboardingComplete) {
      throw new Error(
        "Vendor payment setup is incomplete. Please contact the vendor."
      );
    }

    // Get commission rate for this vendor
    const commissionRate = await ctx.runQuery(
      api.stripe.connect.getVendorCommissionRate,
      { vendorId: booking.vendorId }
    );

    // Calculate application fee (platform commission)
    const applicationFeeAmount = Math.round(
      args.amount * (commissionRate / 100)
    );
    const vendorPayoutAmount = args.amount - applicationFeeAmount;

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    // Create payment intent with transfer to vendor
    const paymentIntent = await stripe.paymentIntents.create({
      amount: args.amount,
      currency: "thb", // Thai Baht
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: vendorProfile.stripeConnectAccountId,
      },
      metadata: {
        bookingId: args.bookingId,
        vendorId: booking.vendorId,
        customerId: booking.customerId,
        commissionRate: commissionRate.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create payment record in database
    await ctx.runMutation(internal.stripe.payments.createPaymentRecord, {
      bookingId: args.bookingId,
      customerId: booking.customerId,
      vendorId: booking.vendorId,
      amount: args.amount,
      currency: "thb",
      paymentIntentId: paymentIntent.id,
      applicationFeeAmount,
      vendorPayoutAmount,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      applicationFeeAmount,
      vendorPayoutAmount,
    };
  },
});

/**
 * Process a refund for a payment
 * Can be full or partial refund
 */
export const refundPayment = action({
  args: {
    paymentIntentId: v.string(),
    amount: v.optional(v.number()), // Optional: full refund if not specified
    reason: v.optional(
      v.union(
        v.literal("duplicate"),
        v.literal("fraudulent"),
        v.literal("requested_by_customer")
      )
    ),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: args.paymentIntentId,
      amount: args.amount, // Undefined = full refund
      reason: args.reason,
      reverse_transfer: true, // Reverses the transfer to vendor
      refund_application_fee: true, // Refunds platform commission
    });

    // Record refund in database
    await ctx.runMutation(internal.stripe.payments.recordRefund, {
      paymentIntentId: args.paymentIntentId,
      refundAmount: refund.amount,
    });

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    };
  },
});

/**
 * Get payment intent details from Stripe
 * Useful for checking real-time status
 */
export const getPaymentIntentDetails = action({
  args: {
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(
      args.paymentIntentId
    );

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      applicationFeeAmount: paymentIntent.application_fee_amount,
      transferData: paymentIntent.transfer_data,
      charges: paymentIntent.latest_charge
        ? {
            id: paymentIntent.latest_charge,
          }
        : null,
    };
  },
});
