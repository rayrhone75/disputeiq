import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Customer-facing snapshot of the latest credit-report import.
//
// Powers the "Results" step on /dashboard/get-report. Returns enough
// aggregate counts to render the headline stats (tradelines, negatives,
// candidates, bureaus) without exposing any raw report data, JSON, or
// internal status enums.
//
// Uses only pre-existing Convex queries (`latestForCurrentUser`,
// `getOwnedImport`) — no new mutations, safe against the deployed cloud
// schema.

export const dynamic = "force-dynamic";

type SnapshotKind = "none" | "in_progress" | "ready" | "failed";

export type CreditReportSnapshot = {
  kind: SnapshotKind;
  importId: string | null;
  bureausDetected: string[];
  tradelineCount: number;
  inquiryCount: number;
  collectionCount: number;
  publicRecordCount: number;
  negativeCount: number;
  candidateCount: number;
  importedAt: string | null;
};

const EMPTY: CreditReportSnapshot = {
  kind: "none",
  importId: null,
  bureausDetected: [],
  tradelineCount: 0,
  inquiryCount: 0,
  collectionCount: 0,
  publicRecordCount: 0,
  negativeCount: 0,
  candidateCount: 0,
  importedAt: null,
};

function looksLikeJwt(token: unknown): token is string {
  return (
    typeof token === "string" && token.split(".").length === 3 && token.length > 20
  );
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  try {
    const token = await getToken({ template: "convex" });
    const opts = { token: looksLikeJwt(token) ? (token as string) : undefined } as const;

    const latest = await fetchQuery(
      api.creditImports.latestForCurrentUser,
      {},
      opts,
    );
    if (!latest) {
      return NextResponse.json({ ok: true, snapshot: EMPTY });
    }
    if (latest.status === "FAILED") {
      return NextResponse.json({
        ok: true,
        snapshot: { ...EMPTY, kind: "failed", importId: latest._id as unknown as string },
      });
    }
    if (latest.status !== "NORMALIZED") {
      return NextResponse.json({
        ok: true,
        snapshot: {
          ...EMPTY,
          kind: "in_progress",
          importId: latest._id as unknown as string,
          bureausDetected: latest.bureauCoverage ?? [],
        },
      });
    }
    const owned = await fetchQuery(
      api.creditImports.getOwnedImport,
      { id: latest._id },
      opts,
    );
    if (!owned) {
      return NextResponse.json({ ok: true, snapshot: EMPTY });
    }
    const negativeCount =
      (owned.counts.collections ?? 0) + (owned.counts.publicRecords ?? 0);
    const importedAt = latest.normalizedAt
      ? new Date(latest.normalizedAt).toISOString()
      : new Date(latest.updatedAt).toISOString();

    const snapshot: CreditReportSnapshot = {
      kind: "ready",
      importId: latest._id as unknown as string,
      bureausDetected: owned.normalized?.bureaus ?? latest.bureauCoverage ?? [],
      tradelineCount: owned.counts.tradelines ?? 0,
      inquiryCount: owned.counts.inquiries ?? 0,
      collectionCount: owned.counts.collections ?? 0,
      publicRecordCount: owned.counts.publicRecords ?? 0,
      negativeCount,
      candidateCount: owned.counts.disputeCandidates ?? 0,
      importedAt,
    };
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "SNAPSHOT_FAILED",
        message: (err as Error).message,
        snapshot: EMPTY,
      },
      { status: 200 },
    );
  }
}
