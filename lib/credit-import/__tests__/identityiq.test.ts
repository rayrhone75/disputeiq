import { describe, it, expect } from "vitest";
import sample from "../fixtures/identityiq-sample.json";
import { identityIqAdapter } from "../providers/identityiq";
import { runDisputeEngine } from "../dispute-engine";
import { NormalizedReportZ } from "../schemas";

describe("IdentityIQ adapter", () => {
  it("matches the sample payload", () => {
    expect(identityIqAdapter.matches(sample)).toBe(true);
  });

  it("normalizes tradelines, inquiries, collections, public records, scores", () => {
    const r = identityIqAdapter.normalize(sample);
    expect(r.tradelines.length).toBeGreaterThan(0);
    expect(r.inquiries.length).toBeGreaterThan(0);
    expect(r.collections.length).toBeGreaterThan(0);
    expect(r.publicRecords.length).toBeGreaterThan(0);
    expect(r.scores.length).toBe(3);
    expect(r.bureausDetected).toEqual(
      expect.arrayContaining(["EXPERIAN", "EQUIFAX", "TRANSUNION"]),
    );
  });

  it("output passes normalized-report zod validation", () => {
    const r = identityIqAdapter.normalize(sample);
    const parsed = NormalizedReportZ.safeParse(r);
    expect(parsed.success).toBe(true);
  });

  it("masks account numbers and never exposes full SSN", () => {
    const r = identityIqAdapter.normalize(sample);
    for (const t of r.tradelines) {
      expect(t.accountRefMasked.startsWith("••••")).toBe(true);
    }
    const profile = r.profiles[0];
    if (profile?.ssnLast4) expect(profile.ssnLast4.length).toBe(4);
  });
});

describe("dispute engine", () => {
  it("emits cross-bureau balance mismatch for Capital One", () => {
    const r = identityIqAdapter.normalize(sample);
    const cands = runDisputeEngine(r);
    const mismatch = cands.find((c) => c.reasonCodes.includes("CROSS_BUREAU_BALANCE"));
    expect(mismatch).toBeDefined();
  });

  it("flags medical collection under $500", () => {
    const r = identityIqAdapter.normalize(sample);
    const cands = runDisputeEngine(r);
    const med = cands.find((c) => c.reason === "MEDICAL_UNDER_LIMIT");
    expect(med).toBeDefined();
  });

  it("flags old hard inquiry as obsolete by age (2-year rule)", () => {
    const r = identityIqAdapter.normalize(sample);
    const cands = runDisputeEngine(r);
    const inq = cands.find((c) => c.reasonCodes.includes("FCRA_2_YEAR_INQUIRY"));
    expect(inq).toBeDefined();
  });

  it("flags 10+ year bankruptcy", () => {
    const r = identityIqAdapter.normalize(sample);
    const cands = runDisputeEngine(r);
    const bk = cands.find((c) => c.reasonCodes.includes("FCRA_10_YEAR_PUBREC"));
    expect(bk).toBeDefined();
  });
});
