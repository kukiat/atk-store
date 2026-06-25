export class GoogleIdTokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleIdTokenValidationError";
  }
}

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string | null;
  picture: string | null;
};

type GoogleIdTokenClaims = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  nonce?: unknown;
  name?: unknown;
  picture?: unknown;
};

export function getGoogleIdentityFromClaims(
  claims: GoogleIdTokenClaims,
  expectedNonce: string,
): GoogleIdentity {
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new GoogleIdTokenValidationError("Google ID token has no subject");
  }

  if (typeof claims.email !== "string" || claims.email.length === 0) {
    throw new GoogleIdTokenValidationError("Google ID token has no email");
  }

  if (claims.email_verified !== true) {
    throw new GoogleIdTokenValidationError("Google email is not verified");
  }

  if (claims.nonce !== expectedNonce) {
    throw new GoogleIdTokenValidationError(
      "Google ID token nonce does not match",
    );
  }

  return {
    subject: claims.sub,
    email: claims.email,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}
