import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  signBookmarkletToken,
  verifyBookmarkletToken,
} from "../bookmarklet-token";

const TEST_SECRET = "a".repeat(64); // 32-byte hex
const OTHER_SECRET = "b".repeat(64);

describe("bookmarklet-token", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.INTERNAL_SERVICE_SECRET;
    process.env.INTERNAL_SERVICE_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.INTERNAL_SERVICE_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_SECRET = originalSecret;
    }
  });

  it("roundtrips a valid token", () => {
    const token = signBookmarkletToken("user_test123");
    const result = verifyBookmarkletToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.uid).toBe("user_test123");
      expect(result.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(typeof result.payload.n).toBe("string");
      expect(result.payload.n.length).toBeGreaterThan(0);
    }
  });

  it("rejects when token is missing or empty", () => {
    const r1 = verifyBookmarkletToken("");
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe("MISSING_TOKEN");

    expect(verifyBookmarkletToken(null as unknown as string).ok).toBe(false);
    expect(verifyBookmarkletToken(undefined as unknown as string).ok).toBe(
      false,
    );
  });

  it("rejects malformed tokens", () => {
    expect(verifyBookmarkletToken("garbage").ok).toBe(false);
    expect(verifyBookmarkletToken("a.").ok).toBe(false);
    expect(verifyBookmarkletToken(".b").ok).toBe(false);
  });

  it("rejects tokens signed with a different key", () => {
    const token = signBookmarkletToken("user_test123");
    process.env.INTERNAL_SERVICE_SECRET = OTHER_SECRET;
    const result = verifyBookmarkletToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("rejects tokens with tampered payload", () => {
    const token = signBookmarkletToken("user_test123");
    const sig = token.split(".")[1];
    const tamperedPayload = Buffer.from(
      JSON.stringify({ uid: "user_attacker", exp: 9999999999, n: "ff" }),
      "utf8",
    )
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const result = verifyBookmarkletToken(`${tamperedPayload}.${sig}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("rejects tokens when no secret is configured", () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    const result = verifyBookmarkletToken("anything.atall");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_SECRET");
    }
  });

  it("two tokens for the same user differ thanks to the nonce", () => {
    const a = signBookmarkletToken("user_test123");
    const b = signBookmarkletToken("user_test123");
    expect(a).not.toBe(b);
    expect(verifyBookmarkletToken(a).ok).toBe(true);
    expect(verifyBookmarkletToken(b).ok).toBe(true);
  });

  it("rejects when signature byte length differs from HMAC output", () => {
    const token = signBookmarkletToken("user_test123");
    const payload = token.split(".")[0];
    // Single base64url char → 1-byte signature, well under HMAC-SHA256's 32 bytes.
    const result = verifyBookmarkletToken(`${payload}.AA`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });
});
