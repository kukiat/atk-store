import { describe, expect, it } from "vitest";

import {
  createPkceChallenge,
  hashSessionToken,
  tokensMatch,
} from "./auth-tokens";

describe("auth tokens", () => {
  it("hashes an opaque session token without retaining the source value", () => {
    const token = "session-token";
    const hash = hashSessionToken(token);

    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it("compares OAuth correlation tokens safely", () => {
    expect(tokensMatch("expected", "expected")).toBe(true);
    expect(tokensMatch("expected", "unexpected")).toBe(false);
    expect(tokensMatch("expected", null)).toBe(false);
  });

  it("creates the RFC 7636 S256 PKCE challenge", () => {
    expect(
      createPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
