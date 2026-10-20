import { randomUUID } from "node:crypto";
import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";

// Bildene ligger i bøtta under bilder/, ved siden av plattformsjekkens testfiler.
const PREFIKS = "bilder/";

export const MAKS_BYTES = 5 * 1024 * 1024;
const MAKS_ANTALL_VIST = 60;

export type Bildetype = { contentType: string; filendelse: string };

export type BildeDto = {
  navn: string;
  lastetOpp: string;
};

// Ser på de første bytene i fila i stedet for å stole på typen nettleseren
// oppgir, så ingen kan laste opp f.eks. HTML eller SVG forkledd som et bilde.
export function finnBildetype(bytes: Uint8Array): Bildetype | null {
  const starterMed = (signatur: number[], fra = 0) =>
    signatur.every((b, i) => bytes[fra + i] === b);

  if (starterMed([0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", filendelse: "jpg" };
  }
  if (starterMed([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", filendelse: "png" };
  }
  if (starterMed([0x47, 0x49, 0x46, 0x38])) {
    return { contentType: "image/gif", filendelse: "gif" };
  }
  // RIFF....WEBP
  if (starterMed([0x52, 0x49, 0x46, 0x46]) && starterMed([0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", filendelse: "webp" };
  }
  return null;
}

// S3 lister nøkler i alfabetisk rekkefølge. Med omvendt tid først i navnet
// kommer de nyeste bildene først, så vi slipper å hente og sortere alle.
export function lagBildenavn(type: Bildetype): string {
  const omvendtTid = String(Number.MAX_SAFE_INTEGER - Date.now()).padStart(16, "0");
  return `${omvendtTid}-${randomUUID()}.${type.filendelse}`;
}

// Bare navn appen selv har laget, så /api/bilder/[navn] ikke kan brukes til
// å lese andre filer i bøtta.
export function erGyldigBildenavn(navn: string): boolean {
  return /^\d{16}-[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(navn);
}

export function bildenøkkel(navn: string): string {
  return PREFIKS + navn;
}

export async function hentBilder(s3: S3Client, bøtte: string): Promise<BildeDto[]> {
  const svar = await s3.send(
    new ListObjectsV2Command({
      Bucket: bøtte,
      Prefix: PREFIKS,
      MaxKeys: MAKS_ANTALL_VIST,
    }),
  );
  return (svar.Contents ?? [])
    .map((objekt) => ({
      navn: objekt.Key?.slice(PREFIKS.length) ?? "",
      lastetOpp: objekt.LastModified?.toISOString() ?? "",
    }))
    .filter((bilde) => erGyldigBildenavn(bilde.navn));
}
