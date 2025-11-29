/**
 * Authentication & Authorization Helper Functions
 *
 * These functions help with:
 * - Getting the current authenticated user
 * - Checking user roles
 * - Enforcing role-based access control
 */

import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { auth } from "../auth";

/**
 * Get the currently authenticated user's ID
 * Throws if user is not authenticated
 */
export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated - please log in");
  }
  return userId;
}

/**
 * Get the currently authenticated user's ID, or null if not authenticated
 */
export async function getCurrentUserIdOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  return await auth.getUserId(ctx);
}

/**
 * Get the current user's profile from the database
 * Returns null if user not authenticated or profile doesn't exist
 */
export async function getCurrentUserProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getCurrentUserIdOrNull(ctx);
  if (!userId) return null;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  return profile;
}

/**
 * Get the current user's profile
 * Throws if user is not authenticated or profile doesn't exist
 */
export async function requireUserProfile(ctx: QueryCtx | MutationCtx) {
  const profile = await getCurrentUserProfile(ctx);
  if (!profile) {
    throw new Error("User profile not found");
  }
  return profile;
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(
  ctx: QueryCtx | MutationCtx,
  role: "customer" | "vendor" | "admin"
): Promise<boolean> {
  const profile = await getCurrentUserProfile(ctx);
  return profile?.role === role;
}

/**
 * Require that the current user has a specific role
 * Throws if user doesn't have the required role
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  role: "customer" | "vendor" | "admin"
) {
  const profile = await requireUserProfile(ctx);
  if (profile.role !== role) {
    throw new Error(`Unauthorized: ${role} role required`);
  }
  return profile;
}

/**
 * Check if the current user is a vendor
 */
export async function isVendor(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return await hasRole(ctx, "vendor");
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return await hasRole(ctx, "admin");
}

/**
 * Require that the current user is a vendor
 * Throws if user is not a vendor
 */
export async function requireVendor(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, "vendor");
}

/**
 * Require that the current user is an admin
 * Throws if user is not an admin
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, "admin");
}

/**
 * Check if the current user owns a resource
 * Useful for checking if user can edit/delete their own content
 */
export async function ownsResource(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: string
): Promise<boolean> {
  const userId = await getCurrentUserIdOrNull(ctx);
  return userId === resourceUserId;
}

/**
 * Require that the current user owns a resource
 * Throws if user doesn't own the resource
 */
export async function requireOwnership(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: string
) {
  const userId = await getCurrentUserId(ctx);
  if (userId !== resourceUserId) {
    throw new Error("Unauthorized: You don't own this resource");
  }
}

/**
 * Check if the current user can access a resource
 * Allows access if user owns it OR is an admin
 */
export async function canAccessResource(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: string
): Promise<boolean> {
  const isAdminUser = await isAdmin(ctx);
  if (isAdminUser) return true;

  return await ownsResource(ctx, resourceUserId);
}

/**
 * Require that the current user can access a resource
 * Allows access if user owns it OR is an admin
 * Throws if user cannot access
 */
export async function requireResourceAccess(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: string
) {
  const canAccess = await canAccessResource(ctx, resourceUserId);
  if (!canAccess) {
    throw new Error("Unauthorized: You cannot access this resource");
  }
}
