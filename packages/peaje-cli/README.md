# @peaje/cli

Install [Peaje](https://api.usepeaje.com) on your site in one command. Peaje charges AI agents per request (MPP, HTTP 402) and publishes your catalog, MCP server and OpenAPI spec; this CLI makes all of that answer on your own domain.

```sh
npx @peaje/cli@1 plan <slug>         # writes nothing: every file it would create, edit or move
npx @peaje/cli@1 init <slug> --yes   # once you have reviewed that list
```

`<slug>` is the business slug from your Peaje dashboard. `@1` pins the major so a future `peaje@2` never changes behavior under a script.

Requires Node 20 or newer. No runtime dependencies.

## Commands

### `peaje init <slug>`

1. Detects the stack (Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express, Vite, static) and the host (Next, Vercel, Cloudflare Workers, nginx, Caddy) by reading `package.json` and the config files in the directory. In a monorepo with several sites it stops and asks for `--dir`.
2. Downloads the kit for that host from the gateway.
3. Writes it:
   - `public/robots.txt` if there is none; if there is one, it appends a block between `# peaje:begin` and `# peaje:end` (see [What it touches](#what-it-touches-and-what-it-does-not));
   - snippets to merge (`peaje/next.config.ts`, `peaje/head.html`, ...) under `peaje/`, exactly as the gateway sent them. In Next.js they are skipped when step 4 already applied them (`withPeaje()` in the config, `<PeajeHead />` in the layout).
4. Next.js: wraps a plain `next.config.*` with `withPeaje()` from `@peaje/next`, writes `proxy.ts` (Next 16) or `middleware.ts` (older) with `peajeProxy()` so priced API routes answer 402 on your domain at runtime (if you already have one, you get the one-line wrap as an instruction), adds `@peaje/next` to `package.json` (you run the install; the command is printed) and renders `<PeajeHead slug="..." originHost="..." />` in the `<head>` of the app router root layout. `originHost` keeps the pages static; an existing `<PeajeHead slug="..." />` without it gets it added. Configs wrapped in `withSentryConfig(...)` or similar, and the pages router, are left for you with an exact instruction.
5. Other stacks get the same runtime proxy from [`@peaje/proxy`](../peaje-proxy): see [Outside Next.js](#outside-nextjs).
6. Moves static copies that would shadow the proxy (`public/openapi.json`, `app/mcp/route.ts`, ...) to `.peaje-backup/<timestamp>/`. Nothing is ever deleted.
7. Warns about the site's own pages that Peaje replaces. Peaje's rules run before the site's routes on the paths it serves (`/docs`, `/developers`, `/mcp`, `/openapi.json`, `/.well-known/*`, `/r/*`, `/checkout_sessions`, ...), so an `app/docs/page.tsx` (route groups included), `pages/docs.tsx`, `src/routes/docs/+page.svelte` or `public/docs/index.html` stops showing and `/docs` becomes the Peaje developer portal. Each one is printed as a warning before the file list and returned in `collisions` with `--json`. Move the page or agree it with the owner before deploying.

Without `--yes` it prints the plan and asks for confirmation on a TTY. Without a TTY and without `--yes` it exits with code 2 instead of hanging.

Flags: `--dir <path>`, `--host next|vercel|cloudflare|nginx|caddy`, `--gateway <url>`, `--yes`, `--json`.

### `peaje plan <slug>`

Same as `init`, writes nothing. Use it to see what would change, collisions included. With `--json` the object has `dryRun: true`, the planned files in `wouldWrite` and `wouldMove`, and `written` and `moved` empty (nothing was written).

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

`done` exits 0 when Peaje verified the task on the live site and 1 when it is marked done but not live yet (Peaje checks again every day). The same tasks are available over MCP at `https://api.usepeaje.com/_owner/mcp` with `Authorization: Bearer <agent key>`; the dashboard shows the exact line for Claude Code and Cursor.

## Outside Next.js

The runtime proxy that answers 402 for your priced API routes, on your own domain, comes from `@peaje/proxy`:

| Stack | What `init` does |
|---|---|
| Vite on Vercel (`vercel.json` or `.vercel/project.json`) | Writes `middleware.ts` (or `.js` without a `tsconfig.json`) at the root with `@peaje/proxy/vercel` (Vercel Routing Middleware) and adds `@peaje/proxy` to `package.json`. If you already have a `middleware.*`, you get the one-line wrap as an instruction. The `vercel.json` snippet is not needed. |
| Express, Hono | When `main` and the `start`/`dev` scripts point at one source file that creates the app once (`const app = express()`, `const app = new Hono()`), adds the import and `app.use(peajeExpress({ slug }))` / `app.use(peajeHono({ slug }))` right after it, before body parsers and routes. Otherwise prints those two lines for you to add. |
| Astro (SSR), SvelteKit | Prints the `src/middleware.ts` / `src/hooks.server.ts` lines with `peajeFetch` from `@peaje/proxy`. |

All of them need `PEAJE_ORIGIN_SECRET` in the hosting environment (Kit page of the dashboard); `init` lists it as a manual step. Without it, discovery files and `/r/` links work and priced API routes are not charged on your domain.

## What it touches and what it does not

Touches: `next.config.*` (only when it is a plain `export default X` or `module.exports = X`), the root `app/layout.*`, a new `proxy.*` or `middleware.*` (Next.js, and Vite on Vercel), one `app.use(...)` line in an unambiguous Express or Hono entry file, `package.json` dependencies, `public/robots.txt` (created if missing; an existing one gets a block appended between `# peaje:begin` and `# peaje:end` with the named answer-engine bots and the paid paths, and your own rules are left as they are), files under `peaje/`, and moves shadowing copies to `.peaje-backup/`.

Does not touch: anything else. It never runs your package manager, never deletes files, never rewrites a config it cannot parse, never edits `app/robots.ts` (it tells you what to change there instead), and never edits your footer: add the visible `<a href="/developers">API for agents</a>` yourself.

## For coding agents

```sh
npx @peaje/cli@1 plan <slug> --json            # writes nothing: { dryRun: true, wouldWrite, wouldMove, collisions, manual, next }
# show wouldWrite, wouldMove and collisions to the owner and wait for a yes
npx @peaje/cli@1 init <slug> --yes --json      # { ok, dryRun: false, stack, host, written, moved, collisions, manual, next }
git status && git diff                         # review what changed
# apply what is in `manual`, run the install command from `next`
<build>
# ask the owner before committing or deploying
npx @peaje/cli@1 verify <slug> --wait 600 --json   # only after the deploy is live
```

Exit codes: `0` ok, `1` error or failed verification, `2` confirmation needed (no TTY, no `--yes`), `3` stack not recognized. On `3` the full kit is written under `peaje/` so you can translate it to the host by hand.

`--gateway` (or `PEAJE_GATEWAY_URL`) points the CLI at a different gateway, for local development.

## Answer engines only

`npx @peaje/cli@1 init <slug> --only aeo` installs just the answer-engine layer: a robots.txt that allows the citing bots by name and an Organization JSON-LD in the homepage head. No proxy, no 402, no npm dependency. Use it when the business only wants ChatGPT, Perplexity and Google to read the site correctly; run the same command without `--only aeo` later to add the agents layer. `peaje verify <slug> --only aeo` checks only that layer.

## Uninstall

`init` only writes the files it lists, so undoing it is reverting those files:

1. Revert what it wrote or edited. The list is `written` in the `--json` output (or the `Files:` block it printed); with git, `git checkout -- <file>` for edited files and delete the new ones (`proxy.ts` or `middleware.ts`, `peaje/`). In `next.config.*` remove the `withPeaje(...)` wrap and its import; in the root layout remove `<PeajeHead ... />` and its import; in Express or Hono remove the `app.use(peaje...)` line and its import.
2. In `robots.txt`, delete everything between `# peaje:begin` and `# peaje:end`, both lines included (or the whole file if `init` created it).
3. Restore anything it moved: each `.peaje-backup/<timestamp>/<path>` goes back to `<path>`. Then delete `.peaje-backup/`.
4. Remove the dependency: `npm uninstall @peaje/next` or `npm uninstall @peaje/proxy` (or the `pnpm remove` / `yarn remove` / `bun remove` equivalent).
5. Delete `PEAJE_ORIGIN_SECRET` from the hosting environment variables (or `wrangler secret delete PEAJE_ORIGIN_SECRET` on Cloudflare), then deploy.

## License

MIT
