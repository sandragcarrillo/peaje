# @peaje/proxy

Peaje for any server. It makes your own domain answer HTTP 402 (MPP, x402) for the priced API routes in your Peaje dashboard, and serves your agent catalog (`/llms.txt`, `/openapi.json`, `/mcp`, `/.well-known/*`) and `/r/` priced links from the same domain.

It reads the route list from your gateway at runtime (`/{slug}/kit/manifest.json`, cached for 60 seconds), so a route you publish tomorrow is charged without a redeploy. Everything else goes to your app untouched.

For Next.js use [`@peaje/next`](../peaje-next) instead. `npx @peaje/cli@1 init <slug>` installs either one for you.

## Install

```sh
npm install @peaje/proxy
```

Node 20 or newer, or any runtime with `fetch`, `Request` and `Response`.

## The secret

Set `PEAJE_ORIGIN_SECRET` in your hosting environment variables. Copy it from the Kit page of your Peaje dashboard.

After an agent pays, the gateway forwards the request to your site with that secret in the `x-peaje-origin` header, and only then does the proxy let it through to your handler. Without it the proxy cannot tell the gateway apart from someone faking the header, so priced API routes are not forwarded (they would be free) and you get one warning in the logs. Discovery files and `/r/` links work anyway.

You can also pass it as an option: `{ slug, secret }`.

## Express

```js
import express from 'express'
import { peajeExpress } from '@peaje/proxy/express'

const app = express()
app.use(peajeExpress({ slug: 'cafe-andino' }))   // first: before express.json() and your routes
app.use(express.json())

app.get('/api/forecast', (req, res) => res.json({ tempC: 18 }))
```

CommonJS: `const { peajeExpress } = require('@peaje/proxy/express')`. Works with Express 4 and 5 and plain Connect. Put it before body parsers: the body of a Peaje request is forwarded raw. If a parser already ran, it forwards `req.body` as JSON.

## Hono

```ts
import { Hono } from 'hono'
import { peajeHono } from '@peaje/proxy/hono'

const app = new Hono()
app.use(peajeHono({ slug: 'cafe-andino' }))

app.get('/api/forecast', (c) => c.json({ tempC: 18 }))
```

On Cloudflare Workers the secret is read from `c.env.PEAJE_ORIGIN_SECRET` (`wrangler secret put PEAJE_ORIGIN_SECRET`). On Node, Bun and Deno it comes from `process.env`.

## Vite (or any non-Next project) on Vercel

Vercel Routing Middleware runs before your static files, so a Vite SPA gets 402s on its own domain without a server. Create `middleware.ts` at the project root, next to `package.json`:

```ts
import peaje from '@peaje/proxy/vercel'

export default peaje({ slug: 'cafe-andino' })

export const config = {
  matcher: ['/((?!assets/|favicon.ico).*)'],
}
```

It answers with the same headers that `rewrite()` and `next()` from `@vercel/functions` produce, so there is nothing else to install: Vercel rewrites the request to the gateway itself (method, body and query intact), and your middleware never proxies bytes. With a middleware of your own: `peaje({ slug }, yourMiddleware)`; Peaje runs first and yours runs when the request is not Peaje's.

## Anything else (Astro, SvelteKit, Bun, Deno, Workers)

`peajeFetch` takes a `Request` and returns the gateway's `Response`, or `null` when the request is not Peaje's:

```ts
import { peajeFetch } from '@peaje/proxy'

const peaje = peajeFetch({ slug: 'cafe-andino' })

// Astro (SSR), src/middleware.ts
export const onRequest = async (context, next) => (await peaje(context.request)) ?? next()

// SvelteKit, src/hooks.server.ts
export const handle = async ({ event, resolve }) => (await peaje(event.request)) ?? resolve(event)

// Bun / Deno / Workers
export default { fetch: async (req: Request) => (await peaje(req)) ?? app(req) }
```

## What gets forwarded

- The catalog paths: `/llms.txt`, `/openapi.json`, `/mcp`, `/.well-known/*` Peaje files, `/developers`, `/docs` and the rest of the kit list.
- `/r/*` priced links and `/checkout_sessions/*`.
- Your priced API routes from the dashboard (`GET /api/forecast`, `/api/history/:city`, `/api/batch/*`), matching the method. Catch-alls at the root (`/*`, `/:id`) are never forwarded from your domain: they would send the whole site to the gateway.

The forwarded request keeps method, body and query, and carries `x-forwarded-host` and `x-forwarded-proto` so the 402 challenge names your domain (strict x402 clients abort when it does not). If the gateway is unreachable, the catalog paths are still forwarded from a built-in list; priced API routes resume when the manifest loads.

## Options

| Option | Default |
|---|---|
| `slug` | required, the business slug from your dashboard |
| `secret` | `process.env.PEAJE_ORIGIN_SECRET` |
| `gateway` | `process.env.PEAJE_GATEWAY_URL` or `https://peaje-gateway.up.railway.app` |

## License

MIT
