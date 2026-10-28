# @peaje/next

Peaje for Next.js. Three pieces:

- `peajeProxy({ slug })` (from `@peaje/next/proxy`) is the middleware that answers HTTP 402 on your own domain for every priced route in your Peaje dashboard, including API routes you publish later. It reads the route list from your gateway at runtime, cached for a minute, so a new route needs no redeploy.
- `withPeaje(nextConfig, { slug })` adds the build-time rewrites for the fixed catalog paths (llms.txt, openapi.json, /developers, the MCP server, the `/r/` priced links).
- `<PeajeHead slug="..." />` renders the JSON-LD `WebAPI` block and the discovery `<link>` tags in your `<head>`.

Both are additive: your existing rewrites, config and head stay as they are.

## Install

```sh
npm install @peaje/next
```

Requires Next.js 14 or newer. `PeajeHead` needs the app router (it is an async server component).

## 1. Rewrites

```ts
// next.config.ts
import { withPeaje } from '@peaje/next'

const nextConfig = {
  // your config, including any existing rewrites()
}

export default withPeaje(nextConfig, { slug: 'cafe-andino' })
```

`withPeaje` prepends the Peaje rules to `rewrites().beforeFiles` and keeps what you had: an array becomes `afterFiles`, an object keeps its `beforeFiles`, `afterFiles` and `fallback`. It accepts sync or async `rewrites()` and a config written as a function `(phase, { defaultConfig }) => config`. Wrapping twice does not duplicate rules.

Options: `slug` (required, the one from your Peaje dashboard) and `gateway` (defaults to `https://api.usepeaje.com`, overridable with the `PEAJE_GATEWAY_URL` environment variable).

## 1b. Runtime proxy (priced API routes on your domain)

```ts
// proxy.ts (Next 16) or middleware.ts (Next 14/15), at the project root or in src/
import { peajeProxy } from '@peaje/next/proxy'

export default peajeProxy({ slug: 'cafe-andino' })

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Set `PEAJE_ORIGIN_SECRET` in your hosting environment variables (copy it from the Kit page of your Peaje dashboard). After an agent pays, the gateway forwards the request to your site with that secret; it is how the proxy tells the gateway apart from someone pretending to be it. Without it, priced API routes are not forwarded (they would be free to anyone who spoofs a header) and the proxy logs a warning; discovery files and `/r/` links work anyway. You can also pass it as `peajeProxy({ slug, secret })`.

The rewrites above are fixed at build time, so they cannot know about an API route you add to your dashboard tomorrow. `peajeProxy` fetches `/{slug}/kit/manifest.json` from the gateway, keeps it for 60 seconds, and rewrites any request that matches a priced route (`/api/forecast`, `/api/history/:city`, `/api/batch/*`) to the gateway, which answers 402 or, once paid, forwards to your origin. Catch-all patterns (`/*`, `/:id` at the root) are not forwarded from your domain: they would send the whole site to the gateway.

What the manifest can and cannot change on your domain (since 0.3.0):

- The fixed paths (`/llms.txt`, `/openapi.json`, `/mcp`, `/.well-known/*`, `/developers`, `/docs`, ...) and the `/r/` and `/checkout_sessions/` prefixes come only from the list bundled in this package. Paths the manifest adds are ignored.
- Priced API routes from the manifest are forwarded only under `apiPrefixes`, which you set in code. The default is `['/api/', '/v1/']`. A route the dashboard prices elsewhere (say `GET /weather/:city`) keeps charging at the gateway URL, and the proxy logs one warning naming it; to charge it on your domain, pass `peajeProxy({ slug, apiPrefixes: ['/api/', '/v1/', '/weather/'] })`.
- Never forwarded, whatever the manifest or `apiPrefixes` say: the root `/` and reserved app paths (`/login`, `/logout`, `/signin`, `/signup`, `/register`, `/auth`, `/oauth`, `/session`, `/account`, `/admin`, `/dashboard`, `/api/auth` for NextAuth, `/_next`, `/_vercel`, `/static`, `/assets`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`), and everything under them.

So a gateway bug or a compromised gateway cannot take over a page of your site. Upgrading from 0.2.x: if your priced routes live outside `/api/` and `/v1/`, add their prefix to `apiPrefixes` before you deploy 0.3.0.

Cookies: the requests the proxy forwards to the gateway leave out the `cookie` header, so your visitors' session cookies never leave your domain. `authorization` is forwarded (it carries the MPP credential). If the handler of a priced route reads a cookie, it no longer gets one through Peaje; agents do not send your site's cookies anyway. The build-time rewrites from `withPeaje` cannot drop headers; with `peajeProxy` in place (and its matcher covering those paths) it handles them first.

Bot visits (since 0.3.1): when a known AI bot (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Googlebot) reads a page your site serves itself, such as your home page or a blog post, the proxy tells the gateway in the background (`waitUntil`, 3 s timeout, never in the way of the page), so the read shows up in your agent visits. The gateway never sees those requests otherwise. It sends only the path, without the query string, and the bot's user agent: no IP, no cookies, and visits from people are never reported. Turn it off with `peajeProxy({ slug, reportBotVisits: false })`.

With your own middleware: `export default peajeProxy({ slug }, myMiddleware)`. Peaje runs first; when the request is not one of its routes, yours runs.

Options: `slug` (required), `gateway`, `secret` (default `process.env.PEAJE_ORIGIN_SECRET`), `apiPrefixes` (default `['/api/', '/v1/']`) and `reportBotVisits` (default `true`).

## 2. Head

```tsx
// app/layout.tsx
import { PeajeHead } from '@peaje/next/head'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <PeajeHead slug="cafe-andino" originHost="cafeandino.com" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

The offers in the JSON-LD come from your gateway (`/discovery/resources`) and are revalidated hourly. If the gateway is unreachable, the component renders the block without offers and never throws: a Peaje outage cannot break your build or your pages.

Props: `slug` (required), `gateway`, `originHost` and `name`. Pass `originHost="cafeandino.com"`: without it the component reads the request host through `next/headers`, which makes every page under the layout dynamic. `npx @peaje/cli@1 init` writes it for you.

## 3. Footer

Auditors look for documentation linked from the homepage, visibly. Add this to your footer or nav:

```html
<a href="/developers">API for agents</a>
```

## Verify

After the deploy is live:

```sh
npx @peaje/cli@1 verify cafe-andino --wait 600
```

## License

MIT
