import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Convex Schema for Discover Phangan
 *
 * Defines the database structure using Convex's document-based model
 * with TypeScript validation and automatic real-time updates.
 */

export default defineSchema({
  // Include Convex Auth tables (users, sessions, authAccounts, etc.)
  ...authTables,
  // ============================================
  // PROFILES TABLE
  // ============================================
  profiles: defineTable({
    // Core fields
    userId: v.string(),              // Maps to auth.users id from Convex Auth
    email: v.string(),
    fullName: v.optional(v.string()),
    role: v.union(
      v.literal("customer"),
      v.literal("vendor"),
      v.literal("admin")
    ),
    phone: v.optional(v.string()),

    // Profile photo
    avatarStorageId: v.optional(v.id("_storage")),

    // Stripe Connect fields (for vendors)
    stripeConnectAccountId: v.optional(v.string()),     // Stripe Express Account ID
    commissionRate: v.optional(v.number()),             // Platform commission % (0-100)
    onboardingComplete: v.optional(v.boolean()),        // Has completed Stripe onboarding
    payoutSchedule: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("manual")
    )),

    // Timestamps
    createdAt: v.number(),           // Unix timestamp in milliseconds
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])  // Fast lookup by user ID
    .index("by_email", ["email"])    // Fast lookup by email
    .index("by_role", ["role"])      // Filter by role
    .index("by_stripeAccount", ["stripeConnectAccountId"]), // Lookup by Stripe account

  // ============================================
  // LISTINGS TABLE
  // ============================================
  listings: defineTable({
    // Basic info
    title: v.string(),
    description: v.string(),
    location: v.string(),
    price: v.number(),

    // Ratings
    rating: v.number(),              // 0-5 with decimals
    reviewCount: v.number(),

    // Media (URLs for backward compatibility, storageIds for new uploads)
    imageUrl: v.optional(v.string()),              // Legacy: URL string
    imageStorageId: v.optional(v.id("_storage")),  // New: Convex storage ID
    galleryUrls: v.optional(v.array(v.string())),  // Legacy: Array of URLs
    galleryStorageIds: v.optional(v.array(v.id("_storage"))), // New: Array of storage IDs
    videoUrl: v.optional(v.string()),              // Legacy: URL string
    videoStorageId: v.optional(v.id("_storage")),  // New: Convex storage ID

    // Category
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

    // Vendor info
    vendorName: v.string(),
    vendorId: v.optional(v.string()), // Reference to profiles.userId

    // Details
    duration: v.optional(v.string()),
    maxCapacity: v.number(),
    operatingDays: v.array(v.string()), // ["Mon", "Tue", "Wed", ...]

    // Location coordinates
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),

    // External calendar
    externalIcalUrl: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vendor", ["vendorId"])           // Vendor's listings
    .index("by_category", ["category"])         // Filter by category
    .index("by_created", ["createdAt"])         // Sort by creation date
    .index("by_rating", ["rating"])             // Sort by rating
    .searchIndex("search_title", {              // Full-text search
      searchField: "title",
      filterFields: ["category", "vendorId"],
    }),

  // ============================================
  // BOOKINGS TABLE
  // ============================================
  bookings: defineTable({
    // Listing reference
    listingId: v.id("listings"),     // Convex ID reference
    listingTitle: v.string(),        // Denormalized for display

    // Slot reference (NEW - links booking to specific time slot)
    slotId: v.optional(v.id("slots")), // Reference to slots table

    // Customer info
    customerId: v.string(),          // Reference to profiles.userId
    customerName: v.string(),
    customerEmail: v.string(),

    // Vendor reference
    vendorId: v.string(),            // Reference to profiles.userId

    // Booking details
    bookingDate: v.string(),         // ISO date string (YYYY-MM-DD)
    guests: v.number(),
    totalPrice: v.number(),

    // Status
    status: v.union(
      v.literal("confirmed"),
      v.literal("pending"),
      v.literal("cancelled"),
      v.literal("completed")
    ),

    // Time slot (kept for backward compatibility)
    timeSlot: v.union(
      v.literal("morning"),
      v.literal("afternoon"),
      v.literal("evening"),
      v.literal("full_day")
    ),

    // Payment
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("refunded"),
      v.literal("failed")
    ),

    // Cancellation info (NEW)
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()), // userId who cancelled (vendor or customer)
    cancellationReason: v.optional(v.union(
      v.literal("weather"),
      v.literal("emergency"),
      v.literal("personal"),
      v.literal("other"),
      v.literal("customer_request")
    )),
    cancellationMessage: v.optional(v.string()),
    refundProcessed: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_customer", ["customerId"])                    // Customer's bookings
    .index("by_vendor", ["vendorId"])                        // Vendor's bookings
    .index("by_listing", ["listingId"])                      // Listing's bookings
    .index("by_date", ["bookingDate"])                       // Bookings by date
    .index("by_listing_and_date", ["listingId", "bookingDate"]) // Availability check
    .index("by_status", ["status"])                          // Filter by status
    .index("by_slot", ["slotId"]),                           // Bookings for specific slot (NEW)

  // ============================================
  // REVIEWS TABLE
  // ============================================
  reviews: defineTable({
    // Listing reference
    listingId: v.id("listings"),

    // User info
    userId: v.string(),              // Reference to profiles.userId
    userName: v.string(),

    // Review content
    rating: v.number(),              // 1-5
    comment: v.string(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])        // Listing's reviews
    .index("by_user", ["userId"])              // User's reviews
    .index("by_rating", ["rating"]),           // Filter by rating

  // ============================================
  // MESSAGES TABLE
  // ============================================
  messages: defineTable({
    // Participants
    senderId: v.string(),            // Reference to profiles.userId
    recipientId: v.string(),         // Reference to profiles.userId

    // Listing reference (optional context)
    listingId: v.optional(v.id("listings")),

    // Message content
    content: v.string(),
    isRead: v.boolean(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sender", ["senderId"])                      // Sender's messages
    .index("by_recipient", ["recipientId"])                // Recipient's messages
    .index("by_conversation", ["senderId", "recipientId"]) // Conversation thread
    .index("by_unread", ["recipientId", "isRead"])        // Unread messages
    .index("by_created", ["createdAt"]),                   // Sort by time

  // ============================================
  // AVAILABILITY BLOCKS TABLE
  // ============================================
  availabilityBlocks: defineTable({
    // Listing reference
    listingId: v.id("listings"),

    // Date and time slot
    date: v.string(),                // ISO date string (YYYY-MM-DD)
    timeSlot: v.union(
      v.literal("morning"),
      v.literal("afternoon"),
      v.literal("evening"),
      v.literal("full_day")
    ),

    // Capacity
    availableSpots: v.number(),
    bookedSpots: v.number(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])                    // Listing's availability
    .index("by_date", ["date"])                            // Date lookup
    .index("by_listing_and_date", ["listingId", "date"])  // Combined lookup
    .index("by_listing_date_slot", ["listingId", "date", "timeSlot"]), // Exact match

  // ============================================
  // PAYMENTS TABLE
  // ============================================
  payments: defineTable({
    // Booking reference
    bookingId: v.id("bookings"),

    // User references
    customerId: v.string(),          // Reference to profiles.userId
    vendorId: v.string(),            // Reference to profiles.userId

    // Payment amount
    amount: v.number(),              // Amount in cents
    currency: v.string(),            // "THB", "USD", etc.

    // Payment status
    status: v.union(
      v.literal("pending"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded")
    ),

    // Stripe details
    paymentIntentId: v.optional(v.string()),
    chargeId: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    lastFour: v.optional(v.string()),
    cardBrand: v.optional(v.string()),

    // Stripe Connect fields (marketplace payments)
    applicationFeeAmount: v.optional(v.number()),      // Platform commission in cents
    vendorPayoutAmount: v.optional(v.number()),        // Amount vendor receives in cents
    transferId: v.optional(v.string()),                // Stripe Transfer ID
    transferStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("canceled"),
      v.literal("reversed")
    )),

    // Error handling
    errorMessage: v.optional(v.string()),

    // Refunds
    refundAmount: v.number(),        // Amount refunded in cents

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_booking", ["bookingId"])        // Payment for booking
    .index("by_customer", ["customerId"])      // Customer's payments
    .index("by_vendor", ["vendorId"])          // Vendor's payments
    .index("by_status", ["status"])            // Filter by status
    .index("by_paymentIntent", ["paymentIntentId"]), // Lookup by Stripe payment intent

  // ============================================
  // PLATFORM SETTINGS TABLE
  // ============================================
  platformSettings: defineTable({
    // Global platform configuration
    defaultCommissionRate: v.number(),         // Default vendor commission % (e.g., 10)

    // Stripe configuration
    stripePublishableKey: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // ============================================
  // AVAILABILITY RULES TABLE
  // ============================================
  availabilityRules: defineTable({
    // Service reference
    listingId: v.id("listings"),
    vendorId: v.string(),            // Reference to profiles.userId

    // Rule name/title
    name: v.string(),                // "Morning Dog Yoga", "Sunset Session", etc.

    // Rule type
    ruleType: v.union(
      v.literal("recurring"),
      v.literal("one-time")
    ),

    // Recurring pattern (for recurring rules)
    pattern: v.optional(v.object({
      frequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly")
      ),
      daysOfWeek: v.array(v.number()),  // [1,3,5] for Mon/Wed/Fri (1=Mon, 7=Sun)
      startTime: v.string(),             // "06:00"
      duration: v.number(),              // minutes
    })),

    // One-time details (for one-time rules)
    oneTimeDate: v.optional(v.string()), // ISO date string (YYYY-MM-DD)
    oneTimeStartTime: v.optional(v.string()), // "14:00"
    oneTimeDuration: v.optional(v.number()), // minutes

    // Capacity
    capacity: v.number(),                // Max bookings per slot

    // Booking settings
    bookingDeadlineHours: v.number(),    // Hours before start time (e.g., 2)
    generateDaysInAdvance: v.union(      // How far ahead to generate slots
      v.number(),                        // Number of days (e.g., 30)
      v.literal("indefinite")            // Generate indefinitely for recurring
    ),

    // Status
    active: v.boolean(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])                  // Listing's rules
    .index("by_vendor", ["vendorId"])                    // Vendor's rules
    .index("by_active", ["active"])                      // Active rules
    .index("by_listing_and_active", ["listingId", "active"]), // Active rules for listing

  // ============================================
  // SLOTS TABLE
  // ============================================
  slots: defineTable({
    // Service reference
    listingId: v.id("listings"),
    vendorId: v.string(),            // Reference to profiles.userId
    ruleId: v.optional(v.id("availabilityRules")), // Source rule (if generated from rule)

    // Date and time
    date: v.string(),                // ISO date string (YYYY-MM-DD)
    startTime: v.string(),           // "06:00"
    endTime: v.string(),             // "08:00"

    // Capacity tracking
    capacity: v.number(),            // Total capacity
    booked: v.number(),              // Currently booked
    available: v.number(),           // Remaining spots (capacity - booked)

    // Status
    status: v.union(
      v.literal("active"),           // Available for booking
      v.literal("blocked"),          // Manually blocked by vendor
      v.literal("cancelled"),        // Cancelled after bookings made
      v.literal("completed")         // Past date/time
    ),

    // Booking settings
    bookingDeadline: v.number(),     // Unix timestamp when booking closes

    // Cancellation info (if cancelled)
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.union(
      v.literal("weather"),
      v.literal("emergency"),
      v.literal("personal"),
      v.literal("other")
    )),
    cancellationMessage: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])                  // Listing's slots
    .index("by_vendor", ["vendorId"])                    // Vendor's slots
    .index("by_date", ["date"])                          // Slots by date
    .index("by_listing_and_date", ["listingId", "date"]) // Listing slots by date
    .index("by_status", ["status"])                      // Filter by status
    .index("by_available", ["available"])                // Slots with availability
    .index("by_listing_date_time", ["listingId", "date", "startTime"]), // Exact slot lookup

  // ============================================
  // WAITLIST TABLE
  // ============================================
  waitlist: defineTable({
    // Slot reference
    slotId: v.id("slots"),
    listingId: v.id("listings"),     // Denormalized for queries

    // Customer info
    customerId: v.string(),          // Reference to profiles.userId
    customerEmail: v.string(),       // For notifications

    // Waitlist position tracking
    joinedAt: v.number(),            // Unix timestamp (FIFO order)
    notified: v.boolean(),           // Has customer been notified?
    notifiedAt: v.optional(v.number()), // When notification was sent

    // Status
    status: v.union(
      v.literal("waiting"),          // Still waiting
      v.literal("notified"),         // Spot opened, customer notified
      v.literal("expired"),          // Notification expired (24hr timeout)
      v.literal("booked")            // Customer successfully booked
    ),

    // Notification expiry (24 hours after notification)
    expiresAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slot", ["slotId"])                        // Slot's waitlist
    .index("by_customer", ["customerId"])                // Customer's waitlist entries
    .index("by_status", ["status"])                      // Filter by status
    .index("by_slot_and_status", ["slotId", "status"])   // Active waitlist for slot
    .index("by_joined", ["joinedAt"])                    // FIFO order
    .index("by_slot_joined", ["slotId", "joinedAt"]),    // Slot waitlist in FIFO order

  // ============================================
  // NOTIFICATIONS TABLE
  // ============================================
  notifications: defineTable({
    // Recipient
    userId: v.string(),              // Reference to profiles.userId

    // Notification content
    type: v.union(
      v.literal("waitlist_spot_available"),
      v.literal("booking_cancelled_by_vendor"),
      v.literal("booking_confirmed"),
      v.literal("booking_reminder"),
      v.literal("new_sale")
    ),
    title: v.string(),
    message: v.string(),

    // Related entities (optional)
    listingId: v.optional(v.id("listings")),
    bookingId: v.optional(v.id("bookings")),
    slotId: v.optional(v.id("slots")),
    waitlistId: v.optional(v.id("waitlist")),

    // Status
    isRead: v.boolean(),
    readAt: v.optional(v.number()),

    // Action link (optional)
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])                        // User's notifications
    .index("by_user_and_read", ["userId", "isRead"])     // Unread notifications
    .index("by_created", ["createdAt"])                  // Sort by time
    .index("by_type", ["type"]),                         // Filter by type
});
