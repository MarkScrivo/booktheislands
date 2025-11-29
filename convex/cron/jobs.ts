/**
 * Cron Job Implementations
 *
 * Background tasks that run on schedule to maintain the calendar system
 */

import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

// ============================================
// GENERATE SLOTS DAILY
// ============================================

export const generateSlotsDaily = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Cron] Starting daily slot generation");

    // Get all active availability rules
    const rules = await ctx.db
      .query("availabilityRules")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    console.log(`[Cron] Found ${rules.length} active rules`);

    let totalGenerated = 0;

    for (const rule of rules) {
      try {
        // Calculate date range based on rule settings
        const today = new Date();
        const startDate = today.toISOString().split('T')[0];

        let endDate: string;
        if (rule.generateDaysInAdvance === 'indefinite') {
          // For indefinite, generate 90 days ahead
          const end = new Date(today);
          end.setDate(end.getDate() + 90);
          endDate = end.toISOString().split('T')[0];
        } else {
          const end = new Date(today);
          end.setDate(end.getDate() + rule.generateDaysInAdvance);
          endDate = end.toISOString().split('T')[0];
        }

        // Generate slots for this rule
        const result = await ctx.scheduler.runAfter(
          0,
          internal.availability.slots.generateFromRule,
          {
            ruleId: rule._id,
            startDate,
            endDate,
          }
        );

        console.log(`[Cron] Generated slots for rule ${rule._id}`);
        // Note: result is a Promise<void> for scheduler calls, actual count logged in the function
      } catch (error) {
        console.error(`[Cron] Error generating slots for rule ${rule._id}:`, error);
      }
    }

    console.log(`[Cron] Completed daily slot generation`);

    return { success: true, rulesProcessed: rules.length };
  },
});

// ============================================
// PROCESS WAITLIST EXPIRY
// ============================================

export const processWaitlistExpiry = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Cron] Starting waitlist expiry processing");

    // Expire stale notifications
    const expireResult = await ctx.runMutation(
      internal.availability.waitlist.expireStaleNotifications,
      {}
    );

    console.log(`[Cron] Expired ${expireResult.expired} stale notifications`);

    // Notify next person for each affected slot
    for (const slotId of expireResult.slotsNeedingNotification) {
      try {
        await ctx.scheduler.runAfter(0, internal.availability.waitlist.notifyNext, {
          slotId,
        });
        console.log(`[Cron] Scheduled notification for slot ${slotId}`);
      } catch (error) {
        console.error(`[Cron] Error notifying next for slot ${slotId}:`, error);
      }
    }

    console.log("[Cron] Completed waitlist expiry processing");

    return {
      success: true,
      expired: expireResult.expired,
      slotsNotified: expireResult.slotsNeedingNotification.length,
    };
  },
});

// ============================================
// MARK PAST SLOTS AS COMPLETED
// ============================================

export const markPastSlotsCompleted = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Cron] Starting marking past slots as completed");

    const now = Date.now();
    const today = new Date(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    // Find all active slots from yesterday or earlier
    const pastSlots = await ctx.db
      .query("slots")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.lte(q.field("date"), yesterdayString))
      .collect();

    console.log(`[Cron] Found ${pastSlots.length} past slots to mark as completed`);

    let markedCount = 0;

    for (const slot of pastSlots) {
      try {
        await ctx.db.patch(slot._id, {
          status: "completed",
          updatedAt: now,
        });
        markedCount++;
      } catch (error) {
        console.error(`[Cron] Error marking slot ${slot._id} as completed:`, error);
      }
    }

    console.log(`[Cron] Marked ${markedCount} slots as completed`);

    return {
      success: true,
      markedCount,
    };
  },
});

// ============================================
// SEND BOOKING REMINDERS (Optional - Future)
// ============================================

/**
 * Send 24-hour reminders for upcoming bookings
 * TODO: Implement when needed
 */
export const sendBookingReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Cron] Starting booking reminders");

    const now = Date.now();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    // Find all confirmed bookings for tomorrow
    const upcomingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_date", (q) => q.eq("bookingDate", tomorrowString))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();

    console.log(`[Cron] Found ${upcomingBookings.length} bookings for tomorrow`);

    // TODO: Send reminder notifications
    // For each booking:
    // 1. Get slot details
    // 2. Get listing details
    // 3. Send in-app notification
    // 4. Send email reminder

    console.log("[Cron] Booking reminders completed (not yet implemented)");

    return {
      success: true,
      remindersCount: 0, // Will update when implemented
    };
  },
});
