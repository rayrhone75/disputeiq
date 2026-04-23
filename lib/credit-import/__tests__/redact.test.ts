import { describe, it, expect } from "vitest";
import {
  maskAccount,
  maskPhone,
  maskSsnLast4,
  maskZip,
  redactJson,
  redactText,
} from "../redact";

describe("PII redaction", () => {
  it("masks account numbers to last 4", () => {
    expect(maskAccount("1234567890123456")).toBe("••••3456");
    expect(maskAccount("1234")).toBe("••••1234");
    expect(maskAccount()).toBe("••••");
  });

  it("extracts ssn last 4 only", () => {
    expect(maskSsnLast4("123-45-6789")).toBe("6789");
    expect(maskSsnLast4("abc")).toBeUndefined();
    expect(maskSsnLast4()).toBeUndefined();
  });

  it("masks zip and phone", () => {
    expect(maskZip("94601-1234")).toBe("946••");
    expect(maskPhone("510-555-0101")).toBe("(•••) •••-0101");
  });

  it("redacts SSN / phone / email / DOB inline", () => {
    const input = "SSN 123-45-6789, phone 510-555-0101, me@example.com, DOB 04/12/1985";
    const out = redactText(input);
    expect(out).not.toContain("123-45-6789");
    expect(out).not.toContain("510-555-0101");
    expect(out).not.toContain("me@example.com");
    expect(out).not.toContain("04/12/1985");
    expect(out).toContain("[SSN]");
    expect(out).toContain("[PHONE]");
    expect(out).toContain("[EMAIL]");
    expect(out).toContain("[DOB]");
  });

  it("deep-redacts sensitive keys in JSON", () => {
    const input = {
      borrower: {
        ssn: "123-45-6789",
        dateOfBirth: "1985-04-12",
        accountNumber: "1234567812345678",
        phone: "510-555-0101",
        safe: "keep me",
      },
      tradelines: [
        { accountNumber: "XXXX1234", balance: 100 },
      ],
    };
    const out = redactJson(input) as any;
    expect(out.borrower.ssn).toBe("6789");
    expect(out.borrower.dateOfBirth).toBe("[REDACTED]");
    expect(out.borrower.accountNumber).toBe("[REDACTED]");
    expect(out.borrower.safe).toBe("keep me");
    expect(out.tradelines[0].accountNumber).toBe("[REDACTED]");
    expect(out.tradelines[0].balance).toBe(100);
  });
});
