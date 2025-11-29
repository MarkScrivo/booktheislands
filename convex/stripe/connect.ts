/**
 * Stripe Connect Account Management
 *
 * Functions for managing vendor Stripe Connect accounts:
 * - Creating Express accounts
 * - Generating onboarding links
 * - Checking account status
 * - Managing commission rates
 */

import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { requireVendor, getCurrentUserId, requireAdmin } from "../lib/auth";
import { api, internal } from "../_generated/api";
import Stripe from "stripe";

// ============================================
// QUERIES (Read Operations)
// ============================================

/**
 * Get the current vendor's Connect account status
 * Returns onboarding status and account capabilities
 */
export const getAccountStatus = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireVendor(ctx);

    if (!profile.stripeConnectAccountId) {
      return {
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    return {
      hasAccount: true,
      accountId: profile.stripeConnectAccountId,
      onboardingComplete: profile.onboardingComplete || false,
      commissionRate: profile.commissionRate,
      payoutSchedule: profile.payoutSchedule,
      // Note: charges_enabled and payouts_enabled are checked via action
    };
  },
});

/**
 * Get the commission rate for a specific vendor
 * Used when calculating payment application fees
 */
export const getVendorCommissionRate = query({
  args: { vendorId: v.string() },
  handler: async (ctx, args) => {
    const vendorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.vendorId))
      .unique();

    if (!vendorProfile) {
      throw new Error("Vendor not found");
    }

    // Return vendor's custom rate or get default from platform settings
    if (vendorProfile.commissionRate !== undefined) {
      return vendorProfile.commissionRate;
    }

    // Get default platform commission rate
    const platformSettings = await ctx.db.query("platformSettings").first();
    return platformSettings?.defaultCommissionRate || 10; // Default 10% if not set
  },
});

/**
 * Get platform settings
 * Returns the default commission rate and other platform config
 */
export const getPlatformSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("platformSettings").first();
    return settings;
  },
});

// ============================================
// MUTATIONS (Write Operations)
// ============================================

/**
 * Update the current vendor's commission rate (Admin only)
 * This would typically be called by an admin interface
 */
export const setCommissionRate = mutation({
  args: {
    vendorId: v.string(),
    commissionRate: v.number(), // 0-100 percentage
  },
  handler: async (ctx, args) => {
    // Require admin role
    await requireAdmin(ctx);

    if (args.commissionRate < 0 || args.commissionRate > 100) {
      throw new Error("Commission rate must be between 0 and 100");
    }

    const vendorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.vendorId))
      .unique();

    if (!vendorProfile) {
      throw new Error("Vendor not found");
    }

    await ctx.db.patch(vendorProfile._id, {
      commissionRate: args.commissionRate,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to store Connect account ID after creation
 */
export const storeConnectAccount = mutation({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireVendor(ctx);

    await ctx.db.patch(profile._id, {
      stripeConnectAccountId: args.accountId,
      onboardingComplete: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update onboarding status
 * Called from webhook when account.updated event received
 */
export const updateOnboardingStatus = mutation({
  args: {
    accountId: v.string(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const vendorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_stripeAccount", (q) => q.eq("stripeConnectAccountId", args.accountId))
      .unique();

    if (!vendorProfile) {
      console.error(`No vendor found for Stripe account ${args.accountId}`);
      return { success: false };
    }

    const onboardingComplete = args.chargesEnabled && args.payoutsEnabled;

    await ctx.db.patch(vendorProfile._id, {
      onboardingComplete,
      updatedAt: Date.now(),
    });

    return { success: true, onboardingComplete };
  },
});

/**
 * Reset Stripe account for current vendor
 * Clears the Stripe account ID so vendor can create a new account
 * Useful for fixing accounts created with wrong country or for testing
 */
export const resetStripeAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireVendor(ctx);

    await ctx.db.patch(profile._id, {
      stripeConnectAccountId: undefined,
      onboardingComplete: false,
      updatedAt: Date.now(),
    });

    return { success: true, message: "Stripe account reset. You can now create a new account." };
  },
});

/**
 * Admin utility: Clear all Stripe Connect account IDs from all vendor profiles
 * WARNING: This is a development/testing utility - removes all Stripe account associations
 */
export const clearAllStripeAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all vendor profiles
    const vendors = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("role"), "vendor"))
      .collect();

    let cleared = 0;
    for (const vendor of vendors) {
      if (vendor.stripeConnectAccountId) {
        await ctx.db.patch(vendor._id, {
          stripeConnectAccountId: undefined,
          onboardingComplete: false,
          updatedAt: Date.now(),
        });
        cleared++;
      }
    }

    return {
      success: true,
      message: `Cleared ${cleared} Stripe account associations`,
      totalVendors: vendors.length,
      cleared,
    };
  },
});

// ============================================
// ACTIONS (External API Calls)
// ============================================

/**
 * Create a new Stripe Connect Express account for the current vendor
 * Returns the account ID which is then stored in the database
 */
