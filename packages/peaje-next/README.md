# @peaje/next

Peaje for Next.js. Two pieces:

- `withPeaje(nextConfig, { slug })` adds the proxy rewrites that make your domain serve the Peaje catalog, the MCP server, the OpenAPI spec and the priced links (HTTP 402) that your gateway already publishes.
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

Options: `slug` (required, the one from your Peaje dashboard) and `gateway` (defaults to `https://peaje-gateway.up.railway.app`, overridable with the `PEAJE_GATEWAY_URL` environment variable).

If you have a `middleware.ts` or `proxy.ts` with a `matcher`, exclude `mcp`, `r/`, `discovery/`, `checkout_sessions`, `agentic_commerce/` and `docs` from it: middleware runs before rewrites.

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
