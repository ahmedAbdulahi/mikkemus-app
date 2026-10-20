import { ENHETSNAVN, hentSide, hentTidsserie, lesSidetall, PER_SIDE, TIDSSONE } from "@/lib/navn";
import { SlettNavn } from "./SlettNavn";
import { Tidsgraf } from "./Tidsgraf";

// Alltid hent ferske data fra databasen, ikke cache siden statisk.
export const dynamic = "force-dynamic";

export default async function NavnPage({
  searchParams,
}: {
  searchParams: Promise<{ side?: string | string[] }>;
}) {
  const ønsketSide = lesSidetall((await searchParams).side);
  const [{ navn: alleNavn, side, antallSider, totalt }, tidsserie] = await Promise.all([
    hentSide(ønsketSide),
    hentTidsserie(),
  ]);
  const fra = (side - 1) * PER_SIDE + 1;

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 border border-mikke-black/10">
      <h2 className="text-2xl font-semibold mb-2">Alle som har vært innom</h2>
      <p className="text-mikke-black/70 mb-6">
        {totalt === 0
          ? "Ingen har registrert seg ennå."
          : `${totalt.toLocaleString("no-NO")} ${totalt === 1 ? "person har" : "personer har"} registrert seg.`}
      </p>

      {tidsserie && (
        <Tidsgraf punkter={tidsserie.punkter} enhetsnavn={ENHETSNAVN[tidsserie.enhet]} />
      )}

      {totalt > 0 && (
        <p className="text-sm text-mikke-black/50 mb-2">
          Viser {fra.toLocaleString("no-NO")}–{(fra + alleNavn.length - 1).toLocaleString("no-NO")}, nyeste først
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {alleNavn.map((n) => (
          <li
            key={n.id}
            className="flex items-center justify-between gap-4 border-b border-mikke-black/10 py-2"
          >
            <span className="font-medium break-all">{n.navn}</span>
            <span className="flex items-center gap-4 shrink-0">
              <span className="text-sm text-mikke-black/50">
                {new Date(n.opprettet).toLocaleString("no-NO", { timeZone: TIDSSONE })}
              </span>
              <SlettNavn id={n.id} navn={n.navn} />
            </span>
          </li>
        ))}
      </ul>

      {antallSider > 1 && <Sidevelger side={side} antallSider={antallSider} />}

      <a
        href="/"
        className="inline-block mt-6 text-mikke-red font-medium hover:underline"
      >
        ← Registrer et nytt navn
      </a>
    </div>
  );
}

function Sidevelger({ side, antallSider }: { side: number; antallSider: number }) {
  const lenker: [tekst: string, mål: number, aktiv: boolean][] = [
    ["« Første", 1, side > 1],
    ["‹ Forrige", side - 1, side > 1],
    ["Neste ›", side + 1, side < antallSider],
    ["Siste »", antallSider, side < antallSider],
  ];
  const [første, forrige, neste, siste] = lenker.map(([tekst, mål, aktiv]) =>
    aktiv ? (
      <a key={tekst} href={`/navn?side=${mål}`} className="text-mikke-red font-medium hover:underline">
        {tekst}
      </a>
    ) : (
      <span key={tekst} className="text-mikke-black/30" aria-disabled="true">
        {tekst}
      </span>
    ),
  );

  return (
    <nav aria-label="Sider" className="flex items-center justify-between gap-2 mt-6 text-sm">
      <span className="flex gap-4">
        {første}
        {forrige}
      </span>
      <span className="text-mikke-black/70" aria-current="page">
        Side {side.toLocaleString("no-NO")} av {antallSider.toLocaleString("no-NO")}
      </span>
      <span className="flex gap-4">
        {neste}
        {siste}
      </span>
    </nav>
  );
}
