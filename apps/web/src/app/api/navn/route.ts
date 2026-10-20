import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@mikkemus/database";
import { hentSide, lesSidetall, PER_SIDE } from "@/lib/navn";

// Én side om gangen, f.eks. /api/navn?side=2. Å returnere alle radene på én
// gang får serveren til å gå tom for minne når tabellen er stor.
export async function GET(request: NextRequest) {
  const side = await hentSide(lesSidetall(request.nextUrl.searchParams.get("side")));
  return NextResponse.json({ ...side, perSide: PER_SIDE });
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
