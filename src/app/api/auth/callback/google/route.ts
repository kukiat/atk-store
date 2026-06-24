import { NextRequest, NextResponse } from "next/server";

import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth-shared";
import { userService } from "@/services/user.service";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // --- Raw query params coming back from Google ---
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const scope = searchParams.get("scope");

  console.log("=== [auth/callback/google] OAuth Callback Received ===");
  console.log("[auth/callback/google] Full URL:", request.url);
  console.log("[auth/callback/google] code:", code ? `${code.slice(0, 20)}…` : null);
  console.log("[auth/callback/google] scope:", scope);
  console.log("[auth/callback/google] state:", state);

  if (error) {
    console.error("[auth/callback/google] ❌ Error from Google:", error);
    console.error("[auth/callback/google] Error description:", errorDescription);
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    console.error("[auth/callback/google] ❌ No authorization code in callback");
    return NextResponse.redirect(new URL("/signin?error=no_code", request.url));
  }

  // --- Exchange the authorization code for tokens ---
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const authUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${authUrl}/api/auth/callback/google`;

  console.log("[auth/callback/google] Exchanging code for tokens...");
  console.log("[auth/callback/google] redirect_uri:", redirectUri);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json() as Record<string, unknown>;

  console.log("[auth/callback/google] Token response status:", tokenResponse.status);
  console.log("[auth/callback/google] Token response body:", {
    ...tokenData,
    // mask actual token values so they don't appear in logs
    access_token: tokenData.access_token ? `${String(tokenData.access_token).slice(0, 20)}…` : undefined,
    id_token: tokenData.id_token ? `${String(tokenData.id_token).slice(0, 20)}…` : undefined,
    refresh_token: tokenData.refresh_token ? `${String(tokenData.refresh_token).slice(0, 20)}…` : undefined,
  });

  if (!tokenResponse.ok) {
    console.error("[auth/callback/google] ❌ Token exchange failed:", tokenData);
    return NextResponse.redirect(new URL("/signin?error=token_exchange_failed", request.url));
  }

  // --- Fetch user info from Google ---
  const accessToken = tokenData.access_token as string;

  console.log("[auth/callback/google] Fetching user info from Google...");

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const userInfo = await userInfoResponse.json() as Record<string, unknown>;

  console.log("[auth/callback/google] User info response status:", userInfoResponse.status);
  console.log("[auth/callback/google] User info:", userInfo);

  if (!userInfoResponse.ok) {
    console.error("[auth/callback/google] ❌ Failed to fetch user info:", userInfo);
    return NextResponse.redirect(new URL("/signin?error=userinfo_failed", request.url));
  }

  if (!userInfo.email) {
    console.error("[auth/callback/google] ❌ Google account has no email");
    return NextResponse.redirect(new URL("/signin?error=no_email", request.url));
  }

  // --- Enroll/refresh the user and open a session ---
  const user = await userService.upsertOAuthUser({
    email: String(userInfo.email),
    name: userInfo.name ? String(userInfo.name) : null,
    avatarUrl: userInfo.picture ? String(userInfo.picture) : null,
    authMethod: "google",
    providerAccountId: userInfo.id ? String(userInfo.id) : null,
  });

  const { token, expiresAt } = await userService.createSession(user.id);

  console.log(
    "=== [auth/callback/google] ✅ Auth complete for:",
    user.email,
    `(user #${user.id}) ===`,
  );

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
}
