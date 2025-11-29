/**
 * Reviews Queries and Mutations
 *
 * All operations for managing reviews and ratings on the platform.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserId, requireUserProfile } from "./lib/auth";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get all reviews for a listing
 * Public - anyone can view reviews
 */
export const getByListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .collect();
  },
});

/**
 * Get reviews by a specific user
 * Public - anyone can view user's reviews
 */
export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get the current user's reviews
 * Authenticated users only
 */
export const myReviews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    return await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Check if user has already reviewed a listing
 * Authenticated users only
 */
export const hasReviewed = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    return existing !== null;
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Create a new review
 * Authenticated users only
 */
export const create = mutation({
  args: {
    listingId: v.id("listings"),
    rating: v.number(),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireUserProfile(ctx);
    const userId = await getCurrentUserId(ctx);

    // Validate rating
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Check if listing exists
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Check if user already reviewed this listing
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existingReview) {
      throw new Error("You have already reviewed this listing");
    }

    // Create the review
    const reviewId = await ctx.db.insert("reviews", {
      listingId: args.listingId,
      userId: userId,
      userName: profile.fullName || profile.email,
      rating: args.rating,
      comment: args.comment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update listing's average rating
    await updateListingRating(ctx, args.listingId);

    return reviewId;
  },
});

/**
 * Update a review
 * User can only update their own reviews
 */
export const update = mutation({
  args: {
    id: v.id("reviews"),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const review = await ctx.db.get(args.id);
    if (!review) {
      throw new Error("Review not found");
    }

    // Check ownership
    if (review.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own reviews");
    }

    // Validate rating if provided
    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.rating !== undefined) updates.rating = args.rating;
    if (args.comment !== undefined) updates.comment = args.comment;

    await ctx.db.patch(args.id, updates);

    // Update listing's average rating if rating changed
    if (args.rating !== undefined) {
      await updateListingRating(ctx, review.listingId);
    }

    return args.id;
  },
});

/**
 * Delete a review
 * User can only delete their own reviews
 */
export const remove = mutation({
  args: { id: v.id("reviews") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const review = await ctx.db.get(args.id);
    if (!review) {
      throw new Error("Review not found");
    }

    // Check ownership
    if (review.userId !== userId) {
      throw new Error("Unauthorized: You can only delete your own reviews");
    }

    const listingId = review.listingId;

    await ctx.db.delete(args.id);

    // Update listing's average rating
    await updateListingRating(ctx, listingId);

    return { success: true };
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update a listing's average rating and review count
 * Internal helper function
 */
async function updateListingRating(ctx: any, listingId: any) {
  // Get all reviews for this listing
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();

  const reviewCount = reviews.length;

  if (reviewCount === 0) {
    // No reviews, reset to 0
    await ctx.db.patch(listingId, {
      rating: 0,
      reviewCount: 0,
      updatedAt: Date.now(),
    });
    return;
  }

  // Calculate average rating
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviewCount;

  // Round to 1 decimal place
  const roundedRating = Math.round(averageRating * 10) / 10;

  await ctx.db.patch(listingId, {
    rating: roundedRating,
    reviewCount: reviewCount,
    updatedAt: Date.now(),
  });
}
