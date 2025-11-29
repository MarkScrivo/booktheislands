/**
 * File Storage Module
 * Handles image and video uploads for listings and profiles
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/auth";

/**
 * Generate an upload URL for file uploads
 * This URL is used by the client to upload files directly to Convex storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Require authentication
    await getCurrentUserId(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a public URL for a stored file
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Delete a file from storage
 * Only the file owner can delete it
 */
export const deleteFile = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await getCurrentUserId(ctx);

    await ctx.storage.delete(args.storageId);
    return { success: true };
  },
});
