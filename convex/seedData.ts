/**
 * Seed Data Script
 *
 * Populates Convex with sample listings.
 * Run this once to add initial data for testing.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Add sample listings to the database
 * This can be called from the Convex dashboard or via the frontend
 */
export const seedListings = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if we already have listings
    const existingListings = await ctx.db.query("listings").collect();
    if (existingListings.length > 0) {
      return {
        success: false,
        message: `Database already has ${existingListings.length} listings. Skipping seed.`,
      };
    }

    // Sample listings data
    const listings = [
      {
        title: "The Great Phangan Coconut Commando Challenge",
        description: "The Great Phangan Coconut Commando Challenge\n\nThe Vibe: Energetic, competitive, and very sweaty.",
        location: "Koh Phangan",
        price: 125,
        rating: 5.0,
        reviewCount: 342,
        imageUrl: "https://images.unsplash.com/photo-1530870110042-98b2cb110834?w=800&q=80",
        category: "Water Sports" as const,
        vendorName: "Coconut Warriors Co.",
        vendorId: undefined,
        duration: "3 hours",
        maxCapacity: 15,
        operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        latitude: 9.7384,
        longitude: 100.0194,
      },
      {
        title: "Jungle Temple Treasure Hunt",
        description: "A small group hike where you follow a series of cryptic clues (local folklore, riddles) to find hidden \"treasures\" scattered through the jungle.",
        location: "Koh Phangan",
        price: 600,
        rating: 4.8,
        reviewCount: 156,
        imageUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        category: "Adventure" as const,
        vendorName: "Temple Trekkers",
        vendorId: undefined,
        duration: "4 hours",
        maxCapacity: 8,
        operatingDays: ["Wed", "Thu", "Fri", "Sat", "Sun"],
        latitude: 9.7456,
        longitude: 100.0267,
      },
      {
        title: '"Manta Ray" Midnight Swim & Silent Disco',
        description: "After dark, swim in bioluminescent waters near Haad Rin while a DJ plays through waterproof speakers.",
        location: "Koh Phangan",
        price: 450,
        rating: 4.9,
        reviewCount: 203,
        imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
        category: "Water Sports" as const,
        vendorName: "Night Swimmers Club",
        vendorId: undefined,
        duration: "2 hours",
        maxCapacity: 20,
        operatingDays: ["Fri", "Sat"],
        latitude: 9.6741,
        longitude: 100.0353,
      },
      {
        title: "Island-Hopping Food Safari",
        description: "A boat tour that stops at 4 different islands, each offering a unique local dish.",
        location: "Koh Phangan",
        price: 850,
        rating: 5.0,
        reviewCount: 412,
        imageUrl: "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&q=80",
        category: "Food & Drink" as const,
        vendorName: "Island Eats Adventures",
        vendorId: undefined,
        duration: "Full day (8 hours)",
        maxCapacity: 12,
        operatingDays: ["Mon", "Wed", "Fri", "Sun"],
        latitude: 9.7234,
        longitude: 100.0145,
      },
      {
        title: "Sunrise Yoga on Secret Beach",
        description: "Start your day with a peaceful yoga session on a hidden beach accessible only by kayak.",
        location: "Koh Phangan",
        price: 350,
        rating: 4.7,
        reviewCount: 89,
        imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
        category: "Wellness" as const,
        vendorName: "Zen Beach Retreats",
        vendorId: undefined,
        duration: "2 hours",
        maxCapacity: 10,
        operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        latitude: 9.7589,
        longitude: 100.0423,
      },
    ];

    // Insert all listings
    const insertedIds = [];
    for (const listing of listings) {
      const id = await ctx.db.insert("listings", {
        ...listing,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      insertedIds.push(id);
    }

    return {
      success: true,
      message: `Successfully seeded ${insertedIds.length} listings`,
      listingIds: insertedIds,
    };
  },
});

/**
 * Clear all listings (use with caution!)
 * Useful for development/testing
 */
export const clearListings = mutation({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();

    for (const listing of listings) {
      await ctx.db.delete(listing._id);
    }

    return {
      success: true,
      message: `Deleted ${listings.length} listings`,
    };
  },
});

/**
 * Get seed status
 */
export const getSeedStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const listingsCount = (await ctx.db.query("listings").collect()).length;
    const bookingsCount = (await ctx.db.query("bookings").collect()).length;
    const reviewsCount = (await ctx.db.query("reviews").collect()).length;
    const messagesCount = (await ctx.db.query("messages").collect()).length;
    const profilesCount = (await ctx.db.query("profiles").collect()).length;

    return {
      listings: listingsCount,
      bookings: bookingsCount,
      reviews: reviewsCount,
      messages: messagesCount,
      profiles: profilesCount,
      isSeeded: listingsCount > 0,
    };
  },
});
