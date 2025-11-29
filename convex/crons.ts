/**
 * Cron Jobs for Discover Phangan
 *
 * Scheduled background tasks for:
 * - Generating slots from availability rules
 * - Processing waitlist notifications
 * - Marking past slots as completed
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============================================
// GENERATE SLOTS DAILY
// ============================================

/**
 * Run every day at 2:00 AM Thailand time (UTC+7 = 19:00 UTC previous day)
 * Generates slots for all active availability rules
 */
crons.daily(
  "generate slots from rules",
  { hourUTC: 19, minuteUTC: 0 }, // 2:00 AM Bangkok time
  internal.cron.jobs.generateSlotsDaily
);

// ============================================
// PROCESS WAITLIST EXPIRY
// ============================================

/**
 * Run every hour to expire stale waitlist notifications
 * and notify the next person in line
 */
crons.hourly(
  "expire waitlist notifications",
  { minuteUTC: 15 }, // Run at :15 past each hour
  internal.cron.jobs.processWaitlistExpiry
);

// ============================================
// MARK PAST SLOTS AS COMPLETED
// ============================================

/**
 * Run every hour to mark slots that have passed as completed
 */
crons.hourly(
  "mark past slots completed",
  { minuteUTC: 30 }, // Run at :30 past each hour
  internal.cron.jobs.markPastSlotsCompleted
);

// ============================================
// BOOKING REMINDERS (Optional - for future)
// ============================================

/**
 * Run twice daily to send 24-hour reminders
 * TODO: Implement booking reminder notifications
 */
// crons.daily(
//   "send booking reminders",
//   { hourUTC: 2, minuteUTC: 0 }, // 9:00 AM Bangkok time
//   internal.cron.jobs.sendBookingReminders
// );

export default crons;
