/**
 * Development utility to find recent bookings for testing
 */

import { query } from "../_generated/server";

/**
 * Get the most recent bookings with details
 * Useful for finding booking IDs to test notifications
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const bookings = await ctx.db
      .query("bookings")
      .order("desc")
      .take(10);

    const result = await Promise.all(
      bookings.map(async (booking) => {
        const listing = await ctx.db.get(booking.listingId);
        const customerProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", booking.customerId))
          .unique();
        const payment = await ctx.db
          .query("payments")
          .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
          .unique();

        return {
          bookingId: booking._id,
          listingTitle: listing?.title || "Unknown",
          customerName: customerProfile?.fullName || "Unknown",
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          amount: payment?.amount || 0,
          createdAt: new Date(booking.createdAt).toLocaleString(),
        };
      })
    );

    return result;
  },
});
