/**
 * Development utility to update user passwords
 * WARNING: Only use in development/testing environments
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Password } from "@convex-dev/auth/providers/Password";
import bcrypt from "bcryptjs";

/**
 * Update a user's password directly
 * This bypasses the normal password reset flow
 * Only for development/testing purposes
 */
export const updateUserPassword = internalMutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the user by email in the users table
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      throw new Error(`User not found with email: ${args.email}`);
    }

    // Find the password auth account
    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password")
      )
      .first();

    if (!authAccount) {
      throw new Error(`No password account found for user: ${args.email}`);
    }

    // Use Convex Auth's password hashing (bcrypt with 10 rounds, using sync version for Convex compatibility)
    const hashedPassword = bcrypt.hashSync(args.newPassword, 10);

    // Update the auth account with the new hashed password
    await ctx.db.patch(authAccount._id, {
      secret: hashedPassword,
    });

    return {
      success: true,
      message: `Password updated for ${args.email}`,
      userId: user._id,
    };
  },
});
