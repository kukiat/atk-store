import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    active: true,
    message: "OK",
  });
}
