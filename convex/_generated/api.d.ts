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
import type * as adminCustomers from "../adminCustomers.js";
import type * as auditLogs from "../auditLogs.js";
import type * as caseAttachments from "../caseAttachments.js";
import type * as creditImports from "../creditImports.js";
import type * as creditReports from "../creditReports.js";
import type * as disputes from "../disputes.js";
import type * as extensionPairings from "../extensionPairings.js";
import type * as helpers from "../helpers.js";
import type * as leads from "../leads.js";
import type * as mailJobs from "../mailJobs.js";
import type * as messages from "../messages.js";
import type * as onboarding from "../onboarding.js";
import type * as payments from "../payments.js";
import type * as platformSettings from "../platformSettings.js";
import type * as profile from "../profile.js";
import type * as proofVault from "../proofVault.js";
import type * as referrals from "../referrals.js";
import type * as subscriptions from "../subscriptions.js";
import type * as support from "../support.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminCustomers: typeof adminCustomers;
  auditLogs: typeof auditLogs;
  caseAttachments: typeof caseAttachments;
  creditImports: typeof creditImports;
  creditReports: typeof creditReports;
  disputes: typeof disputes;
  extensionPairings: typeof extensionPairings;
  helpers: typeof helpers;
  leads: typeof leads;
  mailJobs: typeof mailJobs;
  messages: typeof messages;
  onboarding: typeof onboarding;
  payments: typeof payments;
  platformSettings: typeof platformSettings;
  profile: typeof profile;
  proofVault: typeof proofVault;
  referrals: typeof referrals;
  subscriptions: typeof subscriptions;
  support: typeof support;
  users: typeof users;
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
