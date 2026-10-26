/** Tipos del CLI. Los del kit vienen de shared para que nunca diverjan del gateway. */
import type { Host, Kit } from '@peaje/shared'
import type { Colision } from './colisiones'

export type { Host, Kit }

export type Stack = 'next' | 'nuxt' | 'astro' | 'sveltekit' | 'remix' | 'react-router' | 'hono' | 'express' | 'vite' | 'static' | 'unknown'

export type Gestor = 'pnpm' | 'yarn' | 'npm' | 'bun'

export type Deteccion = {
  /** Directorio efectivo del proyecto (puede ser el único candidato de un monorepo). */
  dir: string
  stack: Stack
  host: Host | null
  /** Solo Next: app router, pages router, o nada detectable. */
  router: 'app' | 'pages' | null
  /** Rutas relativas a `dir`. */
  nextConfig: string | null
  layout: string | null
  /**
   * El middleware que ya existe, si hay. Next: `proxy.ts` (16) o `middleware.ts`.
   * Vite en Vercel: la Routing Middleware de la raíz (`middleware.ts`/`.js`).
   */
  middleware: string | null
  /**
   * Solo Express y Hono: el archivo de entrada del servidor cuando no hay duda
   * (`main` o el script `start` apuntan a un único archivo con un solo
   * `express()` / `new Hono()`). Null: la línea se agrega a mano.
   */
  servidor: string | null
  /** Solo Next: versión mayor declarada en package.json (null si no se pudo leer). */
  nextMajor: number | null
  gestor: Gestor
  /** Paquetes con framework encontrados en un monorepo. Más de uno: hay que elegir con --dir. */
  candidatos: string[]
}

export type Accion =
  | { tipo: 'write'; path: string; content: string; motivo: string }
  | { tipo: 'edit'; path: string; content: string; motivo: string }
  | { tipo: 'move'; desde: string; hasta: string }
  | { tipo: 'skip'; path: string; motivo: string }

export type Plan = {
  acciones: Accion[]
  manual: string[]
  next: string[]
  /** Páginas o handlers propios del sitio que las reglas de Peaje van a tapar. */
  colisiones?: Colision[]
}

export type { Colision }

/** Lo que imprime `--json`: un único objeto, nada más en stdout. */
export type Resultado = {
  ok: boolean
  /** true en `plan` (y cuando `init` no pudo confirmar): no se escribió nada. */
  dryRun: boolean
  stack: Stack
  host: Host | 'unknown'
  /** Lo que se escribió. En dry-run va vacío: lo que se escribiría está en `wouldWrite`. */
  written: string[]
  /** Lo que se movió a `.peaje-backup/`. En dry-run va vacío: ver `wouldMove`. */
  moved: string[]
  /** Solo en dry-run: cada archivo que se crearía o editaría. */
  wouldWrite?: string[]
  /** Solo en dry-run: cada copia que se movería a `.peaje-backup/`. */
  wouldMove?: string[]
  /** Páginas propias del sitio que Peaje reemplaza en el dominio, con el aviso para el dueño. */
  collisions: { path: string; file: string; kind: 'page' | 'route'; message: string }[]
  manual: string[]
  next: string[]
  /** Solo en dry-run: lo que se habría dejado como estaba y por qué. */
  skipped?: { path: string; motivo: string }[]
  error?: string
}

/** Códigos de salida: 0 ok, 1 error, 2 falta confirmación, 3 stack no reconocido. */
export class ErrorCli extends Error {
  constructor(
    message: string,
    public readonly codigo: 1 | 2 | 3 = 1,
  ) {
    super(message)
  }
}
