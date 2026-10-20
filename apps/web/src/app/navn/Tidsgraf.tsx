"use client";

import { useState } from "react";
import type { Tidspunkt } from "@/lib/navn";

// Søylediagram over hvor mange navn som ble lagt til i hver periode. Tegnes
// som ren SVG, så appen slipper et eget grafbibliotek. Bredden tilsvarer
// innholdet i kortet på en vanlig skjerm, og på mindre skjermer skaleres alt ned.
const BREDDE = 576;
const HØYDE = 200;
const MARG = { topp: 12, høyre: 4, bunn: 24, venstre: 60 };
const PLOTT_BREDDE = BREDDE - MARG.venstre - MARG.høyre;
const PLOTT_HØYDE = HØYDE - MARG.topp - MARG.bunn;
const MAKS_SØYLEBREDDE = 24;
const MELLOMROM = 2;

export function Tidsgraf({
  punkter,
  enhetsnavn,
}: {
  punkter: Tidspunkt[];
  enhetsnavn: string;
}) {
  const [aktiv, setAktiv] = useState<number | null>(null);

  const { topp: skalaMaks, merker } = lagYAkse(Math.max(...punkter.map((p) => p.antall)));
  const spor = PLOTT_BREDDE / punkter.length;
  const søylebredde = Math.max(1, Math.min(MAKS_SØYLEBREDDE, spor - MELLOMROM));
  const y = (antall: number) => MARG.topp + PLOTT_HØYDE * (1 - antall / skalaMaks);
  const midtAv = (i: number) => MARG.venstre + spor * (i + 0.5);

  // Første, midterste og siste periode får etikett på x-aksen.
  const aksemerker = [...new Set([0, Math.floor((punkter.length - 1) / 2), punkter.length - 1])];
  const aktivtPunkt = aktiv === null ? null : punkter[aktiv];

  function håndterTast(event: React.KeyboardEvent) {
    const steg = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!steg) return;
    event.preventDefault();
    setAktiv((i) => Math.min(punkter.length - 1, Math.max(0, (i ?? punkter.length) + steg)));
  }

  return (
    <figure className="mb-8">
      <figcaption className="font-medium mb-1">Nye navn per {enhetsnavn}</figcaption>
      <p className="text-sm text-mikke-black/50 mb-3">
        Hold over en søyle, eller bruk piltastene, for å se antallet.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${BREDDE} ${HØYDE}`}
          className="w-full h-auto overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-mikke-red rounded"
          role="img"
          aria-label={`Søylediagram over nye navn per ${enhetsnavn}, fra ${punkter[0].etikett} til ${punkter[punkter.length - 1].etikett}. Tallene finnes også i tabellen under.`}
          tabIndex={0}
          onKeyDown={håndterTast}
          onBlur={() => setAktiv(null)}
          onPointerLeave={() => setAktiv(null)}
        >
          {merker.map((verdi) => (
            <g key={verdi}>
              <line
                x1={MARG.venstre}
                x2={BREDDE - MARG.høyre}
                y1={y(verdi)}
                y2={y(verdi)}
                stroke="currentColor"
                strokeOpacity={0.1}
                className="text-mikke-black"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={MARG.venstre - 8}
                y={y(verdi)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-mikke-black/50 text-[11px] tabular-nums"
              >
                {formaterKompakt(verdi)}
              </text>
            </g>
          ))}

          {punkter.map((punkt, i) =>
            punkt.antall === 0 ? null : (
              <path
                key={punkt.start}
                d={søylesti(midtAv(i) - søylebredde / 2, y(punkt.antall), søylebredde, y(0) - y(punkt.antall))}
                className={`fill-mikke-red transition-opacity ${aktiv !== null && aktiv !== i ? "opacity-50" : ""}`}
              />
            ),
          )}

          <line
            x1={MARG.venstre}
            x2={BREDDE - MARG.høyre}
            y1={y(0)}
            y2={y(0)}
            stroke="currentColor"
            strokeOpacity={0.3}
            className="text-mikke-black"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {aksemerker.map((i) => (
            <text
              key={i}
              x={i === 0 ? MARG.venstre : i === punkter.length - 1 ? BREDDE - MARG.høyre : midtAv(i)}
              y={HØYDE - 6}
              textAnchor={i === 0 ? "start" : i === punkter.length - 1 ? "end" : "middle"}
              className="fill-mikke-black/50 text-[11px] tabular-nums"
            >
              {punkter[i].aksetikett}
            </text>
          ))}

          {/* Treffflatene dekker hele høyden og bredden av sporet, så små søyler også er lette å treffe. */}
          {punkter.map((punkt, i) => (
            <rect
              key={punkt.start}
              x={MARG.venstre + spor * i}
              y={MARG.topp}
              width={spor}
              height={PLOTT_HØYDE}
              fill="transparent"
              onPointerEnter={() => setAktiv(i)}
            />
          ))}
        </svg>

        {aktivtPunkt && aktiv !== null && (
          <div
            className={`pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap ${forankring(midtAv(aktiv) / BREDDE)} rounded-lg bg-white px-3 py-2 text-sm shadow-md border border-mikke-black/10`}
            style={{
              left: `${(midtAv(aktiv) / BREDDE) * 100}%`,
              top: `calc(${(y(aktivtPunkt.antall) / HØYDE) * 100}% - 6px)`,
            }}
            aria-live="polite"
          >
            <p className="font-semibold">
              {medMellomrom(aktivtPunkt.antall)} {aktivtPunkt.antall === 1 ? "nytt navn" : "nye navn"}
            </p>
            <p className="text-mikke-black/60">{aktivtPunkt.etikett}</p>
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-mikke-black/70">Vis som tabell</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-mikke-black/50">
              <th className="font-medium py-1">Periode</th>
              <th className="font-medium py-1 text-right">Nye navn</th>
            </tr>
          </thead>
          <tbody>
            {punkter.map((punkt) => (
              <tr key={punkt.start} className="border-t border-mikke-black/10">
                <td className="py-1">{punkt.etikett}</td>
                <td className="py-1 text-right tabular-nums">{medMellomrom(punkt.antall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// Verktøytipset sentreres over søyla, men legges inn mot midten ved kantene
// så det ikke stikker ut av kortet.
function forankring(andel: number): string {
  if (andel < 0.2) return "-translate-x-[10%]";
  if (andel > 0.8) return "-translate-x-[90%]";
  return "-translate-x-1/2";
}

// Rund topp (4px) og flat bunn mot grunnlinja.
function søylesti(x: number, y: number, bredde: number, høyde: number): string {
  const r = Math.min(4, bredde / 2, høyde);
  return [
    `M${x},${y + høyde}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + bredde - r}`,
    `A${r},${r} 0 0 1 ${x + bredde},${y + r}`,
    `V${y + høyde}`,
    "Z",
  ].join("");
}

// Toppen av skalaen og merkene på y-aksen, med runde steg (1, 2, 2,5 eller 5 × 10^n).
function lagYAkse(maks: number): { topp: number; merker: number[] } {
  const råSteg = Math.max(1, maks) / 4;
  const tierpotens = 10 ** Math.floor(Math.log10(råSteg));
  const steg =
    [1, 2, 2.5, 5, 10].map((f) => f * tierpotens).find((s) => s >= råSteg && Number.isInteger(s)) ??
    10 * tierpotens;
  const topp = Math.ceil(Math.max(1, maks) / steg) * steg;
  const merker = [];
  for (let verdi = 0; verdi <= topp; verdi += steg) merker.push(verdi);
  return { topp, merker };
}

// Ikke Intl her: serveren og nettleseren må gi nøyaktig samme tekst.
function formaterKompakt(tall: number): string {
  const [deler, endelse] =
    tall >= 1_000_000 ? [1_000_000, " mill."] : tall >= 1000 ? [1000, "k"] : [1, ""];
  return String(Number((tall / deler).toFixed(1))).replace(".", ",") + endelse;
}

function medMellomrom(tall: number): string {
  return String(tall).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
