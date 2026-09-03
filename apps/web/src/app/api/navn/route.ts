import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@mikkemus/database";

export async function GET() {
  const navn = await prisma.navn.findMany({
    orderBy: { opprettet: "desc" },
  });
  return NextResponse.json(navn);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const navn = typeof body?.navn === "string" ? body.navn.trim() : "";

  if (!navn) {
    return NextResponse.json(
      { error: "Navn kan ikke være tomt" },
      { status: 400 },
    );
  }

  if (navn.length > 100) {
    return NextResponse.json(
      { error: "Navnet er for langt (maks 100 tegn)" },
      { status: 400 },
    );
  }

  const opprettet = await prisma.navn.create({ data: { navn } });
  return NextResponse.json(opprettet, { status: 201 });
}
