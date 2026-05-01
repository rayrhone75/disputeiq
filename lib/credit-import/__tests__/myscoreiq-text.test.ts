import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMyScoreIQText } from "../myscoreiq-text";
import { myScoreIqAdapter } from "../providers/identityiq";
import { runDisputeEngine } from "../dispute-engine";
import { NormalizedReportZ } from "../schemas";

// End-to-end coverage of the dedicated MyScoreIQ PDF/HTML text parser.
//
// Strategy: feed it a synthetic-but-realistic tri-merge report
// (lib/credit-import/fixtures/myscoreiq-sample.txt) that mirrors the
// canonical MyScoreIQ section layout — the same shape `parseReportPdf`
// produces from a real PDF. Verify the parser extracts the right
// counts, then verify the JSON it emits round-trips through the
// existing MyScoreIQ JSON adapter + dispute engine without
// modification. That last check is what guarantees the upload-any
// route can wrap a PDF in this parser and have the customer see real
// dispute candidates.

const fixturePath = join(
  __dirname,
  "..",
  "fixtures",
  "myscoreiq-sample.txt",
);
const fixtureText = readFileSync(fixturePath, "utf8");

describe("parseMyScoreIQText", () => {
  it("returns high confidence for a well-formed tri-merge", () => {
    const r = parseMyScoreIQText(fixtureText);
    expect(r.confidence).toBe("high");
    expect(r.counts.tradelines).toBeGreaterThan(0);
  });

  it("extracts borrower personal information", () => {
    const r = parseMyScoreIQText(fixtureText);
    expect(r.json.borrower?.fullName).toBe("Jane Q Consumer");
    expect(r.json.borrower?.dateOfBirth).toBe("1985-04-12");
    expect(r.json.borrower?.phone).toBe("510-555-0101");
    expect(r.json.borrower?.currentAddress?.city).toBe("Oakland");
    expect(r.json.borrower?.currentAddress?.state).toBe("CA");
    expect(r.json.borrower?.currentAddress?.zip).toBe("94601");
  });

  it("extracts a score for each bureau", () => {
    const r = parseMyScoreIQText(fixtureText);
    const bureaus = r.json.creditScores?.map((s) => s.bureau).sort();
    expect(bureaus).toEqual(["Equifax", "Experian", "TransUnion"]);
    const exp = r.json.creditScores?.find((s) => s.bureau === "Experian");
    expect(exp?.score).toBe(642);
  });

  it("extracts tradelines per bureau with status / balance / dates", () => {
    const r = parseMyScoreIQText(fixtureText);
    // Five accounts × three bureaus → fifteen tradeline rows. Even if
    // detection is imperfect we should land at least 12.
    expect(r.counts.tradelines).toBeGreaterThanOrEqual(12);

    const capOne = r.json.tradelines!.filter((t) =>
      /CAPITAL ONE/i.test(t.creditorName),
    );
    expect(capOne.length).toBe(3);
    expect(capOne[0].balance).toBe(1850.52);
    expect(capOne[0].dateOpened).toBe("2019-03-15");
    expect(capOne[0].isDerogatory).toBe(true);
  });

  it("flags collections, charge-offs, and medical accounts", () => {
    const r = parseMyScoreIQText(fixtureText);
    const portfolio = r.json.tradelines!.filter((t) =>
      /PORTFOLIO RECOVERY/i.test(t.creditorName),
    );
    expect(portfolio[0].isCollection).toBe(true);

    const chase = r.json.tradelines!.filter((t) =>
      /CHASE AUTO/i.test(t.creditorName),
    );
    expect(chase[0].isChargeOff).toBe(true);
    expect(chase[0].isDerogatory).toBe(true);

    const medical = r.json.tradelines!.filter((t) =>
      /QUEST DIAGNOSTICS/i.test(t.creditorName),
    );
    expect(medical[0].isMedical).toBe(true);
    expect(medical[0].isCollection).toBe(true);
  });

  it("extracts hard and soft inquiries with bureau attribution", () => {
    const r = parseMyScoreIQText(fixtureText);
    expect(r.counts.inquiries).toBeGreaterThanOrEqual(2);
    const hard = r.json.inquiries!.filter((i) => i.hardInquiry);
    expect(hard.length).toBeGreaterThanOrEqual(2);
    const chase = r.json.inquiries!.find((i) =>
      /chase/i.test(i.subscriberName),
    );
    expect(chase?.bureau).toBe("Experian");
    expect(chase?.inquiryDate).toBe("2026-03-15");
  });

  it("extracts public records (bankruptcy)", () => {
    const r = parseMyScoreIQText(fixtureText);
    expect(r.counts.publicRecords).toBeGreaterThanOrEqual(1);
    const bk = r.json.publicRecords!.find((p) =>
      /BANKRUPTCY/i.test(p.recordType),
    );
    expect(bk).toBeDefined();
    expect(bk?.dateFiled).toBe("2019-06-12");
  });

  it("emits JSON that the existing MyScoreIQ adapter accepts", () => {
    const r = parseMyScoreIQText(fixtureText);
    expect(myScoreIqAdapter.matches(r.json)).toBe(true);
    const normalized = myScoreIqAdapter.normalize(r.json);
    expect(normalized.tradelines.length).toBeGreaterThan(0);
    expect(normalized.scores.length).toBe(3);
    const validated = NormalizedReportZ.safeParse(normalized);
    expect(validated.success).toBe(true);
  });

  it("normalized output produces dispute candidates", () => {
    const r = parseMyScoreIQText(fixtureText);
    const normalized = myScoreIqAdapter.normalize(r.json);
    const candidates = runDisputeEngine(normalized);
    // Sample includes a charge-off, a collection, a medical collection,
    // and a 7-year-old bankruptcy → the engine should yield several
    // candidates.
    expect(candidates.length).toBeGreaterThan(0);
    const reasons = candidates.map((c) => c.reason);
    // The exact set varies as the engine evolves, but at minimum a
    // collection or charge-off should appear.
    const triggered = reasons.some(
      (r) => r === "UNVERIFIABLE" || r === "INACCURATE",
    );
    expect(triggered).toBe(true);
  });

  it("returns low confidence (and empty json) for nonsense input", () => {
    const r = parseMyScoreIQText(
      "hello world this is just some random unrelated paragraph text " +
        "without any of the expected report sections or fields whatsoever",
    );
    expect(r.confidence).toBe("low");
    expect(r.counts.tradelines).toBe(0);
    expect(
      r.reasonCodes.some(
        (c) => c === "NO_TRADELINES_PARSED" || c === "NO_SECTIONS_DETECTED",
      ),
    ).toBe(true);
  });

  it("never throws on empty / whitespace input", () => {
    expect(() => parseMyScoreIQText("")).not.toThrow();
    expect(() => parseMyScoreIQText("   \n  \n  ")).not.toThrow();
    const r = parseMyScoreIQText("");
    expect(r.confidence).toBe("low");
  });
});
