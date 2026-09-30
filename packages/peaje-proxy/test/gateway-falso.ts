/**
 * Gateway de mentira: sirve el manifiesto y contesta 402 a todo lo demás bajo
 * `/{slug}/`, con un JSON que cuenta qué le llegó (método, path, query, body y
 * los headers que importan). `/{slug}/gzip` responde comprimido para probar
 * que el proxy no reenvía un content-encoding que ya no es cierto.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'

export const SLUG = 'cafe-andino'
export const SECRETO = 'a'.repeat(64)

export const MANIFIESTO = {
  version: 'test',
  base: '',
  rutas: ['/llms.txt', '/openapi.json', '/mcp'],
  prefijos: ['/r/'],
  patrones: [
    { method: 'GET', path: '/api/forecast' },
    { method: 'POST', path: '/api/batch/*' },
    { method: 'GET', path: '/gzip' },
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
  origin: string | null
}

export async function levantarGateway(): Promise<{ url: string; cerrar: () => Promise<void>; pedidos: string[] }> {
  const pedidos: string[] = []
  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://gw')
    pedidos.push(`${req.method} ${u.pathname}`)
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
        origin: (req.headers['x-peaje-origin'] as string | undefined) ?? null,
      }
      const json = Buffer.from(JSON.stringify(eco))
      res.statusCode = 402
      res.setHeader('content-type', 'application/json')
      res.setHeader('www-authenticate', 'Payment realm="test"')
      if (u.pathname === `/${SLUG}/gzip`) {
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
