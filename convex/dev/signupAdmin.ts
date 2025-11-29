/**
 * Create admin account using proper Convex Auth signup flow
 * This ensures password hashing is compatible with Convex Auth
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const signupAdminAccount = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    // Use Convex Auth's built-in signup mechanism
    // This will properly hash the password using their internal mechanism

    // First check if user exists
    const existingProfile = await ctx.runQuery(internal.profiles.getByEmail, {
      email: args.email,
    });

    if (existingProfile) {
      throw new Error(`User with email ${args.email} already exists`);
    }

    // Create the account by calling the signup flow directly
    // We'll create a temporary signup helper in auth
    const result = await ctx.runMutation(internal.dev.createAdminHelper.createAdminUser, {
      email: args.email,
      password: args.password,
      fullName: args.fullName,
    });

    return result;
  },
});
