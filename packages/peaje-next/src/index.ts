/**
 * `withPeaje(nextConfig, { slug })`: antepone las reglas del proxy de Peaje a
 * `rewrites().beforeFiles` y conserva lo que ya había. Es el paso que hace que
 * el catálogo, el MCP y los links con precio respondan en el dominio del
 * negocio, sin copiar la config a mano.
 */
import { reglasNext } from '@peaje/shared'

export const GATEWAY_POR_DEFECTO = 'https://peaje-gateway.up.railway.app'

export type OpcionesPeaje = {
  /** El slug del negocio en Peaje (el mismo del dashboard). */
  slug: string
  /** URL pública del gateway. Por defecto la de producción, o `PEAJE_GATEWAY_URL`. */
  gateway?: string
}

/**
 * Tipos mínimos y locales en vez de importar `NextConfig`: así el paquete
 * compila y se usa sin `next` instalado en tiempo de tipos (peer opcional) y
 * acepta cualquier versión desde 14.
 */
export type ReglaRewrite = {
  source: string
  destination: string
  basePath?: false
  locale?: false
  has?: unknown[]
  missing?: unknown[]
}

export type RewritesObjeto = {
  beforeFiles?: ReglaRewrite[]
  afterFiles?: ReglaRewrite[]
  fallback?: ReglaRewrite[]
}

export type ResultadoRewrites = ReglaRewrite[] | RewritesObjeto

export type ConfigConRewrites = {
  rewrites?: () => ResultadoRewrites | Promise<ResultadoRewrites>
  [clave: string]: unknown
}

export type ConfigOFuncion<C extends ConfigConRewrites = ConfigConRewrites> =
  | C
  | ((phase: string, contexto: { defaultConfig: unknown }) => C | Promise<C>)

/** Base `${gateway}/${slug}` sin barra final, con el env como override. */
export function baseDe({ slug, gateway }: OpcionesPeaje): string {
  const raiz = (gateway ?? process.env.PEAJE_GATEWAY_URL ?? GATEWAY_POR_DEFECTO).replace(/\/+$/, '')
  return `${raiz}/${slug}`
}

/**
 * Fusiona las reglas de Peaje con lo que devolvía el `rewrites()` original.
 * Un array pasa a `afterFiles`: es lo que Next hace internamente con el array,
 * y así las nuestras siguen ganando en `beforeFiles`.
 */
export function fusionarRewrites(previo: ResultadoRewrites | undefined, reglas: ReglaRewrite[]): RewritesObjeto {
  const objeto: RewritesObjeto = Array.isArray(previo) ? { afterFiles: previo } : { ...(previo ?? {}) }
  const antes = objeto.beforeFiles ?? []
  // Idempotencia: si alguien ya puso reglas al gateway (a mano o por doble
  // envoltura), no las duplicamos.
  const destinos = new Set(antes.map((r) => r.destination))
  const nuevas = reglas.filter((r) => !destinos.has(r.destination))
  return { ...objeto, beforeFiles: [...nuevas, ...antes] }
}

function envolverConfig<C extends ConfigConRewrites>(config: C, reglas: ReglaRewrite[]): C {
  const original = config.rewrites
  return {
    ...config,
    async rewrites() {
      const previo = original ? await original.call(config) : undefined
      return fusionarRewrites(previo, reglas)
    },
  }
}

/**
 * Acepta la config como objeto o como función `(phase, { defaultConfig })`,
 * y un `rewrites()` sync o async que devuelva array u objeto.
 */
export function withPeaje<C extends ConfigConRewrites>(nextConfig: ConfigOFuncion<C>, opciones: OpcionesPeaje): ConfigOFuncion<C> {
  if (!opciones?.slug) throw new Error('withPeaje: `slug` is required (the business slug from your Peaje dashboard).')
  const reglas = reglasNext(baseDe(opciones)) as ReglaRewrite[]
  if (typeof nextConfig === 'function') {
    return async (phase, contexto) => envolverConfig(await nextConfig(phase, contexto), reglas)
  }
  return envolverConfig(nextConfig ?? ({} as C), reglas)
}

export default withPeaje
