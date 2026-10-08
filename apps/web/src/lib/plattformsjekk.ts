import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@mikkemus/database";

// Sjekker om ressursene plattformen skal gi appen (database, blob storage og
// block storage) faktisk er satt opp og fungerer. Ingen av sjekkene kaster –
// alt som går galt blir til en feilmelding på /status i stedet.

// Uten tidsfrist kan en tilkobling som blokkeres av en NetworkPolicy (der
// pakkene droppes i stedet for å avvises) henge i flere minutter.
const TIDSFRIST_MS = 5000;

export type Steg = {
  navn: string;
  status: "ok" | "feil" | "hoppet-over";
  melding?: string;
};

export type Sjekk = {
  tjeneste: string;
  status: "ok" | "feil" | "ikke-konfigurert";
  melding?: string;
  // Det appen fant i miljøvariablene. Passord vises aldri.
  info: string[];
  steg: Steg[];
};

type StegDefinisjon = [navn: string, kjør: () => Promise<string | void>];

const SJEKKER: [tjeneste: string, sjekk: (tjeneste: string) => Promise<Sjekk>][] = [
  ["Database (PostgreSQL)", sjekkDatabase],
  ["Blob storage (S3)", sjekkBlobStorage],
  ["Block storage (volum)", sjekkBlockStorage],
];

export function sjekkPlattform(): Promise<Sjekk[]> {
  return Promise.all(
    SJEKKER.map(async ([tjeneste, sjekk]) => {
      // Sikkerhetsnett: en uventet feil i én sjekk skal ikke ta ned hele siden.
      try {
        return await sjekk(tjeneste);
      } catch (err) {
        return utenSteg(tjeneste, "feil", beskrivFeil(err));
      }
    }),
  );
}

async function sjekkDatabase(tjeneste: string): Promise<Sjekk> {
  if (!process.env.DATABASE_URL) {
    return utenSteg(tjeneste, "ikke-konfigurert", "DATABASE_URL er ikke satt.");
  }
  const url = parseUrl(process.env.DATABASE_URL);
  if (!url) {
    return utenSteg(tjeneste, "feil", "DATABASE_URL er ikke en gyldig URL.");
  }

  const info = [
    `Vert: ${url.host}`,
    `Database: ${url.pathname.slice(1)}`,
    `Brukernavn: ${masker(decodeURIComponent(url.username))}`,
    `Passord: ${url.password ? "satt" : "mangler"}`,
  ];

  return kjørSteg(tjeneste, info, [
    ["Koble til og kjør en spørring", async () => {
      await prisma.$queryRaw`SELECT 1`;
    }],
  ]);
}

