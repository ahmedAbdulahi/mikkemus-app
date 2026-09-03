import { prisma } from "@mikkemus/database";

// Alltid hent ferske data fra databasen, ikke cache siden statisk.
export const dynamic = "force-dynamic";

export default async function NavnPage() {
  const alleNavn = await prisma.navn.findMany({
    orderBy: { opprettet: "desc" },
  });

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 border border-mikke-black/10">
      <h2 className="text-2xl font-semibold mb-2">Alle som har vært innom</h2>
      <p className="text-mikke-black/70 mb-6">
        {alleNavn.length === 0
          ? "Ingen har registrert seg ennå."
          : `${alleNavn.length} ${alleNavn.length === 1 ? "person har" : "personer har"} registrert seg.`}
      </p>

      <ul className="flex flex-col gap-2">
        {alleNavn.map((n) => (
          <li
            key={n.id}
            className="flex items-center justify-between border-b border-mikke-black/10 py-2"
          >
            <span className="font-medium">{n.navn}</span>
            <span className="text-sm text-mikke-black/50">
              {new Date(n.opprettet).toLocaleString("no-NO")}
            </span>
          </li>
        ))}
      </ul>

      <a
        href="/"
        className="inline-block mt-6 text-mikke-red font-medium hover:underline"
      >
        ← Registrer et nytt navn
      </a>
    </div>
  );
}
