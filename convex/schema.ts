// DisputeIQ Convex schema.
//
// Identity model: Clerk owns authentication. Every `users` row is keyed by
// `clerkUserId` (Clerk's stable subject) and mirrors Clerk's email +
// publicMetadata.role into the DB so Convex functions can FK against it.
//
// Enums are modeled as `v.union` of `v.literal` strings.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const userRole = v.union(
  v.literal("OWNER"),
  v.literal("ADMIN"),
  v.literal("SUPPORT"),
  v.literal("USER"),
);

const reportSource = v.union(
  v.literal("MANUAL_UPLOAD"),
  v.literal("MYFREESCORENOW"),
  v.literal("IDENTITYIQ"),
  v.literal("MYSCOREIQ"),
);

const creditProvider = v.union(
  v.literal("IDENTITYIQ"),
  v.literal("MYSCOREIQ"),
  v.literal("MYFREESCORENOW"),
  v.literal("MANUAL"),
);

const creditImportStatus = v.union(
  v.literal("PENDING"),
  v.literal("FETCHED"),
  v.literal("VALIDATED"),
  v.literal("NORMALIZED"),
  v.literal("FAILED"),
  v.literal("ARCHIVED"),
);

const creditReportBureau = v.union(
  v.literal("EXPERIAN"),
  v.literal("EQUIFAX"),
  v.literal("TRANSUNION"),
  v.literal("UNKNOWN"),
);

const disputeCandidateStage = v.union(
  v.literal("ROUND_1"),
  v.literal("ROUND_2"),
  v.literal("MOV"),
  v.literal("DIRECT_FURNISHER"),
  v.literal("CFPB"),
  v.literal("AG"),
  v.literal("STATE_REGULATOR"),
);

const disputeCandidateReason = v.union(
  v.literal("INACCURATE"),
  v.literal("INCOMPLETE"),
  v.literal("UNVERIFIABLE"),
  v.literal("DUPLICATE"),
  v.literal("OUTDATED"),
  v.literal("IDENTITY_THEFT"),
  v.literal("BALANCE_MISMATCH"),
  v.literal("STATUS_MISMATCH"),
  v.literal("OBSOLETE_BY_AGE"),
  v.literal("MEDICAL_UNDER_LIMIT"),
  v.literal("OTHER"),
);

const disputeStatus = v.union(
  v.literal("DRAFT"),
  v.literal("NEEDS_USER_CONFIRMATION"),
  v.literal("READY_FOR_PAYMENT"),
  v.literal("PAID"),
  v.literal("MAILED"),
  v.literal("DELIVERED"),
  v.literal("RESPONSE_RECEIVED"),
  v.literal("ESCALATION_READY"),
  v.literal("CLOSED"),
);

const letterType = v.union(
  v.literal("FACTUAL_DISPUTE"),
  v.literal("MOV_REQUEST"),
  v.literal("DIRECT_FURNISHER"),
  v.literal("IDENTITY_THEFT_605B"),
  v.literal("CFPB_PACKET"),
);

const paymentStatus = v.union(
  v.literal("PENDING"),
  v.literal("SUCCEEDED"),
  v.literal("FAILED"),
  v.literal("REFUNDED"),
);

const shadowStrikeProvider = v.union(
  v.literal("LEXISNEXIS"),
  v.literal("INNOVIS"),
  v.literal("SAGESTREAM"),
);

const mailProvider = v.literal("LETTERSTREAM");

