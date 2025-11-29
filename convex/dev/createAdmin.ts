/**
 * Create a fresh admin account
 * Development utility
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Scrypt } from "lucia";

export const createAdminAccount = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      throw new Error(`User with email ${args.email} already exists`);
    }

    // Hash the password using Scrypt (same as Convex Auth uses)
    const hashedPassword = await new Scrypt().hash(args.password);

    // Create user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.fullName,
      emailVerificationTime: Date.now(),
    });

    // Create auth account
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: args.email,
      secret: hashedPassword,
    });

    // Create profile
    await ctx.db.insert("profiles", {
      userId,
      email: args.email,
      fullName: args.fullName,
      role: "admin",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      userId,
      email: args.email,
      message: "Admin account created successfully",
    };
  },
});
