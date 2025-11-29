/**
 * Listings Queries and Mutations
 *
 * All operations for managing activity listings on the platform.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  getCurrentUserId,
  getCurrentUserIdOrNull,
  requireVendor,
  isAdmin,
} from "./lib/auth";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get all listings
 * Public - anyone can view all listings
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("listings")
      .order("desc") // Most recent first
      .collect();

    // Fetch image URLs from storage for listings that use storage IDs
    return await Promise.all(
      listings.map(async (listing) => {
        let imageUrl = listing.imageUrl;
        if (listing.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(listing.imageStorageId);
        }
        return {
          ...listing,
          imageUrl: imageUrl || listing.imageUrl || "",
        };
      })
    );
  },
});

/**
 * Get a single listing by ID
 * Public - anyone can view
 */
export const get = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Fetch image URL from storage if using storage ID
    let imageUrl = listing.imageUrl;
    if (listing.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(listing.imageStorageId);
    }

    // Fetch gallery URLs from storage if using storage IDs
    let galleryUrls = listing.galleryUrls || [];
    if (listing.galleryStorageIds && listing.galleryStorageIds.length > 0) {
      galleryUrls = await Promise.all(
        listing.galleryStorageIds.map(id => ctx.storage.getUrl(id))
      );
    }

    // Fetch video URL from storage if using storage ID
    let videoUrl = listing.videoUrl;
    if (listing.videoStorageId) {
      videoUrl = await ctx.storage.getUrl(listing.videoStorageId);
    }

    return {
      ...listing,
      imageUrl: imageUrl || listing.imageUrl || "",
      galleryUrls,
      videoUrl: videoUrl || listing.videoUrl,
    };
  },
});

/**
 * Search listings by title
 * Public - anyone can search
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    // Use full-text search index
    return await ctx.db
      .query("listings")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.searchTerm)
      )
      .collect();
  },
});

/**
 * Filter listings by category
 * Public - anyone can filter
 */
export const filterByCategory = query({
  args: {
    category: v.union(
      v.literal("Water Sports"),
      v.literal("Wellness"),
      v.literal("Nature"),
      v.literal("Adventure"),
      v.literal("Cultural"),
      v.literal("Transportation"),
      v.literal("Food & Drink"),
      v.literal("Relaxation")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .collect();
  },
});

/**
 * Get listings by vendor
 * Public - anyone can view vendor's listings
 */
export const getByVendor = query({
  args: { vendorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .order("desc")
      .collect();
  },
});

/**
 * Get the current vendor's listings
 * Vendor-only - requires vendor role
 */
export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_vendor", (q) => q.eq("vendorId", userId))
      .order("desc")
      .collect();

    // Fetch image URLs from storage for listings that use storage IDs
    return await Promise.all(
      listings.map(async (listing) => {
        let imageUrl = listing.imageUrl;
        if (listing.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(listing.imageStorageId);
        }
        return {
          ...listing,
          imageUrl: imageUrl || listing.imageUrl || "",
        };
      })
    );
  },
});

/**
 * Get top-rated listings
 * Public - anyone can view
 */
export const topRated = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_rating")
      .order("desc")
      .take(limit);

    return listings;
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Create a new listing
 * Vendor-only
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    location: v.string(),
    price: v.number(),
    // Support both legacy URLs and new storage IDs
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    category: v.union(
      v.literal("Water Sports"),
      v.literal("Wellness"),
      v.literal("Nature"),
      v.literal("Adventure"),
      v.literal("Cultural"),
      v.literal("Transportation"),
      v.literal("Food & Drink"),
      v.literal("Relaxation")
    ),
    duration: v.optional(v.string()),
    maxCapacity: v.number(),
    operatingDays: v.array(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    galleryUrls: v.optional(v.array(v.string())),
    galleryStorageIds: v.optional(v.array(v.id("_storage"))),
    videoUrl: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Require vendor role
    const profile = await requireVendor(ctx);
    const userId = await getCurrentUserId(ctx);

    // Create the listing
    const listingId = await ctx.db.insert("listings", {
      title: args.title,
      description: args.description,
      location: args.location,
      price: args.price,
      rating: 0,
      reviewCount: 0,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      category: args.category,
      vendorName: profile.fullName || profile.email,
      vendorId: userId,
      duration: args.duration,
      maxCapacity: args.maxCapacity,
      operatingDays: args.operatingDays,
      latitude: args.latitude,
      longitude: args.longitude,
      galleryUrls: args.galleryUrls,
      galleryStorageIds: args.galleryStorageIds,
      videoUrl: args.videoUrl,
      videoStorageId: args.videoStorageId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return listingId;
  },
});

/**
 * Update a listing
 * Vendor-only - can only update their own listings (or admin)
 */
export const update = mutation({
  args: {
    id: v.id("listings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    price: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    category: v.optional(
      v.union(
        v.literal("Water Sports"),
        v.literal("Wellness"),
        v.literal("Nature"),
        v.literal("Adventure"),
        v.literal("Cultural"),
        v.literal("Transportation"),
        v.literal("Food & Drink"),
        v.literal("Relaxation")
      )
    ),
    duration: v.optional(v.string()),
    maxCapacity: v.optional(v.number()),
    operatingDays: v.optional(v.array(v.string())),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    galleryUrls: v.optional(v.array(v.string())),
    galleryStorageIds: v.optional(v.array(v.id("_storage"))),
    videoUrl: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const adminUser = await isAdmin(ctx);

    // Get the listing
    const listing = await ctx.db.get(args.id);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Check ownership or admin
    if (listing.vendorId !== userId && !adminUser) {
      throw new Error("Unauthorized: You can only update your own listings");
    }

    // Update the listing
    const updates: any = {
      updatedAt: Date.now(),
    };

    // Only update provided fields
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.location !== undefined) updates.location = args.location;
    if (args.price !== undefined) updates.price = args.price;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;
    if (args.category !== undefined) updates.category = args.category;
    if (args.duration !== undefined) updates.duration = args.duration;
    if (args.maxCapacity !== undefined) updates.maxCapacity = args.maxCapacity;
    if (args.operatingDays !== undefined)
      updates.operatingDays = args.operatingDays;
    if (args.latitude !== undefined) updates.latitude = args.latitude;
    if (args.longitude !== undefined) updates.longitude = args.longitude;
    if (args.galleryUrls !== undefined) updates.galleryUrls = args.galleryUrls;
    if (args.galleryStorageIds !== undefined) updates.galleryStorageIds = args.galleryStorageIds;
    if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl;
    if (args.videoStorageId !== undefined) updates.videoStorageId = args.videoStorageId;

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete a listing
 * Vendor-only - can only delete their own listings (or admin)
 */
export const remove = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const adminUser = await isAdmin(ctx);

    // Get the listing
    const listing = await ctx.db.get(args.id);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Check ownership or admin
    if (listing.vendorId !== userId && !adminUser) {
      throw new Error("Unauthorized: You can only delete your own listings");
    }

    // Delete the listing
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

/**
 * Update listing rating
 * Internal function - called when reviews are added/updated
 */
export const updateRating = mutation({
  args: {
    listingId: v.id("listings"),
    newRating: v.number(),
    reviewCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, {
      rating: args.newRating,
      reviewCount: args.reviewCount,
      updatedAt: Date.now(),
    });
  },
});
