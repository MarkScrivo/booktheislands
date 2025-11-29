/**
 * Messages Queries and Mutations
 *
 * Real-time messaging between customers and vendors.
 * All queries are automatically reactive - UI updates when new messages arrive!
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserId, requireUserProfile } from "./lib/auth";

// ============================================
// QUERIES (Read Operations - Automatically Real-time!)
// ============================================

/**
 * Get all messages in a conversation between two users
 * Automatically updates when new messages arrive! 🎉
 */
export const getConversation = query({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get messages where:
    // - Current user is sender and other user is recipient, OR
    // - Other user is sender and current user is recipient
    const messages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.or(
          // Messages I sent to them
          q.and(
            q.eq(q.field("senderId"), userId),
            q.eq(q.field("recipientId"), args.otherUserId)
          ),
          // Messages they sent to me
          q.and(
            q.eq(q.field("senderId"), args.otherUserId),
            q.eq(q.field("recipientId"), userId)
          )
        )
      )
      .order("asc") // Oldest first
      .collect();

    return messages;
  },
});

/**
 * Get all conversations for the current user
 * Returns a list of unique users they've messaged with
 * Automatically updates with new conversations! 🎉
 */
export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get all messages where user is sender or recipient
    const messages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.or(
          q.eq(q.field("senderId"), userId),
          q.eq(q.field("recipientId"), userId)
        )
      )
      .order("desc")
      .collect();

    // Extract unique conversation partners
    const partners = new Map();

    for (const message of messages) {
      const partnerId = message.senderId === userId
        ? message.recipientId
        : message.senderId;

      if (!partners.has(partnerId)) {
        // Get partner's profile for their name
        const partnerProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", partnerId))
          .unique();

        partners.set(partnerId, {
          otherUserId: partnerId,
          otherUserName: partnerProfile?.fullName || "Unknown User",
          lastMessage: message.content,
          lastMessageTime: message.createdAt,
          unreadCount: 0,
        });
      }

      // Count unread messages from this partner
      if (message.recipientId === userId && !message.isRead) {
        const partner = partners.get(partnerId);
        partner.unreadCount++;
      }
    }

    return Array.from(partners.values());
  },
});

/**
 * Get unread message count for current user
 * Automatically updates! 🎉
 */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_unread", (q) =>
        q.eq("recipientId", userId).eq("isRead", false)
      )
      .collect();

    return unreadMessages.length;
  },
});

/**
 * Get messages about a specific listing
 * Useful for vendor/customer communication about a listing
 */
export const getByListing = query({
  args: {
    listingId: v.id("listings"),
    otherUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const messages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("listingId"), args.listingId),
          q.or(
            q.and(
              q.eq(q.field("senderId"), userId),
              q.eq(q.field("recipientId"), args.otherUserId)
            ),
            q.and(
              q.eq(q.field("senderId"), args.otherUserId),
              q.eq(q.field("recipientId"), userId)
            )
          )
        )
      )
      .order("asc")
      .collect();

    return messages;
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Send a message
 * Authenticated users only
 */
export const send = mutation({
  args: {
    recipientId: v.string(),
    content: v.string(),
    listingId: v.optional(v.id("listings")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Message cannot be empty");
    }

    // Can't message yourself
    if (args.recipientId === userId) {
      throw new Error("Cannot send message to yourself");
    }

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      senderId: userId,
      recipientId: args.recipientId,
      listingId: args.listingId,
      content: args.content.trim(),
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Mark a message as read
 */
export const markAsRead = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const message = await ctx.db.get(args.id);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only recipient can mark as read
    if (message.recipientId !== userId) {
      throw new Error("Unauthorized: Only the recipient can mark a message as read");
    }

    await ctx.db.patch(args.id, {
      isRead: true,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Mark all messages in a conversation as read
 * Useful when opening a conversation
 */
export const markConversationAsRead = mutation({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get all unread messages from the other user
    const unreadMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), args.otherUserId),
          q.eq(q.field("recipientId"), userId),
          q.eq(q.field("isRead"), false)
        )
      )
      .collect();

    // Mark each as read
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        isRead: true,
        updatedAt: Date.now(),
      });
    }

    return unreadMessages.length;
  },
});

/**
 * Delete a message
 * Only sender can delete
 */
export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const message = await ctx.db.get(args.id);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      throw new Error("Unauthorized: Only the sender can delete a message");
    }

    await ctx.db.delete(args.id);

    return { success: true };
  },
});
