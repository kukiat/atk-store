import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "IOT shelf catalog has been removed" },
    { status: 410 },
  );
}
