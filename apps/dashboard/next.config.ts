import type { NextConfig } from "next";
import { withPeaje } from "@peaje/next";

const nextConfig = {
  agentRules: false,
  /* config options here */
} satisfies NextConfig;

// usepeaje.com corre sobre Peaje: llms.txt, openapi.json, el MCP y los
// archivos de descubrimiento vienen del gateway, como en cualquier sitio cliente.
export default withPeaje(nextConfig, { slug: "peaje" });
