import { NextResponse } from "next/server";
import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { lagS3Klient, lesBlobKonfig } from "@/lib/blob";
import { bildenøkkel, erGyldigBildenavn } from "@/lib/bilder";

// Bøtta er privat, så bildene hentes gjennom appen i stedet for rett fra S3.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ navn: string }> },
) {
  const { navn } = await params;
  const konfig = lesBlobKonfig();
  if (!konfig || !erGyldigBildenavn(navn)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const svar = await lagS3Klient(konfig).send(
      new GetObjectCommand({ Bucket: konfig.bøtte, Key: bildenøkkel(navn) }),
    );
    if (!svar.Body) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(svar.Body.transformToWebStream(), {
      headers: {
        "Content-Type": svar.ContentType ?? "application/octet-stream",
        // Typen ble sjekket ved opplasting; ikke la nettleseren gjette en annen.
        "X-Content-Type-Options": "nosniff",
        // Hvert bilde får et nytt, unikt navn, så innholdet endres aldri.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof NoSuchKey) {
      return new NextResponse(null, { status: 404 });
    }
    throw err;
  }
}
