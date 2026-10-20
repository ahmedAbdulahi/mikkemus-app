"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LastOppBilde({ maksMB }: { maksMB: number }) {
  const router = useRouter();
  const skjema = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sender" | "feil">("idle");
  const [feilmelding, setFeilmelding] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sender");
    setFeilmelding(null);

    const res = await fetch("/api/bilder", {
      method: "POST",
      body: new FormData(event.currentTarget),
    }).catch(() => null);

    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      setFeilmelding(data?.error ?? "Noe gikk galt, prøv igjen.");
      setStatus("feil");
      return;
    }

    skjema.current?.reset();
    setStatus("idle");
    // Hent lista med bilder på nytt fra serveren.
    router.refresh();
  }

  return (
    <form ref={skjema} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label htmlFor="bilde" className="font-medium">
        Velg et bilde (JPEG, PNG, GIF eller WebP, maks {maksMB} MB)
      </label>
      <input
        id="bilde"
        name="bilde"
        type="file"
        required
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="border border-mikke-black/20 rounded-lg px-4 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-mikke-cream file:px-3 file:py-1 file:font-medium"
      />

      {feilmelding && (
        <p className="text-mikke-red text-sm" role="alert">
          {feilmelding}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sender"}
        className="bg-mikke-red hover:bg-mikke-red/90 disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
      >
        {status === "sender" ? "Laster opp..." : "Last opp"}
      </button>
    </form>
  );
}