// Blob storage er S3-kompatibel objektlagring (f.eks. Scaleway Object Storage).
// Plattformen gir en URL, et brukernavn (access key) og et passord (secret key).
// Brukernavn/passord kan også ligge i selve URL-en, og bøttenavnet kan ligge i
// stien: https://<brukernavn>:<passord>@s3.fr-par.scw.cloud/<bøtte>
async function sjekkBlobStorage(tjeneste: string): Promise<Sjekk> {
  if (!process.env.BLOB_STORAGE_URL) {
    return utenSteg(tjeneste, "ikke-konfigurert", "BLOB_STORAGE_URL er ikke satt.");
  }
  const url = parseUrl(process.env.BLOB_STORAGE_URL);
  if (!url) {
    return utenSteg(tjeneste, "feil", "BLOB_STORAGE_URL er ikke en gyldig URL.");
  }

  const brukernavn =
    process.env.BLOB_STORAGE_USERNAME || decodeURIComponent(url.username);
  const passord =
    process.env.BLOB_STORAGE_PASSWORD || decodeURIComponent(url.password);
  const bøtte =
    process.env.BLOB_STORAGE_BUCKET || url.pathname.split("/").find(Boolean) || "";
  // Regionen inngår i signaturen. S3-vertsnavn er som regel s3.<region>.<domene>.
  const region =
    process.env.BLOB_STORAGE_REGION ||
    /^s3\.([a-z0-9-]+)\./.exec(url.hostname)?.[1] ||
    "us-east-1";

  const info = [
    `Endepunkt: ${url.origin}`,
    `Bøtte: ${bøtte || "mangler"}`,
    `Region: ${region}`,
    `Brukernavn: ${masker(brukernavn)}`,
    `Passord: ${passord ? "satt" : "mangler"}`,
  ];

  const mangler = [
    !brukernavn && "brukernavn (BLOB_STORAGE_USERNAME)",
    !passord && "passord (BLOB_STORAGE_PASSWORD)",
    !bøtte && "bøtte (BLOB_STORAGE_BUCKET eller i stien til URL-en)",
  ].filter(Boolean);
  if (mangler.length > 0) {
    return utenSteg(tjeneste, "feil", `Mangler ${mangler.join(", ")}.`, info);
  }

  const s3 = new S3Client({
    endpoint: url.origin,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId: brukernavn, secretAccessKey: passord },
    // Vi vil se den faktiske feilen med en gang, ikke etter flere nye forsøk.
    maxAttempts: 1,
    // Nyere versjoner av SDK-en sender CRC32-sjekksummer som standard, noe
    // mange S3-kompatible tjenester ikke støtter.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const nøkkel = `plattformsjekk/${randomUUID()}.txt`;
  const innhold = lagTestinnhold();

  return kjørSteg(tjeneste, info, [
    ["Koble til bøtta", async () => {
      await s3.send(new HeadBucketCommand({ Bucket: bøtte }));
    }],
    ["Skriv testfil", async () => {
      await s3.send(
        new PutObjectCommand({ Bucket: bøtte, Key: nøkkel, Body: innhold }),
      );
      return nøkkel;
    }],
    ["Les testfil", async () => {
      const svar = await s3.send(
        new GetObjectCommand({ Bucket: bøtte, Key: nøkkel }),
      );
      if ((await svar.Body?.transformToString()) !== innhold) {
        throw new Error("Innholdet som ble lest er ikke det samme som ble skrevet.");
      }
    }],
    ["Slett testfil", async () => {
      await s3.send(new DeleteObjectCommand({ Bucket: bøtte, Key: nøkkel }));
    }],
  ]);
}

// Block storage kommer ikke som en URL, men som et volum (PersistentVolumeClaim)
// montert inn i containeren. BLOCK_STORAGE_PATH peker på monteringspunktet.
async function sjekkBlockStorage(tjeneste: string): Promise<Sjekk> {
  const mappe = process.env.BLOCK_STORAGE_PATH;
  if (!mappe) {
    return utenSteg(tjeneste, "ikke-konfigurert", "BLOCK_STORAGE_PATH er ikke satt.");
  }

  const fil = path.join(mappe, `.plattformsjekk-${randomUUID()}.txt`);
  const innhold = lagTestinnhold();

  return kjørSteg(tjeneste, [`Monteringspunkt: ${mappe}`], [
    ["Finn mappa", async () => {
      if (!(await fs.stat(mappe)).isDirectory()) {
        throw new Error(`${mappe} er ikke en mappe.`);
      }
      const { blocks, bavail, bsize } = await fs.statfs(mappe);
      return `${formaterGiB(bavail * bsize)} ledig av ${formaterGiB(blocks * bsize)}`;
    }],
    ["Skriv testfil", async () => {
      await fs.writeFile(fil, innhold);
      return fil;
    }],
    ["Les testfil", async () => {
      if ((await fs.readFile(fil, "utf8")) !== innhold) {
        throw new Error("Innholdet som ble lest er ikke det samme som ble skrevet.");
      }
    }],
    ["Slett testfil", async () => {
      await fs.unlink(fil);
    }],
  ]);
}

// Kjører stegene i rekkefølge. Hvert steg forutsetter at det forrige gikk bra,
// så etter første feil blir resten markert som ikke testet.
async function kjørSteg(
  tjeneste: string,
  info: string[],
  definisjoner: StegDefinisjon[],
): Promise<Sjekk> {
  const steg: Steg[] = [];
  let feilet = false;

  for (const [navn, kjør] of definisjoner) {
    if (feilet) {
      steg.push({ navn, status: "hoppet-over" });
      continue;
    }
    try {
      const melding = await medTidsfrist(kjør());
      steg.push({ navn, status: "ok", melding: melding || undefined });
    } catch (err) {
      steg.push({ navn, status: "feil", melding: beskrivFeil(err) });
      feilet = true;
    }
  }

  return { tjeneste, status: feilet ? "feil" : "ok", info, steg };
}

async function medTidsfrist<T>(løfte: Promise<T>): Promise<T> {
  let tidtaker: NodeJS.Timeout | undefined;
  const tidsavbrudd = new Promise<never>((_, avvis) => {
    tidtaker = setTimeout(
      () => avvis(new Error(`Fikk ikke svar innen ${TIDSFRIST_MS / 1000} sekunder.`)),
      TIDSFRIST_MS,
    );
  });
  try {
    return await Promise.race([løfte, tidsavbrudd]);
  } finally {
    clearTimeout(tidtaker);
  }
}

// Nettverksfeil har en kode (ENOTFOUND, ECONNREFUSED, ...), mens S3-feil har
// et navn (NoSuchBucket, InvalidAccessKeyId, ...) og en HTTP-status.
function beskrivFeil(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const { code, $metadata } = err as {
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const http = $metadata?.httpStatusCode;
  const melding = err.message.trim();
  const prefiks = code ?? (err.name !== "Error" ? err.name : null);
  return [
    prefiks && !melding.startsWith(prefiks) ? prefiks : null,
    http ? `HTTP ${http}` : null,
    melding,
  ]
    .filter(Boolean)
    .join(" – ");
}

function utenSteg(
  tjeneste: string,
  status: "feil" | "ikke-konfigurert",
  melding: string,
  info: string[] = [],
): Sjekk {
  return { tjeneste, status, melding, info, steg: [] };
}

function parseUrl(verdi: string): URL | null {
  try {
    return new URL(verdi);
  } catch {
    return null;
  }
}

// Viser bare starten av brukernavnet, nok til å se at plattformen har satt det
// uten å legge hele nøkkelen ut på en offentlig side.
function masker(verdi: string): string {
  return verdi ? `${verdi.slice(0, 4)}…` : "mangler";
}

function lagTestinnhold(): string {
  return `Plattformsjekk fra mikkemus-app ${new Date().toISOString()}`;
}

function formaterGiB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}
