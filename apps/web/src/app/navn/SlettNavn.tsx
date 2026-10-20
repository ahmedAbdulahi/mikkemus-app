"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SlettNavn({ id, navn }: { id: string; navn: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sletter" | "feil">("idle");

  async function slett() {
    if (!confirm(`Slette «${navn}»?`)) return;
    setStatus("sletter");

    const res = await fetch(`/api/navn/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);

    // 404 betyr at noen andre allerede har slettet det, så lista må uansett oppdateres.
    if (!res?.ok && res?.status !== 404) {
      setStatus("feil");
      return;
    }

    // Hent lista, antallet og grafen på nytt fra serveren.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={slett}
      disabled={status === "sletter"}
      aria-label={`Slett ${navn}`}
      className="text-sm text-mikke-red hover:underline disabled:opacity-60"
    >
      {status === "sletter" ? "Sletter..." : status === "feil" ? "Feilet, prøv igjen" : "Slett"}
    </button>
  );
}
