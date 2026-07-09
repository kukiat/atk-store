import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { accepted: false, error: "Shelf mock endpoint has been removed" },
    { status: 410 },
  );
}
