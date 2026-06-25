import { NextResponse } from "next/server";

import {
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_PKCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthCookieOptions,
} from "@/lib/auth-shared";
import { createOpaqueToken, createPkceChallenge } from "@/lib/auth-tokens";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const authUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  if (!clientId) {
    console.error("[auth/signin/google] GOOGLE_CLIENT_ID is not set");
    return new Response("OAuth not configured", { status: 500 });
  }

  const callbackUrl = `${authUrl}/api/auth/callback/google`;

  const state = createOpaqueToken();
  const nonce = createOpaqueToken();
  const codeVerifier = createOpaqueToken();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createPkceChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  const fullRedirectUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  const response = NextResponse.redirect(fullRedirectUrl);
  const cookieOptions = oauthCookieOptions();

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, nonce, cookieOptions);
  response.cookies.set(GOOGLE_OAUTH_PKCE_COOKIE, codeVerifier, cookieOptions);

  return response;
}
