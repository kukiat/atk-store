import { NextRequest, NextResponse } from "next/server";

import { hasSameOrigin } from "@/lib/auth";
import { SESSION_COOKIE, SIGN_IN_PATH } from "@/lib/auth-shared";
import { userService } from "@/services/user.service";

async function signOut(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return new NextResponse("Invalid request origin", { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await userService.deleteSession(token);
  }

  const response = NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const POST = signOut;
