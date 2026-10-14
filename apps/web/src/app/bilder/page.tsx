import { lagS3Klient, lesBlobKonfig } from "@/lib/blob";
import { hentBilder, MAKS_BYTES, type BildeDto } from "@/lib/bilder";
import { LastOppBilde } from "./LastOppBilde";

// Alltid hent ferske bilder fra bøtta, ikke cache siden statisk.
export const dynamic = "force-dynamic";

export default async function BilderPage() {
  const konfig = lesBlobKonfig();

  let bilder: BildeDto[] = [];
  let feil: string | null = null;
  if (konfig) {
    try {
      bilder = await hentBilder(lagS3Klient(konfig), konfig.bøtte);
    } catch (err) {
      console.error("Klarte ikke å hente bilder", err);
      feil = "Klarte ikke å hente bildene fra blob storage.";
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 border border-mikke-black/10">
      <h2 className="text-2xl font-semibold mb-2">Bilder 📷</h2>

      {!konfig ? (
        <p className="text-mikke-black/70">
          Bildeopplasting er ikke satt opp i dette miljøet. Den trenger blob
          storage fra plattformen, se{" "}
          <a href="/status" className="text-mikke-red hover:underline">
            plattformstatus
          </a>
          .
        </p>
      ) : (
        <>
          <p className="text-mikke-black/70 mb-6">
            Last opp et bilde, så havner det i bøtta og dukker opp under.
          </p>

          <LastOppBilde maksMB={MAKS_BYTES / 1024 / 1024} />

          {feil ? (
            <p className="text-mikke-red mt-6" role="alert">
              {feil} Se{" "}
              <a href="/status" className="hover:underline">
                plattformstatus
              </a>{" "}
              for detaljer.
            </p>
          ) : bilder.length === 0 ? (
            <p className="text-mikke-black/50 mt-6">
              Ingen bilder ennå. Bli den første!
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
              {bilder.map((bilde) => (
                <li key={bilde.navn}>
                  <a href={`/api/bilder/${bilde.navn}`}>
                    <img
                      src={`/api/bilder/${bilde.navn}`}
                      alt={`Bilde lastet opp ${new Date(bilde.lastetOpp).toLocaleString("no-NO")}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover rounded-lg border border-mikke-black/10"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <a
        href="/"
        className="inline-block mt-6 text-mikke-red font-medium hover:underline"
      >
        ← Til forsiden
      </a>
    </div>
  );
}
