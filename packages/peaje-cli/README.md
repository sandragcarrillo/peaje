# @peaje/cli

Install [Peaje](https://peaje-gateway.up.railway.app) on your site in one command. Peaje charges AI agents per request (MPP, HTTP 402) and publishes your catalog, MCP server and OpenAPI spec; this CLI makes all of that answer on your own domain.

```sh
npx @peaje/cli@1 init <slug> --yes
```

`<slug>` is the business slug from your Peaje dashboard. `@1` pins the major so a future `peaje@2` never changes behavior under a script.

Requires Node 20 or newer. No runtime dependencies.

## Commands

### `peaje init <slug>`

1. Detects the stack (Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Vite, static) and the host (Next, Vercel, Cloudflare Workers, nginx, Caddy) by reading `package.json` and the config files in the directory. In a monorepo with several sites it stops and asks for `--dir`.
2. Downloads the kit for that host from the gateway.
3. Writes it:
   - new files (`public/robots.txt`) only if they do not exist;
   - snippets to merge (`peaje/next.config.ts`, `peaje/head.html`, ...) always under `peaje/`, exactly as the gateway sent them.
4. Next.js: wraps a plain `next.config.*` with `withPeaje()` from `@peaje/next`, adds `@peaje/next` to `package.json` (you run the install; the command is printed) and renders `<PeajeHead slug="..." />` in the `<head>` of the app router root layout. Configs wrapped in `withSentryConfig(...)` or similar, and the pages router, are left for you with an exact instruction.
5. Moves static copies that would shadow the proxy (`public/openapi.json`, `app/mcp/route.ts`, ...) to `.peaje-backup/<timestamp>/`. Nothing is ever deleted.

Without `--yes` it prints the plan and asks for confirmation on a TTY. Without a TTY and without `--yes` it exits with code 2 instead of hanging.

Flags: `--dir <path>`, `--host next|vercel|cloudflare|nginx|caddy`, `--gateway <url>`, `--yes`, `--json`.

### `peaje plan <slug>`

Same as `init`, writes nothing. Use it to see what would change.

### `peaje verify <slug> [--wait <seconds>]`

Asks the gateway to measure your domain: proxy rewrites, stale copies, JSON-LD, head links, robots.txt. Exit code 0 when everything passes, 1 otherwise. With `--wait 600` it retries every 15 seconds for up to 10 minutes, so you can run it right after triggering a deploy.

Everything is measured on the business domain, not on the gateway. Run it only after the deploy is live.

### `peaje clean <slug>`

Only the backup step: moves static copies and route handlers that shadow the proxy to `.peaje-backup/`.

## What it touches and what it does not

Touches: `next.config.*` (only when it is a plain `export default X` or `module.exports = X`), the root `app/layout.*`, `package.json` dependencies, `public/robots.txt` (only if missing), files under `peaje/`, and moves shadowing copies to `.peaje-backup/`.

Does not touch: anything else. It never runs your package manager, never deletes files, never rewrites a config it cannot parse, never edits an existing `robots.txt` or `app/robots.ts` (it tells you what to change instead), and never edits your footer: add the visible `<a href="/developers">API for agents</a>` yourself.

## For coding agents

```sh
npx @peaje/cli@1 init <slug> --yes --json      # one JSON object: { ok, stack, host, written, moved, manual, next }
# apply what is in `manual`, run the install command from `next`
<build>
<deploy>
npx @peaje/cli@1 verify <slug> --wait 600 --json
```

Exit codes: `0` ok, `1` error or failed verification, `2` confirmation needed (no TTY, no `--yes`), `3` stack not recognized. On `3` the full kit is written under `peaje/` so you can translate it to the host by hand.

`--gateway` (or `PEAJE_GATEWAY_URL`) points the CLI at a different gateway, for local development.

## License

MIT

## Answer engines only

`npx @peaje/cli@1 init <slug> --only aeo` installs just the answer-engine layer: a robots.txt that allows the citing bots by name and an Organization JSON-LD in the homepage head. No proxy, no 402, no npm dependency. Use it when the business only wants ChatGPT, Perplexity and Google to read the site correctly; run the same command without `--only aeo` later to add the agents layer. `peaje verify <slug> --only aeo` checks only that layer.
