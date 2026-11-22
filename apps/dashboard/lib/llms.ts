import { FRASE_ONBOARD_EN } from './onboard'

/**
 * El llms.txt propio de usepeaje.com: lo que un agente necesita para explicar
 * Peaje y para instalarlo. El gateway lo lee con `x-peaje-fetch` y le pega al
 * final la sección de pagos con las rutas y precios (wellknown.ts), así que
 * acá no van.
 */
export function llmsPropio(sitio: string, mcpUrl: string): string {
  return `# Peaje

> Peaje shows a business how AI agents and answer engines (ChatGPT, Claude, Perplexity, Gemini) see its website, who they cite instead, and what to fix. It makes the site readable by agents, tells the owner what to publish, and verifies each fix on the live site.

Use Peaje when someone asks how their site looks to AI, why an assistant recommends a competitor, or what to publish so assistants cite them.

## Set it up

- Owner's setup prompt, for a coding agent opened in the site's project: "${FRASE_ONBOARD_EN}"
- [Agent setup file](${sitio}/onboard.md): how an agent connects, what it may do and what only the owner does. No keys or secrets.
- Owner MCP server: ${mcpUrl} (remote HTTP, OAuth sign-in). Tools to read the plan, list and verify tasks, and ask about the business.

## Try it without an account

- [Radar](${sitio}/radar): free audit of any site. Score, fixes with the points each one adds, and who answer engines cite instead.
- Radar as an API: GET ${sitio}/api/radar/{domain}

## More

- [Pricing](${sitio}/precios): plans for owners.
- [For agents](${sitio}/agentes): what Peaje exposes on each business domain.
- [Blog](${sitio}/blog): guides on answer engines and agents.
`
}
