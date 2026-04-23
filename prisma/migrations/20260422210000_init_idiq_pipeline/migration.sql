-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT', 'USER');

-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('MANUAL_UPLOAD', 'MYFREESCORENOW', 'IDENTITYIQ', 'MYSCOREIQ');

-- CreateEnum
CREATE TYPE "CreditProvider" AS ENUM ('IDENTITYIQ', 'MYSCOREIQ', 'MYFREESCORENOW', 'MANUAL');

-- CreateEnum
CREATE TYPE "CreditImportStatus" AS ENUM ('PENDING', 'FETCHED', 'VALIDATED', 'NORMALIZED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CreditReportBureau" AS ENUM ('EXPERIAN', 'EQUIFAX', 'TRANSUNION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DisputeCandidateStage" AS ENUM ('ROUND_1', 'ROUND_2', 'MOV', 'DIRECT_FURNISHER', 'CFPB', 'AG', 'STATE_REGULATOR');

-- CreateEnum
CREATE TYPE "DisputeCandidateReason" AS ENUM ('INACCURATE', 'INCOMPLETE', 'UNVERIFIABLE', 'DUPLICATE', 'OUTDATED', 'IDENTITY_THEFT', 'BALANCE_MISMATCH', 'STATUS_MISMATCH', 'OBSOLETE_BY_AGE', 'MEDICAL_UNDER_LIMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('DRAFT', 'NEEDS_USER_CONFIRMATION', 'READY_FOR_PAYMENT', 'PAID', 'MAILED', 'DELIVERED', 'RESPONSE_RECEIVED', 'ESCALATION_READY', 'CLOSED');

-- CreateEnum
CREATE TYPE "LetterType" AS ENUM ('FACTUAL_DISPUTE', 'MOV_REQUEST', 'DIRECT_FURNISHER', 'IDENTITY_THEFT_605B', 'CFPB_PACKET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShadowStrikeProvider" AS ENUM ('LEXISNEXIS', 'INNOVIS', 'SAGESTREAM');

-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('LETTERSTREAM');

-- CreateEnum
CREATE TYPE "MailJobStatus" AS ENUM ('QUEUED', 'SUBMITTED', 'ACCEPTED', 'PRINTED', 'MAILED', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isGraceUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "archivedBy" TEXT,
    "piiAnonymizedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "encryptedDob" TEXT NOT NULL,
    "encryptedSsnLast4" TEXT NOT NULL,
    "encryptedAddress1" TEXT NOT NULL,
    "encryptedCity" TEXT NOT NULL,
    "encryptedState" TEXT NOT NULL,
    "encryptedZip" TEXT NOT NULL,
    "encryptedPhone" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ConsentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ReportSource" NOT NULL,
    "externalRef" TEXT,
    "pulledAt" TIMESTAMP(3) NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "rawSecureRef" TEXT,

    CONSTRAINT "CreditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tradeline" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "bureau" TEXT NOT NULL,
    "creditorName" TEXT NOT NULL,
    "accountRefMasked" TEXT NOT NULL,
    "balanceCents" INTEGER,
    "pastDueCents" INTEGER,
    "statusLabel" TEXT,
    "openedAt" TIMESTAMP(3),
    "lastReportedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "isCollection" BOOLEAN NOT NULL DEFAULT false,
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "isFraudClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tradeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradelineId" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'DRAFT',
    "letterType" "LetterType" NOT NULL,
    "aiReasonSummary" TEXT NOT NULL,
    "legalBasisSummary" TEXT,
    "userConfirmedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "mailedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "secureLetterRef" TEXT,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailJob" (
    "id" TEXT NOT NULL,
    "disputeCaseId" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL DEFAULT 'LETTERSTREAM',
    "providerJobId" TEXT,
    "trackingCode" TEXT,
    "signatureRef" TEXT,
    "mode" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT true,
    "err" BOOLEAN NOT NULL DEFAULT true,
    "status" "MailJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "rawResponseJson" JSONB,
    "costCents" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "mailedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailJobEvent" (
    "id" TEXT NOT NULL,
    "mailJobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rawStatus" TEXT,
    "mappedStatus" "MailJobStatus",
    "message" TEXT,
    "payloadJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAttachment" (
    "id" TEXT NOT NULL,
    "disputeCaseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "secureFileRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disputeCaseId" TEXT,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowStrikeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ShadowStrikeProvider" NOT NULL,
    "status" TEXT NOT NULL,
    "confirmationRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowStrikeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "includedPackets" INTEGER NOT NULL,
    "overagePacketPriceCents" INTEGER NOT NULL DEFAULT 1995,
    "squareSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "topic" TEXT,
    "referralCode" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "rewardCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SupportNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReportImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CreditProvider" NOT NULL,
    "providerRef" TEXT,
    "sourceUrl" TEXT,
    "status" "CreditImportStatus" NOT NULL DEFAULT 'PENDING',
    "fetchedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "normalizedAt" TIMESTAMP(3),
    "schemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "parserVersion" TEXT NOT NULL DEFAULT 'v1',
    "payloadHash" TEXT,
    "bureauCoverage" "CreditReportBureau"[] DEFAULT ARRAY[]::"CreditReportBureau"[],
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetailJson" JSONB,
    "linkedReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReportImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReportRaw" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "contentEncoding" TEXT NOT NULL DEFAULT 'application/json',
    "payloadHash" TEXT NOT NULL,
    "secureStorageRef" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redactionFingerprint" TEXT,

    CONSTRAINT "CreditReportRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReportNormalized" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "pulledAt" TIMESTAMP(3) NOT NULL,
    "reportIdProvider" TEXT,
    "bureaus" "CreditReportBureau"[] DEFAULT ARRAY[]::"CreditReportBureau"[],
    "summaryJson" JSONB NOT NULL,
    "unmappedFieldsJson" JSONB,
    "validationWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditReportNormalized_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPersonalProfile" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL DEFAULT 'UNKNOWN',
    "fullName" TEXT,
    "encryptedDob" TEXT,
    "encryptedSsnLast4" TEXT,
    "encryptedPrimaryAddr" TEXT,
    "cityMasked" TEXT,
    "stateCode" TEXT,
    "zipMasked" TEXT,
    "phoneMasked" TEXT,
    "employers" JSONB,
    "priorAddresses" JSONB,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fraudAlerts" JSONB,
    "consumerStatement" TEXT,
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPersonalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTradeline" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "creditorName" TEXT NOT NULL,
    "furnisherName" TEXT,
    "accountRefMasked" TEXT NOT NULL,
    "accountType" TEXT,
    "accountSubtype" TEXT,
    "ownership" TEXT,
    "balanceCents" INTEGER,
    "highBalanceCents" INTEGER,
    "creditLimitCents" INTEGER,
    "pastDueCents" INTEGER,
    "monthlyPaymentCents" INTEGER,
    "termsMonths" INTEGER,
    "statusLabel" TEXT,
    "paymentStatus" TEXT,
    "rawStatus" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastReportedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "isCollection" BOOLEAN NOT NULL DEFAULT false,
    "isChargeOff" BOOLEAN NOT NULL DEFAULT false,
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "isDerogatory" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isFraudClaimed" BOOLEAN NOT NULL DEFAULT false,
    "paymentHistoryJson" JSONB,
    "remarks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disputeFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTradeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditInquiry" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL,
    "inquirerName" TEXT NOT NULL,
    "inquirerType" TEXT,
    "inquiryDate" TIMESTAMP(3),
    "isHard" BOOLEAN NOT NULL DEFAULT true,
    "purpose" TEXT,
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCollection" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL,
    "collectorName" TEXT NOT NULL,
    "originalCreditor" TEXT,
    "accountRefMasked" TEXT NOT NULL,
    "balanceCents" INTEGER,
    "originalBalanceCents" INTEGER,
    "statusLabel" TEXT,
    "assignedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "firstDelinquencyAt" TIMESTAMP(3),
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPublicRecord" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL,
    "recordType" TEXT NOT NULL,
    "status" TEXT,
    "courtName" TEXT,
    "referenceNumber" TEXT,
    "filedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "amountCents" INTEGER,
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPublicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditScoreSnapshot" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bureau" "CreditReportBureau" NOT NULL,
    "scoreModel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rangeMin" INTEGER,
    "rangeMax" INTEGER,
    "factors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pulledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDisputeCandidate" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "tradelineId" TEXT,
    "bureau" "CreditReportBureau" NOT NULL,
    "stage" "DisputeCandidateStage" NOT NULL DEFAULT 'ROUND_1',
    "reason" "DisputeCandidateReason" NOT NULL,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "summary" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "legalBasis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "promotedCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditDisputeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MailJob_providerJobId_key" ON "MailJob"("providerJobId");

-- CreateIndex
CREATE INDEX "MailJobEvent_mailJobId_occurredAt_idx" ON "MailJobEvent"("mailJobId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerPaymentId_key" ON "PaymentIntent"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_ownerUserId_idx" ON "Referral"("ownerUserId");

-- CreateIndex
CREATE INDEX "SupportNote_userId_createdAt_idx" ON "SupportNote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditReportImport_userId_status_idx" ON "CreditReportImport"("userId", "status");

-- CreateIndex
CREATE INDEX "CreditReportImport_provider_providerRef_idx" ON "CreditReportImport"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "CreditReportImport_payloadHash_idx" ON "CreditReportImport"("payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReportRaw_importId_key" ON "CreditReportRaw"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReportNormalized_importId_key" ON "CreditReportNormalized"("importId");

-- CreateIndex
CREATE INDEX "CreditPersonalProfile_importId_bureau_idx" ON "CreditPersonalProfile"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditTradeline_importId_bureau_idx" ON "CreditTradeline"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditTradeline_fingerprint_idx" ON "CreditTradeline"("fingerprint");

-- CreateIndex
CREATE INDEX "CreditInquiry_importId_bureau_idx" ON "CreditInquiry"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditCollection_importId_bureau_idx" ON "CreditCollection"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditPublicRecord_importId_bureau_idx" ON "CreditPublicRecord"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditScoreSnapshot_importId_bureau_idx" ON "CreditScoreSnapshot"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditDisputeCandidate_importId_bureau_idx" ON "CreditDisputeCandidate"("importId", "bureau");

-- CreateIndex
CREATE INDEX "CreditDisputeCandidate_tradelineId_idx" ON "CreditDisputeCandidate"("tradelineId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentReceipt" ADD CONSTRAINT "ConsentReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tradeline" ADD CONSTRAINT "Tradeline_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "Tradeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailJob" ADD CONSTRAINT "MailJob_disputeCaseId_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailJobEvent" ADD CONSTRAINT "MailJobEvent_mailJobId_fkey" FOREIGN KEY ("mailJobId") REFERENCES "MailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAttachment" ADD CONSTRAINT "CaseAttachment_disputeCaseId_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_disputeCaseId_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowStrikeRequest" ADD CONSTRAINT "ShadowStrikeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportImport" ADD CONSTRAINT "CreditReportImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportRaw" ADD CONSTRAINT "CreditReportRaw_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportNormalized" ADD CONSTRAINT "CreditReportNormalized_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPersonalProfile" ADD CONSTRAINT "CreditPersonalProfile_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTradeline" ADD CONSTRAINT "CreditTradeline_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditInquiry" ADD CONSTRAINT "CreditInquiry_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCollection" ADD CONSTRAINT "CreditCollection_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPublicRecord" ADD CONSTRAINT "CreditPublicRecord_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditScoreSnapshot" ADD CONSTRAINT "CreditScoreSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDisputeCandidate" ADD CONSTRAINT "CreditDisputeCandidate_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CreditReportImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDisputeCandidate" ADD CONSTRAINT "CreditDisputeCandidate_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "CreditTradeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

