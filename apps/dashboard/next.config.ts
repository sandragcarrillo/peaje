import type { NextConfig } from "next";
import { withPeaje } from "@peaje/next";

// Headers de seguridad fijos para todo el sitio (la checklist de producción de
// Privy pide anti-clickjacking). La CSP va aparte, con nonce, en proxy.ts.
const seguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  agentRules: false,
  // El blog lee sus .md en cada request (el layout es dinámico): hay que subirlos con la función.
  outputFileTracingIncludes: {
    "/blog": ["./content/blog/**/*"],
    "/blog/[slug]": ["./content/blog/**/*"],
    "/sitemap.xml": ["./content/blog/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: seguridad }];
  },
  // Slugs del blog que cambiaron después de publicarse: el viejo lleva al nuevo.
  async redirects() {
    return [
      {
        source: "/blog/como-monto-un-servidor-mcp-para-mi-tienda-sin-saber-programar",
        destination: "/blog/como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar",
        permanent: true,
      },
    ];
  },
} satisfies NextConfig;

// usepeaje.com corre sobre Peaje: llms.txt, openapi.json, el MCP y los
// archivos de descubrimiento vienen del gateway, como en cualquier sitio cliente.
export default withPeaje(nextConfig, { slug: "peaje" });
