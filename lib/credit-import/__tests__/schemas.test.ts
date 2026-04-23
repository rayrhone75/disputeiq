import { describe, it, expect } from "vitest";
import sample from "../fixtures/identityiq-sample.json";
import {
  CreateImportZ,
  FetchImportZ,
  PasteImportZ,
  PreviewImportZ,
  RunNormalizationZ,
} from "../schemas";

describe("admin credit-import zod schemas", () => {
  it("CreateImportZ accepts valid inputs and rejects bad provider", () => {
    expect(
      CreateImportZ.safeParse({ userId: "u1", provider: "IDENTITYIQ" }).success,
    ).toBe(true);
    expect(
      CreateImportZ.safeParse({ userId: "u1", provider: "NOT_A_PROVIDER" }).success,
    ).toBe(false);
  });

  it("PasteImportZ requires either bodyText or json", () => {
    expect(PasteImportZ.safeParse({ importId: "i1" }).success).toBe(false);
    expect(
      PasteImportZ.safeParse({ importId: "i1", bodyText: "{}" }).success,
    ).toBe(true);
    expect(
      PasteImportZ.safeParse({ importId: "i1", json: sample }).success,
    ).toBe(true);
  });

  it("FetchImportZ enforces URL format", () => {
    expect(
      FetchImportZ.safeParse({ importId: "i1", url: "not a url" }).success,
    ).toBe(false);
    expect(
      FetchImportZ.safeParse({
        importId: "i1",
        url: "https://example.test/CreditReport.aspx?view=json",
      }).success,
    ).toBe(true);
  });

  it("RunNormalizationZ defaults replace to true", () => {
    const parsed = RunNormalizationZ.safeParse({ importId: "i1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.replace).toBe(true);
  });

  it("PreviewImportZ accepts either bodyText or json and defaults provider", () => {
    const parsed = PreviewImportZ.safeParse({ bodyText: "{}" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.provider).toBe("IDENTITYIQ");
  });
});
