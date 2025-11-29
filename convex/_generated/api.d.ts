/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as availability_rules from "../availability/rules.js";
import type * as availability_slots from "../availability/slots.js";
import type * as availability_waitlist from "../availability/waitlist.js";
import type * as bookings from "../bookings.js";
import type * as cron_jobs from "../cron/jobs.js";
import type * as crons from "../crons.js";
import type * as dev_createAdmin from "../dev/createAdmin.js";
import type * as dev_debugAuth from "../dev/debugAuth.js";
import type * as dev_getRecentBookings from "../dev/getRecentBookings.js";
import type * as dev_signupAdmin from "../dev/signupAdmin.js";
import type * as dev_testNotifications from "../dev/testNotifications.js";
import type * as dev_updatePassword from "../dev/updatePassword.js";
import type * as files from "../files.js";
import type * as fixOrphanedUsers from "../fixOrphanedUsers.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as listings from "../listings.js";
import type * as messages from "../messages.js";
import type * as notifications_email from "../notifications/email.js";
import type * as notifications_inApp from "../notifications/inApp.js";
import type * as profiles from "../profiles.js";
import type * as reviews from "../reviews.js";
import type * as seedData from "../seedData.js";
import type * as stripe_connect from "../stripe/connect.js";
import type * as stripe_payments from "../stripe/payments.js";
import type * as stripe_webhooks from "../stripe/webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  "availability/rules": typeof availability_rules;
  "availability/slots": typeof availability_slots;
  "availability/waitlist": typeof availability_waitlist;
  bookings: typeof bookings;
  "cron/jobs": typeof cron_jobs;
  crons: typeof crons;
  "dev/createAdmin": typeof dev_createAdmin;
  "dev/debugAuth": typeof dev_debugAuth;
  "dev/getRecentBookings": typeof dev_getRecentBookings;
  "dev/signupAdmin": typeof dev_signupAdmin;
  "dev/testNotifications": typeof dev_testNotifications;
  "dev/updatePassword": typeof dev_updatePassword;
  files: typeof files;
  fixOrphanedUsers: typeof fixOrphanedUsers;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  listings: typeof listings;
  messages: typeof messages;
  "notifications/email": typeof notifications_email;
  "notifications/inApp": typeof notifications_inApp;
  profiles: typeof profiles;
  reviews: typeof reviews;
  seedData: typeof seedData;
  "stripe/connect": typeof stripe_connect;
  "stripe/payments": typeof stripe_payments;
  "stripe/webhooks": typeof stripe_webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
