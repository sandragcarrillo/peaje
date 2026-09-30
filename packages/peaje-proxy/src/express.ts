/**
 * `@peaje/proxy/express`: middleware de Express (4 y 5) o Connect.
 *
 *   import { peajeExpress } from '@peaje/proxy/express'
 *   app.use(peajeExpress({ slug: 'mi-negocio' }))
 *
 * Va antes de los body parsers (`express.json()`) y de las rutas: el body de
 * una request de Peaje se reenvía crudo al gateway, y el de las demás no se
 * toca. Si igual corre después de un parser, reenvía `req.body` serializado.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { crearPeaje, type OpcionesPeaje } from './index'

export type { OpcionesPeaje } from './index'

type Req = IncomingMessage & { originalUrl?: string; body?: unknown; protocol?: string }
type Next = (err?: unknown) => void

function headersDe(req: IncomingMessage): Headers {
  const h = new Headers()
  for (const [clave, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue
    if (Array.isArray(valor)) for (const v of valor) h.append(clave, v)
    else h.set(clave, valor)
  }
  return h
}

function urlDe(req: Req): URL {
  const cifrado = (req.socket as { encrypted?: boolean } | undefined)?.encrypted
  const proto = req.protocol ?? (cifrado ? 'https' : 'http')
  const host = req.headers.host ?? 'localhost'
  return new URL(req.originalUrl ?? req.url ?? '/', `${proto}://${host}`)
}

async function bodyDe(req: Req): Promise<BodyInit | null> {
  // Un parser ya consumió el stream: lo que queda es `req.body`.
  // (`complete` no sirve: es true con el body todavía en el buffer sin leer.)
  if (req.readableEnded || (req as { _body?: boolean })._body) {
    const b = req.body
    if (b === undefined || b === null) return null
    if (typeof b === 'string' || b instanceof Uint8Array) return b as BodyInit
    if (typeof b === 'object' && Object.keys(b).length === 0) return null
    return JSON.stringify(b)
  }
  const partes: Buffer[] = []
  for await (const parte of req) partes.push(typeof parte === 'string' ? Buffer.from(parte) : (parte as Buffer))
  return partes.length > 0 ? Buffer.concat(partes) : null
}

async function enviar(res: ServerResponse, respuesta: Response): Promise<void> {
  res.statusCode = respuesta.status
  if (respuesta.statusText) res.statusMessage = respuesta.statusText
  const cookies = respuesta.headers.getSetCookie?.() ?? []
  respuesta.headers.forEach((valor, clave) => {
    if (clave === 'set-cookie') return
    res.setHeader(clave, valor)
  })
  if (cookies.length > 0) res.setHeader('set-cookie', cookies)
  if (!respuesta.body) {
    res.end()
    return
  }
  await new Promise<void>((resolve, reject) => {
    const cuerpo = Readable.fromWeb(respuesta.body as unknown as NodeReadableStream)
    cuerpo.on('error', reject)
    res.on('finish', resolve)
    res.on('close', resolve)
    cuerpo.pipe(res)
  })
}

export type MiddlewareExpress = (req: IncomingMessage, res: ServerResponse, next: Next) => void

export function peajeExpress(opciones: OpcionesPeaje): MiddlewareExpress {
  const peaje = crearPeaje(opciones)
  return (req, res, next) => {
    const r = req as Req
    const entrada = { method: (r.method ?? 'GET').toUpperCase(), url: urlDe(r), headers: headersDe(r) }
    peaje
      .decidir(entrada)
      .then(async (destino) => {
        if (!destino) return next()
        const body = entrada.method === 'GET' || entrada.method === 'HEAD' ? null : await bodyDe(r)
        await enviar(res, await peaje.reenviar(destino, { ...entrada, body }))
      })
      .catch((e: unknown) => {
        if (res.headersSent) {
          res.destroy(e instanceof Error ? e : undefined)
          return
        }
        next(e)
      })
  }
}

export default peajeExpress