export const createConnectAccount = action({
  args: {},
  handler: async (ctx) => {
    // Get current user profile
    const profile = await ctx.runQuery(api.profiles.current);
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (profile.role !== "vendor") {
      throw new Error("Only vendors can create Connect accounts");
    }

    // Check if already has account
    if (profile.stripeConnectAccountId) {
      return {
        success: true,
        accountId: profile.stripeConnectAccountId,
        alreadyExists: true,
      };
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    // Create Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US", // United States - fully supported for instant payout approval
      // TODO: Add country selection in vendor profile to support multiple countries (TH, GB, AU, etc.)
      // Note: Thailand (TH) requires manual Stripe approval for payouts capability
      email: profile.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual", // Most vendors are individuals
      settings: {
        payouts: {
          schedule: {
            interval: "weekly",
            weekly_anchor: "monday",
          },
        },
      },
      // In test mode, prefill with test data to avoid verification requirements
      ...(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && {
        individual: {
          email: profile.email,
          first_name: profile.fullName?.split(' ')[0] || 'Test',
          last_name: profile.fullName?.split(' ').slice(1).join(' ') || 'User',
          dob: {
            day: 1,
            month: 1,
            year: 1990,
          },
          address: {
            line1: '123 Test St',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94102',
            country: 'US',
          },
          ssn_last_4: '0000', // Test SSN
          phone: '+16505551234',
        },
      }),
    });

    // Store account ID in database
    await ctx.runMutation(internal.stripe.connect.storeConnectAccount, {
      accountId: account.id,
    });

    return {
      success: true,
      accountId: account.id,
      alreadyExists: false,
    };
  },
});

/**
 * Generate an Account Link for vendor onboarding
 * Opens Stripe-hosted onboarding flow
 */
export const createAccountLink = action({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    const accountLink = await stripe.accountLinks.create({
      account: args.accountId,
      refresh_url: `${process.env.SITE_URL}/vendor`,
      return_url: `${process.env.SITE_URL}/vendor`,
      type: "account_onboarding",
      collect: "eventually_due", // Only collect required fields now, not optional future fields
    });

    return {
      url: accountLink.url,
    };
  },
});

/**
 * Check detailed account status from Stripe API
 * Returns charges_enabled and payouts_enabled status
 */
export const checkAccountCapabilities = action({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    const account = await stripe.accounts.retrieve(args.accountId);

    // Update the database with the latest account status
    await ctx.runMutation(api.stripe.connect.updateOnboardingStatus, {
      accountId: args.accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });

    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
    };
  },
});

/**
 * Generate a login link for vendors to access their Express Dashboard
 * Vendors can view earnings, update bank details, and manage payouts
 */
export const createDashboardLink = action({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.runQuery(api.profiles.current);
    if (!profile || profile.role !== "vendor") {
      throw new Error("Only vendors can access the dashboard");
    }

    if (!profile.stripeConnectAccountId) {
      throw new Error("No Stripe Connect account found");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripeConnectAccountId
    );

    return {
      url: loginLink.url,
    };
  },
});

/**
 * Delete a Stripe Connect account
 * WARNING: This permanently deletes the account from Stripe
 * Only works for accounts that have never processed payments
 */
export const deleteStripeAccount = action({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    try {
      const deleted = await stripe.accounts.del(args.accountId);
      return {
        success: true,
        deleted: deleted.deleted,
        accountId: args.accountId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        accountId: args.accountId,
      };
    }
  },
});

/**
 * Delete multiple old/restricted test accounts from Stripe
 * Pass array of account IDs to delete
 */
export const deleteMultipleAccounts = action({
  args: {
    accountIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    const results = [];

    for (const accountId of args.accountIds) {
      try {
        const deleted = await stripe.accounts.del(accountId);
        results.push({
          accountId,
          success: true,
          deleted: deleted.deleted,
        });
      } catch (error: any) {
        results.push({
          accountId,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      results,
      summary: {
        total: args.accountIds.length,
        deleted: successCount,
        failed: failCount,
      },
    };
  },
});

/**
 * Get detailed account information for the current vendor
 * Returns comprehensive Stripe account details including balance, capabilities, and settings
 */
export const getDetailedAccountInfo = action({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.runQuery(api.profiles.current);
    if (!profile || profile.role !== "vendor") {
      throw new Error("Only vendors can access account details");
    }

    if (!profile.stripeConnectAccountId) {
      throw new Error("No Stripe Connect account found");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    // Fetch account details
    const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);

    // Fetch balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: profile.stripeConnectAccountId,
    });

    // Fetch recent payouts (last 10)
    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: profile.stripeConnectAccountId }
    );

    return {
      account: {
        id: account.id,
        email: account.email,
        country: account.country,
        defaultCurrency: account.default_currency,
        type: account.type,
        businessType: account.business_type,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        created: account.created,
        // Capabilities
        capabilities: {
          cardPayments: account.capabilities?.card_payments,
          transfers: account.capabilities?.transfers,
        },
        // Settings
        payoutSchedule: account.settings?.payouts?.schedule,
        // Requirements (if any)
        requirements: {
          currentlyDue: account.requirements?.currently_due || [],
          eventuallyDue: account.requirements?.eventually_due || [],
          pastDue: account.requirements?.past_due || [],
          pendingVerification: account.requirements?.pending_verification || [],
          disabled: account.requirements?.disabled_reason,
        },
        // Individual/Company info (sanitized)
        individual: account.individual ? {
          email: account.individual.email,
          firstName: account.individual.first_name,
          lastName: account.individual.last_name,
          verified: account.individual.verification?.status === 'verified',
        } : null,
      },
      balance: {
        available: balance.available.map(b => ({
          amount: b.amount,
          currency: b.currency,
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount,
          currency: b.currency,
        })),
      },
      recentPayouts: payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        arrivalDate: payout.arrival_date,
        created: payout.created,
        description: payout.description,
        method: payout.method,
        type: payout.type,
      })),
    };
  },
});

/**
 * Initialize platform settings with default commission rate
 * Should be called once during setup (or via admin interface)
 */
export const initializePlatformSettings = mutation({
  args: {
    defaultCommissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existing = await ctx.db.query("platformSettings").first();
    if (existing) {
      return { success: true, alreadyExists: true, settings: existing };
    }

    // Create default settings
    const settingsId = await ctx.db.insert("platformSettings", {
      defaultCommissionRate: args.defaultCommissionRate || 10, // Default 10%
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const settings = await ctx.db.get(settingsId);

    return { success: true, alreadyExists: false, settings };
  },
});
