import { NextResponse } from "next/server";

import { getShelfWithProducts } from "@/services/shelf.service";

// GET /api/shelf/:id -> shelf with its products (same service the page uses).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const shelf = await getShelfWithProducts(id);

  if (!shelf) {
    return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  }

  return NextResponse.json(shelf);
}
