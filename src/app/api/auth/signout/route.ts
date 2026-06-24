import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, SIGN_IN_PATH } from "@/lib/auth-shared";
import { userService } from "@/services/user.service";

async function signOut(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await userService.deleteSession(token);
    console.log("[auth/signout] Session ended");
  }

  const response = NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const GET = signOut;
export const POST = signOut;
