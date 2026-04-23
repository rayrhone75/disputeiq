import { describe, it, expect } from "vitest";
import {
  expectedImportConfirmation,
  expectedPurgeConfirmation,
  expectedUserConfirmation,
  isConfirmationOk,
} from "../deletion";

describe("destructive-action confirmation helpers", () => {
  it("builds deterministic confirmation phrases", () => {
    expect(expectedImportConfirmation("cl123456abcdef")).toBe("DELETE IMPORT cl123456");
    expect(expectedUserConfirmation("user@example.com")).toBe("DELETE user@example.com");
    expect(expectedPurgeConfirmation("user@example.com")).toBe("PURGE user@example.com");
  });

  it("accepts matching confirmations and rejects mismatches", () => {
    expect(isConfirmationOk("DELETE user@example.com", "DELETE user@example.com")).toBe(true);
    expect(isConfirmationOk("  DELETE user@example.com  ", "DELETE user@example.com")).toBe(
      true,
    );
    expect(isConfirmationOk("delete user@example.com", "DELETE user@example.com")).toBe(false);
    expect(isConfirmationOk("DELETE user2@example.com", "DELETE user@example.com")).toBe(false);
  });
});