const mailJobStatus = v.union(
  v.literal("QUEUED"),
  v.literal("SUBMITTED"),
  v.literal("ACCEPTED"),
  v.literal("PRINTED"),
  v.literal("MAILED"),
  v.literal("DELIVERED"),
  v.literal("FAILED"),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    role: userRole,
    isGraceUser: v.boolean(),
    archivedAt: v.optional(v.number()),
    archivedReason: v.optional(v.string()),
    archivedBy: v.optional(v.id("users")),
    piiAnonymizedAt: v.optional(v.number()),
    // VIP marker — set by admins on the Customer 360 page. Optional so
    // existing rows don't need a backfill.
    isVip: v.optional(v.boolean()),
    vipMarkedAt: v.optional(v.number()),
    vipMarkedByUserId: v.optional(v.id("users")),
    // App-layer billing override. Stripe stays the source of truth for
    // actual charges; this flag tells the customer-facing UI to
    // suppress upgrade prompts / past-due banners when set, and the
    // admin Customer 360 to render the appropriate badge.
    //   "free"        — comped account, no charges enforced.
    //   "discounted"  — % off; billingOverrideValue holds the percent.
    //   "custom"      — admin-defined; value is dollars/cents per cycle.
    // Admin clears the override to revert to standard Stripe billing.
    billingOverride: v.optional(
      v.union(
        v.literal("free"),
        v.literal("discounted"),
        v.literal("custom"),
      ),
    ),
    billingOverrideValue: v.optional(v.number()),
    billingOverrideReason: v.optional(v.string()),
    billingOverrideByUserId: v.optional(v.id("users")),
    billingOverrideAt: v.optional(v.number()),
    billingOverrideExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk", ["clerkUserId"])
    .index("by_email", ["email"]),

  // Internal admin-only notes attached to a customer. Visible only to
  // OWNER/ADMIN/SUPPORT. Author is the admin user who wrote it.
  customerNotes: defineTable({
    customerId: v.id("users"),
    authorUserId: v.id("users"),
    authorEmail: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("billing"),
      v.literal("escalation"),
      v.literal("compliance"),
    ),
    body: v.string(),
    pinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_customer", ["customerId", "createdAt"]),

  // Admin-set follow-up reminders for a customer (call back, check in,
  // etc.). Status moves from "pending" → "done" or "dismissed".
  customerFollowUps: defineTable({
    customerId: v.id("users"),
    createdByUserId: v.id("users"),
    body: v.string(),
    dueAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("dismissed"),
    ),
    completedAt: v.optional(v.number()),
    completedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId", "dueAt"])
    .index("by_customer_status", ["customerId", "status"]),

  // Two-way messaging between customers and admins. Each thread has
  // exactly one customer participant; admins are an undifferentiated
  // group (whoever picks up the thread is "the admin" for that message).
  // Per-side unread booleans on the thread are sufficient for v1 — we
  // don't need a per-message receipt table.
  messageThreads: defineTable({
    customerId: v.id("users"),
    subject: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolvedAt: v.optional(v.number()),
    resolvedByUserId: v.optional(v.id("users")),
    escalated: v.optional(v.boolean()),
    escalatedAt: v.optional(v.number()),
    escalatedByUserId: v.optional(v.id("users")),
    lastMessageAt: v.number(),
    lastMessageFrom: v.union(v.literal("customer"), v.literal("admin")),
    unreadForCustomer: v.boolean(),
    unreadForAdmin: v.boolean(),
    lastAdminUserId: v.optional(v.id("users")),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId", "lastMessageAt"])
    .index("by_admin_unread", ["unreadForAdmin", "lastMessageAt"])
    .index("by_customer_unread", ["customerId", "unreadForCustomer"]),

  messages: defineTable({
    threadId: v.id("messageThreads"),
    // Denormalized so the customer access check is one row read.
    customerId: v.id("users"),
    fromUserId: v.id("users"),
    fromRole: v.union(v.literal("customer"), v.literal("admin")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  // Phase-4 automation events. Each row is one rule firing for one
  // customer. The sweep is idempotent: when a rule is firing and an
  // open event already exists, we bump `lastSeenAt`; we never insert
  // duplicates. When a previously-firing rule no longer fires, we
  // auto-resolve the event.
  automationEvents: defineTable({
    customerId: v.id("users"),
    ruleKey: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("alert"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("reviewed"),
      v.literal("resolved"),
    ),
    label: v.string(),
    payloadJson: v.optional(v.any()),
    firstFiredAt: v.number(),
    lastSeenAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedByUserId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolvedByUserId: v.optional(v.id("users")),
    /** "auto" when the sweep auto-resolved a no-longer-firing event. */
    resolvedReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_customer_rule", ["customerId", "ruleKey"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_status_severity", ["status", "severity", "createdAt"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    encryptedDob: v.string(),
    encryptedSsnLast4: v.string(),
    encryptedAddress1: v.string(),
    encryptedCity: v.string(),
    encryptedState: v.string(),
    encryptedZip: v.string(),
    encryptedPhone: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  consentReceipts: defineTable({
    userId: v.id("users"),
    consentType: v.string(),
    version: v.string(),
    acceptedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_user", ["userId", "acceptedAt"]),

  creditReports: defineTable({
    userId: v.id("users"),
    source: reportSource,
    externalRef: v.optional(v.string()),
    pulledAt: v.number(),
    snapshotHash: v.string(),
    rawSecureRef: v.optional(v.string()),
  }).index("by_user", ["userId", "pulledAt"]),

  tradelines: defineTable({
    reportId: v.id("creditReports"),
    bureau: v.string(),
    creditorName: v.string(),
    accountRefMasked: v.string(),
    balanceCents: v.optional(v.number()),
    pastDueCents: v.optional(v.number()),
    statusLabel: v.optional(v.string()),
    openedAt: v.optional(v.number()),
    lastReportedAt: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),
    isCollection: v.boolean(),
    isMedical: v.boolean(),
    isFraudClaimed: v.boolean(),
  }).index("by_report", ["reportId"]),

  disputeCases: defineTable({
    userId: v.id("users"),
    tradelineId: v.optional(v.id("tradelines")),
    status: disputeStatus,
    letterType: letterType,
    aiReasonSummary: v.string(),
    legalBasisSummary: v.optional(v.string()),
    userConfirmedAt: v.optional(v.number()),
    responseDueAt: v.optional(v.number()),
    mailedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    secureLetterRef: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_tradeline", ["tradelineId"]),

  mailJobs: defineTable({
    disputeCaseId: v.id("disputeCases"),
    provider: mailProvider,
    providerJobId: v.optional(v.string()),
    trackingCode: v.optional(v.string()),
    signatureRef: v.optional(v.string()),
    mode: v.string(),
    certified: v.boolean(),
    err: v.boolean(),
    status: mailJobStatus,
    attempts: v.number(),
    lastError: v.optional(v.string()),
    rawResponseJson: v.optional(v.any()),
    costCents: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    mailedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    signedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_case", ["disputeCaseId"])
    .index("by_provider_job", ["providerJobId"]),

  mailJobEvents: defineTable({
    mailJobId: v.id("mailJobs"),
    kind: v.string(),
    rawStatus: v.optional(v.string()),
    mappedStatus: v.optional(mailJobStatus),
    message: v.optional(v.string()),
    payloadJson: v.optional(v.any()),
    occurredAt: v.number(),
  }).index("by_job", ["mailJobId", "occurredAt"]),

  caseAttachments: defineTable({
    disputeCaseId: v.id("disputeCases"),
    kind: v.string(),
    secureFileRef: v.string(),
    createdAt: v.number(),
  }).index("by_case", ["disputeCaseId"]),

  paymentIntents: defineTable({
    userId: v.id("users"),
    disputeCaseId: v.optional(v.id("disputeCases")),
    provider: v.string(),
    providerPaymentId: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    status: paymentStatus,
    description: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_provider_payment", ["providerPaymentId"]),

  shadowStrikeRequests: defineTable({
    userId: v.id("users"),
    provider: shadowStrikeProvider,
    status: v.string(),
    confirmationRef: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  userSubscriptions: defineTable({
    userId: v.id("users"),
    planCode: v.string(),
    status: v.string(),
    cycleStart: v.number(),
    cycleEnd: v.number(),
    includedPackets: v.number(),
    overagePacketPriceCents: v.number(),
    // Stripe is the live provider; squareSubscriptionId is retained as an
    // optional legacy field so any pre-cutover rows keep validating.
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    squareSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  leads: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.string(),
    topic: v.optional(v.string()),
    referralCode: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_source", ["source"]),

  referrals: defineTable({
    code: v.string(),
    ownerUserId: v.optional(v.id("users")),
    clicks: v.number(),
    signups: v.number(),
    conversions: v.number(),
    rewardCents: v.number(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_owner", ["ownerUserId"]),

  auditLogs: defineTable({
    targetUserId: v.optional(v.id("users")),
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadataJson: v.any(),
    createdAt: v.number(),
  })
    .index("by_target", ["targetUserId", "createdAt"])
    .index("by_actor", ["actorUserId", "createdAt"])
    .index("by_entity", ["entityType", "entityId"]),

  platformSettings: defineTable({
    key: v.string(),
    valueJson: v.any(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  supportNotes: defineTable({
    userId: v.id("users"),
    authorUserId: v.optional(v.id("users")),
    body: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("billing"),
      v.literal("report"),
      v.literal("escalation"),
    ),
    isInternal: v.boolean(),
    pinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),

  // One row per Chrome-extension install paired to a DisputeIQ account.
  // We never store the raw extension token — only its SHA-256 hash —
  // so a leak of this table cannot impersonate the extension.
  extensionPairings: defineTable({
    userId: v.id("users"),
    // SHA-256 hex of the long-lived extension-token. Lookup key.
    tokenHash: v.string(),
    // Pair-token jti, recorded for audit + future rotation.
    pairJti: v.optional(v.string()),
    extensionVersion: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    pairedAt: v.number(),
    expiresAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    lastImportAt: v.optional(v.number()),
    lastImportId: v.optional(v.id("creditReportImports")),
    lastErrorAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    revoked: v.boolean(),
    revokedAt: v.optional(v.number()),
    revokedReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_token_hash", ["tokenHash"]),

  creditReportImports: defineTable({
    userId: v.id("users"),
    provider: creditProvider,
    providerRef: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    status: creditImportStatus,
    // How the payload arrived. Common values:
    //   "auto-json"          — server-side fetch of provider JSON URL
    //   "browser-assisted"   — user copied JSON from authenticated tab
    //   "upload-json"        — user uploaded a .json file
    //   "paste-json"         — user pasted raw JSON
    //   "retry"              — re-normalization of an existing payload
    importMethod: v.optional(v.string()),
    fetchedAt: v.optional(v.number()),
    validatedAt: v.optional(v.number()),
    normalizedAt: v.optional(v.number()),
    schemaVersion: v.string(),
    parserVersion: v.string(),
    payloadHash: v.optional(v.string()),
    bureauCoverage: v.array(creditReportBureau),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorDetailJson: v.optional(v.any()),
    linkedReportId: v.optional(v.id("creditReports")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_provider_ref", ["provider", "providerRef"])
    .index("by_payload_hash", ["payloadHash"]),

  creditReportRaws: defineTable({
    importId: v.id("creditReportImports"),
    encryptedPayload: v.string(),
    payloadBytes: v.number(),
    contentEncoding: v.string(),
    payloadHash: v.string(),
    secureStorageRef: v.optional(v.string()),
    capturedAt: v.number(),
    redactionFingerprint: v.optional(v.string()),
  }).index("by_import", ["importId"]),

  creditReportNormalized: defineTable({
    importId: v.id("creditReportImports"),
    pulledAt: v.number(),
    reportIdProvider: v.optional(v.string()),
    bureaus: v.array(creditReportBureau),
    summaryJson: v.any(),
    unmappedFieldsJson: v.optional(v.any()),
    validationWarnings: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_import", ["importId"]),

  creditPersonalProfiles: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    fullName: v.optional(v.string()),
    encryptedDob: v.optional(v.string()),
    encryptedSsnLast4: v.optional(v.string()),
    encryptedPrimaryAddr: v.optional(v.string()),
    cityMasked: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    zipMasked: v.optional(v.string()),
    phoneMasked: v.optional(v.string()),
    employers: v.optional(v.any()),
    priorAddresses: v.optional(v.any()),
    aliases: v.array(v.string()),
    fraudAlerts: v.optional(v.any()),
    consumerStatement: v.optional(v.string()),
    unmappedFieldsJson: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_import_bureau", ["importId", "bureau"]),

  creditTradelines: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    fingerprint: v.string(),
    creditorName: v.string(),
    furnisherName: v.optional(v.string()),
    accountRefMasked: v.string(),
    accountType: v.optional(v.string()),
    accountSubtype: v.optional(v.string()),
    ownership: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    highBalanceCents: v.optional(v.number()),
    creditLimitCents: v.optional(v.number()),
    pastDueCents: v.optional(v.number()),
    monthlyPaymentCents: v.optional(v.number()),
    termsMonths: v.optional(v.number()),
    statusLabel: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    rawStatus: v.optional(v.string()),
    openedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    lastReportedAt: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),
    lastPaymentAt: v.optional(v.number()),
    isCollection: v.boolean(),
    isChargeOff: v.boolean(),
    isMedical: v.boolean(),
    isDerogatory: v.boolean(),
    isClosed: v.boolean(),
    isFraudClaimed: v.boolean(),
    paymentHistoryJson: v.optional(v.any()),
    remarks: v.array(v.string()),
    disputeFlags: v.array(v.string()),
    unmappedFieldsJson: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_import_bureau", ["importId", "bureau"])
    .index("by_fingerprint", ["fingerprint"]),

  creditInquiries: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    inquirerName: v.string(),
    inquirerType: v.optional(v.string()),
    inquiryDate: v.optional(v.number()),
    isHard: v.boolean(),
    purpose: v.optional(v.string()),
    unmappedFieldsJson: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_import_bureau", ["importId", "bureau"]),

  creditCollections: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    collectorName: v.string(),
    originalCreditor: v.optional(v.string()),
    accountRefMasked: v.string(),
    balanceCents: v.optional(v.number()),
    originalBalanceCents: v.optional(v.number()),
    statusLabel: v.optional(v.string()),
    assignedAt: v.optional(v.number()),
    reportedAt: v.optional(v.number()),
    firstDelinquencyAt: v.optional(v.number()),
    isMedical: v.boolean(),
    unmappedFieldsJson: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_import_bureau", ["importId", "bureau"]),

  creditPublicRecords: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    recordType: v.string(),
    status: v.optional(v.string()),
    courtName: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    filedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    amountCents: v.optional(v.number()),
    unmappedFieldsJson: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_import_bureau", ["importId", "bureau"]),

  creditScoreSnapshots: defineTable({
    importId: v.id("creditReportImports"),
    bureau: creditReportBureau,
    scoreModel: v.string(),
    score: v.number(),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
    factors: v.array(v.string()),
    pulledAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_import_bureau", ["importId", "bureau"]),

  creditDisputeCandidates: defineTable({
    importId: v.id("creditReportImports"),
    tradelineId: v.optional(v.id("creditTradelines")),
    bureau: creditReportBureau,
    stage: disputeCandidateStage,
    reason: disputeCandidateReason,
    reasonCodes: v.array(v.string()),
    severity: v.string(),
    summary: v.string(),
    evidenceJson: v.any(),
    legalBasis: v.array(v.string()),
    confidence: v.string(),
    promotedCaseId: v.optional(v.id("disputeCases")),
    createdAt: v.number(),
  })
    .index("by_import_bureau", ["importId", "bureau"])
    .index("by_tradeline", ["tradelineId"]),
});
