import { NextResponse } from "next/server";
import { prisma } from "@mikkemus/database";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // deleteMany i stedet for delete, så et navn som allerede er slettet gir 404
  // i stedet for en feil fra Prisma.
  const { count } = await prisma.navn.deleteMany({ where: { id } });
  if (count === 0) {
    return NextResponse.json({ error: "Fant ikke navnet" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
