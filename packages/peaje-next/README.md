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

With your own middleware: `export default peajeProxy({ slug }, myMiddleware)`. Peaje runs first; when the request is not one of its routes, yours runs.

## 2. Head

```tsx
// app/layout.tsx
import { PeajeHead } from '@peaje/next/head'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <PeajeHead slug="cafe-andino" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

The offers in the JSON-LD come from your gateway (`/discovery/resources`) and are revalidated hourly. If the gateway is unreachable, the component renders the block without offers and never throws: a Peaje outage cannot break your build or your pages.

Props: `slug` (required), `gateway`, `originHost` and `name`. Without `originHost` the component reads the request host through `next/headers`, which makes the layout dynamic; pass `originHost="cafeandino.com"` to keep static rendering.

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
