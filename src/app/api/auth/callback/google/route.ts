import { NextRequest, NextResponse } from "next/server";

import {
  GOOGLE_ID_TOKEN_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_PKCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleIdTokenCookieOptions,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth-shared";
import { tokensMatch } from "@/lib/auth-tokens";
import {
  GoogleIdTokenValidationError,
  verifyGoogleIdToken,
} from "@/lib/google-id-token";
import {
  AccountNotActiveError,
  OAuthIdentityConflictError,
  userService,
} from "@/services/user.service";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_NONCE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_PKCE_COOKIE);
  return response;
}

function getAuthUrl() {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function getAppUrl(path: string) {
  return new URL(path, getAuthUrl());
}

function redirectToSignIn(error: string) {
  return clearOAuthCookies(
    NextResponse.redirect(
      getAppUrl(`/signin?error=${encodeURIComponent(error)}`),
    ),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(GOOGLE_OAUTH_PKCE_COOKIE)?.value;
  const nonce = request.cookies.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;

  if (!tokensMatch(expectedState, state) || !codeVerifier || !nonce) {
    return redirectToSignIn("invalid_state");
  }

  if (error) {
    return redirectToSignIn(error);
  }

  if (!code) {
    return redirectToSignIn("no_code");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${getAuthUrl()}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    console.error("[auth/callback/google] Google OAuth is not configured");
    return redirectToSignIn("token_exchange_failed");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = (await tokenResponse.json()) as Record<string, unknown>;

  if (!tokenResponse.ok) {
    console.error("[auth/callback/google] Token exchange failed", {
      status: tokenResponse.status,
      error: tokenData.error,
      errorDescription: tokenData.error_description,
    });
    return redirectToSignIn("token_exchange_failed");
  }

  if (typeof tokenData.id_token !== "string") {
    return redirectToSignIn("invalid_identity");
  }

  try {
    const identity = await verifyGoogleIdToken(tokenData.id_token, nonce);
    const user = await userService.upsertOAuthUser({
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.picture,
      authMethod: "google",
      providerAccountId: identity.subject,
    });

    const { token, expiresAt } = await userService.createSession(user.id);
    const response = NextResponse.redirect(getAppUrl("/"));
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(expiresAt),
    );
    // Stash the verified Google ID token for the face-enrollment credential
    // bridge. It is path-scoped to /api/face and expires with the token.
    response.cookies.set(
      GOOGLE_ID_TOKEN_COOKIE,
      tokenData.id_token,
      googleIdTokenCookieOptions(),
    );
    return clearOAuthCookies(response);
  } catch (cause) {
    if (cause instanceof OAuthIdentityConflictError) {
      return redirectToSignIn("account_conflict");
    }

    if (cause instanceof AccountNotActiveError) {
      return redirectToSignIn("account_blocked");
    }

    if (cause instanceof GoogleIdTokenValidationError) {
      console.warn("[auth/callback/google] Google ID token validation failed");
      return redirectToSignIn("invalid_identity");
    }

    console.error("[auth/callback/google] OAuth callback failed", {
      name: cause instanceof Error ? cause.name : undefined,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return redirectToSignIn("token_exchange_failed");
  }
}
