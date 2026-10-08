import { sjekkPlattform, type Sjekk, type Steg } from "@/lib/plattformsjekk";

// Sjekkene skal kjøres på hver forespørsel, ikke én gang under bygging.
export const dynamic = "force-dynamic";

const merker: Record<Sjekk["status"], { tekst: string; klasse: string }> = {
  ok: { tekst: "Fungerer", klasse: "bg-green-100 text-green-800" },
  feil: { tekst: "Fungerer ikke", klasse: "bg-mikke-red/10 text-mikke-red" },
  "ikke-konfigurert": {
    tekst: "Ikke konfigurert",
    klasse: "bg-mikke-black/10 text-mikke-black/70",
  },
};

const stegIkoner: Record<Steg["status"], { ikon: string; klasse: string }> = {
  ok: { ikon: "✓", klasse: "text-green-700" },
  feil: { ikon: "✗", klasse: "text-mikke-red" },
  "hoppet-over": { ikon: "–", klasse: "text-mikke-black/40" },
};

export default async function StatusPage() {
  const sjekker = await sjekkPlattform();

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 border border-mikke-black/10">
      <h2 className="text-2xl font-semibold mb-2">Plattformstatus</h2>
      <p className="text-mikke-black/70 mb-6">
        Tester ressursene plattformen har gitt appen. Det som ikke fungerer
        vises her i stedet for å stoppe appen.
      </p>

      <div className="flex flex-col gap-6">
        {sjekker.map((sjekk) => (
          <section
            key={sjekk.tjeneste}
            className="border-t border-mikke-black/10 pt-4"
          >
            <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-lg font-semibold">{sjekk.tjeneste}</h3>
              <span
                className={`text-sm font-medium rounded-full px-3 py-1 whitespace-nowrap ${merker[sjekk.status].klasse}`}
              >
                {merker[sjekk.status].tekst}
              </span>
            </div>

            {sjekk.melding && (
              <p className="text-mikke-black/70 mb-2 break-words">
                {sjekk.melding}
              </p>
            )}

            {sjekk.info.length > 0 && (
              <ul className="text-sm text-mikke-black/50 mb-3 break-all">
                {sjekk.info.map((linje) => (
                  <li key={linje}>{linje}</li>
                ))}
              </ul>
            )}

            {sjekk.steg.length > 0 && (
              <ul className="flex flex-col gap-1">
                {sjekk.steg.map((steg) => (
                  <li key={steg.navn} className="flex gap-2">
                    <span
                      className={`font-bold w-4 shrink-0 ${stegIkoner[steg.status].klasse}`}
                      aria-hidden="true"
                    >
                      {stegIkoner[steg.status].ikon}
                    </span>
                    <div className="min-w-0">
                      <span
                        className={
                          steg.status === "hoppet-over"
                            ? "text-mikke-black/40"
                            : "font-medium"
                        }
                      >
                        {steg.navn}
                        {steg.status === "hoppet-over" && " (ikke testet)"}
                      </span>
                      {steg.melding && (
                        <p
                          className={`text-sm whitespace-pre-wrap break-words ${
                            steg.status === "feil"
                              ? "text-mikke-red"
                              : "text-mikke-black/50"
                          }`}
                        >
                          {steg.melding}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <a href="/" className="text-mikke-red font-medium hover:underline">
          ← Til forsiden
        </a>
        <a href="/status" className="text-mikke-red font-medium hover:underline">
          Test på nytt ↻
        </a>
      </div>
    </div>
  );
}
