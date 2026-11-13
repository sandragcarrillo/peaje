/**
 * Gateway de mentira: sirve el manifiesto y contesta 402 a todo lo demás bajo
 * `/{slug}/`, con un JSON que cuenta qué le llegó (método, path, query, body y
 * los headers que importan). `/{slug}/api/gzip` responde comprimido para probar
 * que el proxy no reenvía un content-encoding que ya no es cierto. `/{slug}/mcp`
 * contesta un stream SSE en dos partes. Toda respuesta trae un x-peaje-kit
 * falso (`KIT_DEL_GATEWAY`): el proxy tiene que pisarlo con el suyo.
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'

export const SLUG = 'cafe-andino'
export const SECRETO = 'a'.repeat(64)

/** Lo que tiene que llegar en x-peaje-kit: nombre y versión del package.json en disco. */
export const KIT = (() => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string }
  return `${pkg.name}@${pkg.version}`
})()

/** El x-peaje-kit que manda este gateway en sus respuestas, para probar que no se cuela. */
export const KIT_DEL_GATEWAY = '@peaje/falso@9.9.9'

export const MANIFIESTO = {
  version: 'test',
  base: '',
  // `/login` de más: desde 0.2.0 las fijas salen del paquete y el manifiesto no las amplía.
  rutas: ['/llms.txt', '/openapi.json', '/mcp', '/login'],
  prefijos: ['/r/'],
  patrones: [
    { method: 'GET', path: '/api/forecast' },
    { method: 'POST', path: '/api/batch/*' },
    { method: 'GET', path: '/api/gzip' },
    // Fuera de /api/ y /v1/: desde 0.2.0 no se reenvía aunque el manifiesto la traiga.
    { method: 'GET', path: '/weather/:city' },
    // Demasiado ancho: el proxy nunca lo reenvía desde el sitio.
    { method: 'GET', path: '/*' },
  ],
}

export type Eco = {
  method: string
  path: string
  search: string
  body: string
  forwardedHost: string | null
  forwardedProto: string | null
  peajeHost: string | null
  origin: string | null
  cookie: string | null
  authorization: string | null
  kit: string | null
}

export async function levantarGateway(): Promise<{ url: string; cerrar: () => Promise<void>; pedidos: string[] }> {
  const pedidos: string[] = []
  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://gw')
    pedidos.push(`${req.method} ${u.pathname}`)
    res.setHeader('x-peaje-kit', KIT_DEL_GATEWAY)
    if (u.pathname === `/${SLUG}/kit/manifest.json`) {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(MANIFIESTO))
      return
    }
    const partes: Buffer[] = []
    req.on('data', (p: Buffer) => partes.push(p))
    req.on('end', () => {
      const eco: Eco = {
        method: req.method ?? '',
        path: u.pathname,
        search: u.search,
        body: Buffer.concat(partes).toString('utf8'),
        forwardedHost: (req.headers['x-forwarded-host'] as string | undefined) ?? null,
        forwardedProto: (req.headers['x-forwarded-proto'] as string | undefined) ?? null,
        peajeHost: (req.headers['x-peaje-forwarded-host'] as string | undefined) ?? null,
        origin: (req.headers['x-peaje-origin'] as string | undefined) ?? null,
        cookie: (req.headers.cookie as string | undefined) ?? null,
        authorization: (req.headers.authorization as string | undefined) ?? null,
        kit: (req.headers['x-peaje-kit'] as string | undefined) ?? null,
      }
      if (u.pathname === `/${SLUG}/mcp`) {
        // Un stream: la primera parte sale antes de que exista la segunda.
        res.statusCode = 200
        res.setHeader('content-type', 'text/event-stream')
        res.write('data: uno\n\n')
        setTimeout(() => res.end(`data: ${JSON.stringify(eco)}\n\n`), 30)
        return
      }
      const json = Buffer.from(JSON.stringify(eco))
      res.statusCode = 402
      res.setHeader('content-type', 'application/json')
      res.setHeader('www-authenticate', 'Payment realm="test"')
      if (u.pathname === `/${SLUG}/api/gzip`) {
        res.setHeader('content-encoding', 'gzip')
        res.end(gzipSync(json))
        return
      }
      res.end(json)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    pedidos,
    cerrar: () => new Promise<void>((r) => server.close(() => r())),
  }
}
