import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { lagS3Klient, lesBlobKonfig } from "@/lib/blob";
import {
  bildenøkkel,
  finnBildetype,
  lagBildenavn,
  MAKS_BYTES,
} from "@/lib/bilder";

export async function POST(request: NextRequest) {
  const konfig = lesBlobKonfig();
  if (!konfig) {
    return NextResponse.json(
      { error: "Bildeopplasting er ikke satt opp i dette miljøet." },
      { status: 503 },
    );
  }

  // Hele forespørselen leses inn i minnet, så avvis store filer før det skjer.
  // Litt slingringsmonn for resten av skjemaet rundt fila.
  const lengde = Number(request.headers.get("content-length") ?? 0);
  if (lengde > MAKS_BYTES + 64 * 1024) {
    return NextResponse.json({ error: forStorMelding() }, { status: 413 });
  }

  const skjema = await request.formData().catch(() => null);
  const fil = skjema?.get("bilde");
  if (!(fil instanceof File) || fil.size === 0) {
    return NextResponse.json({ error: "Velg et bilde først." }, { status: 400 });
  }
  if (fil.size > MAKS_BYTES) {
    return NextResponse.json({ error: forStorMelding() }, { status: 413 });
  }

  const bytes = new Uint8Array(await fil.arrayBuffer());
  const type = finnBildetype(bytes);
  if (!type) {
    return NextResponse.json(
      { error: "Bare JPEG, PNG, GIF og WebP er lov." },
      { status: 415 },
    );
  }

  const navn = lagBildenavn(type);
  try {
    await lagS3Klient(konfig).send(
      new PutObjectCommand({
        Bucket: konfig.bøtte,
        Key: bildenøkkel(navn),
        Body: bytes,
        ContentType: type.contentType,
      }),
    );
  } catch (err) {
    console.error("Klarte ikke å laste opp bilde", err);
    return NextResponse.json(
      { error: "Klarte ikke å lagre bildet. Se /status for detaljer." },
      { status: 502 },
    );
  }

  return NextResponse.json({ navn }, { status: 201 });
}

function forStorMelding(): string {
  return `Bildet er for stort (maks ${MAKS_BYTES / 1024 / 1024} MB).`;
}
