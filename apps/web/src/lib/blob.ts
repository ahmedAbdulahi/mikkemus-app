import { S3Client } from "@aws-sdk/client-s3";

// Blob storage er S3-kompatibel objektlagring (Scaleway Object Storage).
// Plattformen gir de samme miljøvariablene som AWS-SDK-ene leser av seg selv
// (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_ENDPOINT_URL_S3),
// pluss bøttenavnet i S3_BUCKET. Bare miljøer med `blob: true` får dem.

export type BlobKonfig = {
  endepunkt: URL;
  region: string;
  accessKey: string;
  secretKey: string;
  bøtte: string;
};

// Gir null hvis noe mangler, så funksjoner som trenger blob storage kan skrus
// av i miljøer uten bøtte i stedet for å feile. /status forklarer hva som mangler.
export function lesBlobKonfig(): BlobKonfig | null {
  const endepunkt = parseUrl(process.env.AWS_ENDPOINT_URL_S3);
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bøtte = process.env.S3_BUCKET;
  if (!endepunkt || !accessKey || !secretKey || !bøtte) return null;
  return { endepunkt, region: finnRegion(endepunkt), accessKey, secretKey, bøtte };
}

// Regionen inngår i signaturen. S3-vertsnavn er som regel s3.<region>.<domene>.
export function finnRegion(endepunkt: URL): string {
  return (
    process.env.AWS_REGION ||
    /^s3\.([a-z0-9-]+)\./.exec(endepunkt.hostname)?.[1] ||
    "us-east-1"
  );
}

export function lagS3Klient(
  konfig: BlobKonfig,
  valg: { maxAttempts?: number } = {},
): S3Client {
  return new S3Client({
    endpoint: konfig.endepunkt.origin,
    region: konfig.region,
    // Path-style (s3.<region>.scw.cloud/<bøtte>) i stedet for <bøtte>.s3...,
    // så samme vertsnavn fungerer for alle bøtter.
    forcePathStyle: true,
    credentials: {
      accessKeyId: konfig.accessKey,
      secretAccessKey: konfig.secretKey,
    },
    maxAttempts: valg.maxAttempts,
    // En tilkobling som blokkeres av en NetworkPolicy kan ellers henge i minutter.
    requestHandler: { connectionTimeout: 5000 },
    // Nyere versjoner av SDK-en sender CRC32-sjekksummer som standard, noe
    // mange S3-kompatible tjenester ikke støtter.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function parseUrl(verdi: string | undefined): URL | null {
  if (!verdi) return null;
  try {
    return new URL(verdi);
  } catch {
    return null;
  }
}
