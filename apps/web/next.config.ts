import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" gir en selvstendig build (inkl. node_modules som trengs)
  // som er ideell for et minimalt Docker-image i produksjon.
  output: "standalone",
};

export default nextConfig;
