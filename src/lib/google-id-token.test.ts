import { describe, expect, it } from "vitest";

import {
  getGoogleIdentityFromClaims,
  GoogleIdTokenValidationError,
} from "./google-id-token-claims";

describe("Google ID token claims", () => {
  const validClaims = {
    sub: "google-subject",
    email: "person@example.com",
    email_verified: true,
    nonce: "expected-nonce",
    name: "Person",
  };

  it("accepts a verified identity with the expected nonce", () => {
    expect(getGoogleIdentityFromClaims(validClaims, "expected-nonce")).toEqual({
      subject: "google-subject",
      email: "person@example.com",
      name: "Person",
      picture: null,
    });
  });

  it("rejects an unverified email", () => {
    expect(() =>
      getGoogleIdentityFromClaims(
        { ...validClaims, email_verified: false },
        "expected-nonce",
      ),
    ).toThrow(GoogleIdTokenValidationError);
  });

  it("rejects a mismatched nonce", () => {
    expect(() =>
      getGoogleIdentityFromClaims(validClaims, "other-nonce"),
    ).toThrow(GoogleIdTokenValidationError);
  });
});
