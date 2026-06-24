import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const authUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  if (!clientId) {
    console.error("[auth/signin/google] GOOGLE_CLIENT_ID is not set");
    return new Response("OAuth not configured", { status: 500 });
  }

  const callbackUrl = `${authUrl}/api/auth/callback/google`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  const fullRedirectUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  console.log("[auth/signin/google] Redirecting to Google OAuth");
  console.log("[auth/signin/google] redirect_uri:", callbackUrl);
  console.log("[auth/signin/google] Request URL:", request.url);

  redirect(fullRedirectUrl);
}
