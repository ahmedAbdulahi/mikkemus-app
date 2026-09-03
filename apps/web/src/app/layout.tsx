import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mikke Mus-appen",
  description: "Skriv inn navnet ditt og se hvem andre som har vært innom!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className="min-h-screen">
        <header className="bg-mikke-red text-white py-4 shadow-md">
          <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              🐭
            </span>
            <h1 className="text-xl font-bold">Mikke Mus-appen</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
