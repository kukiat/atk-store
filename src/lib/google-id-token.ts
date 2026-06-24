import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  getGoogleIdentityFromClaims,
  GoogleIdTokenValidationError,
  type GoogleIdentity,
} from "./google-id-token-claims";

export {
  getGoogleIdentityFromClaims,
  GoogleIdTokenValidationError,
  type GoogleIdentity,
} from "./google-id-token-claims";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<GoogleIdentity> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new GoogleIdTokenValidationError(
      "GOOGLE_CLIENT_ID is not configured",
    );
  }

  const { payload } = await jwtVerify(idToken, googleJwks, {
    algorithms: ["RS256"],
    audience,
    issuer: GOOGLE_ISSUERS,
  });

  return getGoogleIdentityFromClaims(payload, expectedNonce);
}
