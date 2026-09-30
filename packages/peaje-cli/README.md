# @peaje/cli

Install [Peaje](https://peaje-gateway.up.railway.app) on your site in one command. Peaje charges AI agents per request (MPP, HTTP 402) and publishes your catalog, MCP server and OpenAPI spec; this CLI makes all of that answer on your own domain.

```sh
npx @peaje/cli@1 init <slug> --yes
```

`<slug>` is the business slug from your Peaje dashboard. `@1` pins the major so a future `peaje@2` never changes behavior under a script.

Requires Node 20 or newer. No runtime dependencies.

## Commands

### `peaje init <slug>`

1. Detects the stack (Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express, Vite, static) and the host (Next, Vercel, Cloudflare Workers, nginx, Caddy) by reading `package.json` and the config files in the directory. In a monorepo with several sites it stops and asks for `--dir`.
2. Downloads the kit for that host from the gateway.
3. Writes it:
   - new files (`public/robots.txt`) only if they do not exist;
   - snippets to merge (`peaje/next.config.ts`, `peaje/head.html`, ...) always under `peaje/`, exactly as the gateway sent them.
4. Next.js: wraps a plain `next.config.*` with `withPeaje()` from `@peaje/next`, writes `proxy.ts` (Next 16) or `middleware.ts` (older) with `peajeProxy()` so priced API routes answer 402 on your domain at runtime (if you already have one, you get the one-line wrap as an instruction), adds `@peaje/next` to `package.json` (you run the install; the command is printed) and renders `<PeajeHead slug="..." />` in the `<head>` of the app router root layout. Configs wrapped in `withSentryConfig(...)` or similar, and the pages router, are left for you with an exact instruction.
5. Other stacks get the same runtime proxy from [`@peaje/proxy`](../peaje-proxy): see [Outside Next.js](#outside-nextjs).
6. Moves static copies that would shadow the proxy (`public/openapi.json`, `app/mcp/route.ts`, ...) to `.peaje-backup/<timestamp>/`. Nothing is ever deleted.

Without `--yes` it prints the plan and asks for confirmation on a TTY. Without a TTY and without `--yes` it exits with code 2 instead of hanging.

Flags: `--dir <path>`, `--host next|vercel|cloudflare|nginx|caddy`, `--gateway <url>`, `--yes`, `--json`.

### `peaje plan <slug>`

Same as `init`, writes nothing. Use it to see what would change.

### `peaje verify <slug> [--wait <seconds>]`

Asks the gateway to measure your domain: proxy rewrites, stale copies, JSON-LD, head links, robots.txt. Exit code 0 when everything passes, 1 otherwise. With `--wait 600` it retries every 15 seconds for up to 10 minutes, so you can run it right after triggering a deploy.

Everything is measured on the business domain, not on the gateway. Run it only after the deploy is live.

### `peaje clean <slug>`

Only the backup step: moves static copies and route handlers that shadow the proxy to `.peaje-backup/`.


### `peaje tasks`, `peaje task <id>`, `peaje done <id>`

Peaje's agent (the "My agent" page of each business in the dashboard) leaves tasks for your coding agent: fixes for failing checks, pages that answer engines would cite, routes that agents asked for and got a 404. It never touches your site; these commands are how your coding agent picks them up.

```sh
export PEAJE_AGENT_KEY=peaje_live_...   # created in the dashboard, "My agent"
npx @peaje/cli@1 tasks                  # open tasks
npx @peaje/cli@1 task <id>              # the full prompt, to implement in this repo
npx @peaje/cli@1 done <id> --url <live url>   # after deploying; Peaje verifies it on the live site
```

`done` exits 0 when Peaje verified the task on the live site and 1 when it is marked done but not live yet (Peaje checks again every day). The same tasks are available over MCP at `https://peaje-gateway.up.railway.app/_owner/mcp` with `Authorization: Bearer <agent key>`; the dashboard shows the exact line for Claude Code and Cursor.

## Outside Next.js

The runtime proxy that answers 402 for your priced API routes, on your own domain, comes from `@peaje/proxy`:

| Stack | What `init` does |
|---|---|
| Vite on Vercel (`vercel.json` or `.vercel/project.json`) | Writes `middleware.ts` (or `.js` without a `tsconfig.json`) at the root with `@peaje/proxy/vercel` (Vercel Routing Middleware) and adds `@peaje/proxy` to `package.json`. If you already have a `middleware.*`, you get the one-line wrap as an instruction. The `vercel.json` snippet is not needed. |
| Express, Hono | When `main` and the `start`/`dev` scripts point at one source file that creates the app once (`const app = express()`, `const app = new Hono()`), adds the import and `app.use(peajeExpress({ slug }))` / `app.use(peajeHono({ slug }))` right after it, before body parsers and routes. Otherwise prints those two lines for you to add. |
| Astro (SSR), SvelteKit | Prints the `src/middleware.ts` / `src/hooks.server.ts` lines with `peajeFetch` from `@peaje/proxy`. |

All of them need `PEAJE_ORIGIN_SECRET` in the hosting environment (Kit page of the dashboard); `init` lists it as a manual step. Without it, discovery files and `/r/` links work and priced API routes are not charged on your domain.

## What it touches and what it does not

Touches: `next.config.*` (only when it is a plain `export default X` or `module.exports = X`), the root `app/layout.*`, a new root `middleware.*` (Vite on Vercel), one `app.use(...)` line in an unambiguous Express or Hono entry file, `package.json` dependencies, `public/robots.txt` (only if missing), files under `peaje/`, and moves shadowing copies to `.peaje-backup/`.

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
