import { prisma, type Navn } from "@mikkemus/database";

// Tabellen kan bli stor nok til at det ikke går å hente alle radene på én gang
// (Node går tom for minne). Alt som leser navn går derfor via funksjonene her,
// som bare henter én side av gangen eller lar databasen telle.

export const PER_SIDE = 50;

// Tidene vises i norsk tid, både i lista og i grafen, uansett hvilken
// tidssone serveren kjører i.
export const TIDSSONE = "Europe/Oslo";

export type NavnSide = {
  navn: Navn[];
  side: number;
  antallSider: number;
  totalt: number;
};

export async function hentSide(ønsketSide: number): Promise<NavnSide> {
  const totalt = await prisma.navn.count();
  const antallSider = Math.max(1, Math.ceil(totalt / PER_SIDE));
  // En side bak slutten (f.eks. etter at noen har slettet) gir siste side.
  const side = Math.min(Math.max(1, ønsketSide), antallSider);
  const navn = await prisma.navn.findMany({
    orderBy: [{ opprettet: "desc" }, { id: "desc" }],
    skip: (side - 1) * PER_SIDE,
    take: PER_SIDE,
  });
  return { navn, side, antallSider, totalt };
}

// Tåler alt som kan komme i ?side=, og gir 1 for alt som ikke er et tall.
export function lesSidetall(verdi: string | string[] | null | undefined): number {
  const tall = Number.parseInt(Array.isArray(verdi) ? verdi[0] : (verdi ?? ""), 10);
  return Number.isFinite(tall) && tall > 0 ? tall : 1;
}

export type Tidsenhet = "minute" | "hour" | "day" | "week" | "month" | "year";

export type Tidspunkt = {
  start: string;
  antall: number;
  // Hele perioden, til verktøytips og tabell, f.eks. "tirsdag 20. oktober 2026".
  etikett: string;
  // Kort versjon til x-aksen, f.eks. "20.10.2026".
  aksetikett: string;
};

export type Tidsserie = {
  enhet: Tidsenhet;
  punkter: Tidspunkt[];
};

export const ENHETSNAVN: Record<Tidsenhet, string> = {
  minute: "minutt",
  hour: "time",
  day: "dag",
  week: "uke",
  month: "måned",
  year: "år",
};

const MAKS_PUNKTER = 90;

// Omtrentlig lengde, bare til å velge enhet. Rekkefølgen er fra finest til grovest.
const ENHETER: [Tidsenhet, number][] = [
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
  ["week", 7 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["year", 365 * 86_400_000],
];

// Antall navn lagt til per tidsenhet. Telles i databasen, så minnebruken er den
// samme uansett hvor mange rader det er. Enheten velges ut fra hvor langt
// tidsrom dataene dekker, så grafen aldri får mer enn ca. MAKS_PUNKTER søyler.
export async function hentTidsserie(): Promise<Tidsserie | null> {
  const { _min, _max } = await prisma.navn.aggregate({
    _min: { opprettet: true },
    _max: { opprettet: true },
  });
  if (!_min.opprettet || !_max.opprettet) return null;

  const spenn = _max.opprettet.getTime() - _min.opprettet.getTime();
  const [enhet] =
    ENHETER.find(([, lengde]) => spenn / lengde < MAKS_PUNKTER) ?? ENHETER[ENHETER.length - 1];

  // opprettet lagres i UTC uten tidssone. Den gjøres om til norsk veggklokke før
  // date_trunc, så f.eks. en dag går fra norsk midnatt til norsk midnatt.
  // generate_series fyller inn tidsrom uten nye navn med 0, og til slutt gjøres
  // starten på hver periode om til et ekte tidspunkt igjen.
  const rader = await prisma.$queryRaw<{ start: Date; antall: number }[]>`
    WITH tellinger AS (
      SELECT
        date_trunc(${enhet}::text, opprettet AT TIME ZONE 'UTC' AT TIME ZONE ${TIDSSONE}::text) AS periode,
        count(*)::int AS antall
      FROM navn
      GROUP BY 1
    )
    SELECT serie.periode AT TIME ZONE ${TIDSSONE}::text AS start, coalesce(tellinger.antall, 0) AS antall
    FROM generate_series(
      (SELECT min(periode) FROM tellinger),
      (SELECT max(periode) FROM tellinger),
      ('1 ' || ${enhet}::text)::interval
    ) AS serie(periode)
    LEFT JOIN tellinger USING (periode)
    ORDER BY 1
  `;

  return {
    enhet,
    punkter: rader.map((rad) => ({
      start: rad.start.toISOString(),
      antall: rad.antall,
      etikett: formaterPeriode(rad.start, enhet),
      aksetikett: formaterAksetikett(rad.start, enhet),
    })),
  };
}

// Etikettene lages her på serveren i stedet for i nettleseren, så de er like
// uansett hvilken tidssone og språkdata nettleseren har.
function formaterPeriode(start: Date, enhet: Tidsenhet): string {
  const formater = (valg: Intl.DateTimeFormatOptions) =>
    start.toLocaleString("no-NO", { timeZone: TIDSSONE, ...valg });
  switch (enhet) {
    case "minute":
    case "hour":
      return formater({ dateStyle: "long", timeStyle: "short" });
    case "day":
      return formater({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
    case "week":
      return `Uken fra ${formater({ day: "numeric", month: "long", year: "numeric" })}`;
    case "month":
      return formater({ month: "long", year: "numeric" });
    case "year":
      return formater({ year: "numeric" });
  }
}

function formaterAksetikett(start: Date, enhet: Tidsenhet): string {
  const formater = (valg: Intl.DateTimeFormatOptions) =>
    start.toLocaleString("no-NO", { timeZone: TIDSSONE, ...valg });
  switch (enhet) {
    case "minute":
    case "hour":
      return formater({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    case "day":
    case "week":
      return formater({ day: "2-digit", month: "2-digit", year: "numeric" });
    case "month":
      return formater({ month: "2-digit", year: "numeric" });
    case "year":
      return formater({ year: "numeric" });
  }
}
