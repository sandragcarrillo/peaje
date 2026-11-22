import Link from 'next/link'
import { asistentesMedidos } from '@peaje/shared/asistentes'
import { articulos } from '@/lib/blog'
import { dictFor, type Locale } from '@/lib/i18n/dict'
import { CONTACTO } from '@/lib/legal'
import { LogoMark } from './logo'

/**
 * Pie del sitio, con el sistema de Revnu y Theo (estudio del 22 nov 2026):
 * isla de tinta a sangre, bloque de marca a la izquierda, columnas cortas a
 * la derecha y filas de ancho completo debajo con el contenido del sitio
 * (dónde aparecer, por tipo de negocio, guías, agentes). Paddle exige
 * términos, privacidad, reembolsos y precios enlazados desde todo el sitio.
 *
 * Las guías del blog se nombran por su slug en español y se resuelven al
 * idioma de quien mira con `traduccion`. Una guía que no existe (o no tiene
 * par en ese idioma) no se pinta: el pie nunca enlaza a una página vacía.
 * Los posts de cobros a agentes quedan fuera a propósito (cobros escondidos).
 */

type Enlace = {
  href: string
  texto: string
  /** Fuera del router de Next: el portal /developers lo sirve el gateway y el contacto es un mailto. */
  externo?: boolean
}
type Columna = { titulo: string; enlaces: Enlace[] }
type Fila = { titulo: string; enlaces: Enlace[] }

/** Una guía del blog: slug en español y el texto corto en cada idioma. */
type Guia = { es: string; texto: { es: string; en: string } }
/** Una página propia con ruta por idioma. */
type Pagina = { ruta: { es: string; en: string }; texto: { es: string; en: string } }
type Item = Guia | Pagina

const ENLACE = 'text-text/85 transition-colors hover:text-text focus-visible:text-text'

const g = (es: string, textoEs: string, textoEn: string): Guia => ({ es, texto: { es: textoEs, en: textoEn } })
const p = (rutaEs: string, rutaEn: string, textoEs: string, textoEn: string): Pagina => ({
  ruta: { es: rutaEs, en: rutaEn },
  texto: { es: textoEs, en: textoEn },
})

const APARECER: Item[] = [
  g('como-hago-que-chatgpt-recomiende-mi-sitio-web', 'ChatGPT', 'ChatGPT'),
  g('como-hago-que-claude-cite-mi-sitio-web', 'Claude', 'Claude'),
  g('como-aparezco-en-las-respuestas-de-perplexity', 'Perplexity', 'Perplexity'),
  g('como-aparezco-en-las-respuestas-de-copilot-de-microsoft', 'Copilot de Microsoft', 'Microsoft Copilot'),
  g('como-aparezco-en-los-ai-overviews-de-google', 'AI Overviews de Google', 'Google AI Overviews'),
  g('como-aparezco-en-los-resultados-de-busqueda-con-ia', 'Búsqueda con IA', 'AI search results'),
  g('cuanto-tarda-bing-en-indexar-mi-web-para-que-chatgpt-me-encuentre', 'Bing (la base de ChatGPT)', 'Bing (what ChatGPT reads)'),
  g('como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio', '¿Te recomienda ChatGPT?', 'Does ChatGPT recommend you?'),
]

const PARA: Item[] = [
  p('/para/agencias', '/for/agencies', 'Agencias', 'Agencies'),
  p('/para/saas', '/for/saas', 'SaaS', 'SaaS'),
  p('/para/tiendas-online', '/for/online-stores', 'Tiendas online', 'Online stores'),
  p('/para/negocios-locales', '/for/local-businesses', 'Negocios locales', 'Local businesses'),
  p('/para', '/for', 'Todos los negocios', 'All businesses'),
]

const GUIAS: Item[] = [
  g('que-es-geo-y-en-que-se-diferencia-del-seo', 'Qué es GEO', 'What GEO is'),
  g('mi-web-funciona-pero-chatgpt-no-me-nombra-por-que', 'Por qué ChatGPT no te nombra', 'Why ChatGPT skips you'),
  g('por-que-chatgpt-da-informacion-equivocada-de-mi-negocio-y-como-la-corrijo', 'Corregir datos equivocados', 'Fix wrong answers about you'),
  g('que-formato-de-pagina-citan-mas-chatgpt-y-claude-guia-documentacion-o-comparativa', 'Qué páginas cita la IA', 'Pages AI cites most'),
  g('que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar', 'Bots de IA en tu web', 'AI bots on your site'),
  g('como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web', 'llms.txt y JSON-LD', 'llms.txt and JSON-LD'),
  g('chatgpt-y-claude-leen-de-verdad-el-llms-txt', '¿Leen el llms.txt?', 'Do they read llms.txt?'),
  g('como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics', 'Tráfico de ChatGPT en Analytics', 'ChatGPT traffic in Analytics'),
  g('cada-cuanto-debo-medir-si-chatgpt-y-claude-citan-mi-negocio', 'Cada cuánto medir', 'How often to measure'),
  g('cuanto-tarda-chatgpt-en-citarme-despues-de-arreglar-mi-web', 'Cuánto tarda en citarte', 'How long until it cites you'),
  g('que-20-preguntas-de-clientes-debo-seguir-en-chatgpt-y-claude', 'Qué preguntas seguir', 'Which questions to track'),
  g('debo-tener-mi-web-en-ingles-y-espanol-para-que-la-ia-me-cite', 'Web en inglés y español', 'English and Spanish site'),
  g('como-paso-los-arreglos-de-peaje-a-mi-desarrollador-sin-saber-codigo', 'Pasarle arreglos a tu desarrollador', 'Hand fixes to your developer'),
  g('como-paso-las-tareas-de-peaje-a-claude-code-o-cursor-por-mcp', 'Tareas a Claude Code o Cursor', 'Tasks to Claude Code or Cursor'),
  g('cuanto-cuesta-que-chatgpt-recomiende-mi-negocio-al-mes', 'Cuánto cuesta aparecer', 'What showing up costs'),
]

const AGENTES: Item[] = [
  g('que-es-mcp-y-en-que-se-diferencia-de-una-api', 'Qué es MCP', 'What MCP is'),
  g('como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar', 'Un MCP para tu tienda', 'An MCP server for your store'),
  g('como-publico-mi-servidor-mcp-en-el-registro-oficial-de-mcp', 'Publicar en el registro de MCP', 'List it in the MCP registry'),
  g('que-es-una-agent-card-y-para-que-sirve-en-mi-sitio', 'Agent card', 'Agent card'),
  g('como-encuentran-los-agentes-de-ia-mi-api', 'Cómo te encuentran los agentes', 'How agents find your API'),
  g('para-que-sirve-el-openapi-json-y-que-agentes-de-ia-lo-leen', 'openapi.json', 'openapi.json'),
  g('por-que-un-agente-de-ia-se-atasca-en-mi-formulario-de-reserva', 'Agentes y formularios de reserva', 'Agents and booking forms'),
  g('acp-ucp-y-ap2-que-protocolo-de-compra-con-agentes-de-ia-necesita-mi-tienda', 'ACP, UCP y AP2', 'ACP, UCP and AP2'),
]

type Resolver = (item: Item) => Enlace | null

/** Arma el resolvedor de guías del blog para un idioma, a partir de los artículos publicables. */
async function resolvedor(locale: Locale): Promise<Resolver> {
  const lista = await articulos().catch(() => [])
  const porSlug = new Map(lista.map((a) => [a.slug, a]))
  return (item) => {
    if ('ruta' in item) return { href: item.ruta[locale], texto: item.texto[locale] }
    const es = porSlug.get(item.es)
    if (!es) return null
    const slug = locale === 'es' ? es.slug : es.traduccion
    if (!slug || !porSlug.has(slug)) return null
    return { href: `/blog/${slug}`, texto: item.texto[locale] }
  }
}

const resolver = (items: Item[], r: Resolver) => items.map(r).filter((e): e is Enlace => e !== null)

function columnas(locale: Locale, r: Resolver): Columna[] {
  const t = dictFor(locale).legal
  const es = locale === 'es'
  const comparar = es ? '/comparar' : '/compare'
  return [
    {
      titulo: t.pieProducto,
      enlaces: [
        { href: '/radar', texto: t.pieRadar },
        { href: '/precios', texto: t.piePrecios },
        { href: '/#como-funciona', texto: t.pieComo },
        ...resolver([g('como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando', 'Kit', 'Kit')], r),
        { href: '/docs/mcp', texto: t.pieMcp },
        { href: '/developers', texto: t.pieDevelopers, externo: true },
      ],
    },
    {
      titulo: t.pieComparar,
      enlaces: [
        { href: `${comparar}/peaje-vs-peec`, texto: t.pieVsPeec },
        { href: `${comparar}/peaje-vs-otterly`, texto: t.pieVsOtterly },
        { href: `${comparar}/peaje-vs-profound`, texto: t.pieVsProfound },
        { href: `${comparar}/peaje-vs-semrush`, texto: t.pieVsSemrush },
        { href: es ? '/comparar/mejores-herramientas-aeo-2026' : '/compare/best-aeo-tools-2026', texto: t.pieMejoresAeo },
        { href: es ? '/comparar/alternativas-a-peec' : '/compare/peec-alternatives', texto: es ? 'Alternativas a Peec' : 'Peec alternatives' },
        { href: es ? '/comparar/alternativas-a-otterly' : '/compare/otterly-alternatives', texto: es ? 'Alternativas a Otterly' : 'Otterly alternatives' },
        { href: es ? '/comparar/alternativas-a-profound' : '/compare/profound-alternatives', texto: es ? 'Alternativas a Profound' : 'Profound alternatives' },
        { href: comparar, texto: es ? 'Todas las comparativas' : 'All comparisons' },
      ],
    },
    {
      titulo: t.pieRecursos,
      enlaces: [
        { href: '/blog', texto: t.pieBlog },
        { href: es ? '/preguntas' : '/faq', texto: t.pieFaq },
        ...resolver(
          [
            g('que-incluye-el-plan-gratis-de-peaje-y-que-no', 'El plan gratis', 'The free plan'),
            g('cuanto-cuesta-peaje-y-que-incluyen-los-500-creditos-al-mes', 'Créditos y precio', 'Credits and price'),
            g('que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion', 'Qué mide el Radar', 'What the Radar measures'),
            g('herramientas-de-aeo-en-espanol-cuales-existen-y-cuanto-cuestan', 'Herramientas AEO en español', 'AEO tools in Spanish'),
          ],
          r,
        ),
      ],
    },
    {
      titulo: t.pieLegal,
      enlaces: [
        { href: '/terms', texto: t.pieTerminos },
        { href: '/privacy', texto: t.piePrivacidad },
        { href: '/reembolsos', texto: t.pieReembolsos },
        { href: `mailto:${CONTACTO}`, texto: t.pieContacto, externo: true },
      ],
    },
  ]
}

function filas(locale: Locale, r: Resolver): Fila[] {
  const es = locale === 'es'
  return [
    { titulo: es ? 'Aparecer en' : 'Show up in', enlaces: resolver(APARECER, r) },
    { titulo: dictFor(locale).legal.piePara, enlaces: resolver(PARA, r) },
    { titulo: es ? 'Guías' : 'Guides', enlaces: resolver(GUIAS, r) },
    { titulo: es ? 'Agentes de IA' : 'AI agents', enlaces: resolver(AGENTES, r) },
  ].filter((f) => f.enlaces.length > 0)
}

function Vinculo({ e }: { e: Enlace }) {
  return e.externo ? (
    <a href={e.href} className={ENLACE}>
      {e.texto}
    </a>
  ) : (
    <Link href={e.href} className={ENLACE}>
      {e.texto}
    </Link>
  )
}

export async function Pie({ locale }: { locale: Locale }) {
  const t = dictFor(locale).legal
  const r = await resolvedor(locale)
  const cols = columnas(locale, r)
  const extra = filas(locale, r)

  return (
    <footer className="isla-tinta border-t border-border bg-bg text-text">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-16">
          <div className="min-w-0">
            <Link href="/" aria-label={t.pieInicio} className="inline-flex items-end gap-2">
              <LogoMark className="h-10 w-10 text-accent" />
              <span className="font-mono text-3xl leading-none tracking-tight text-text">peaje</span>
            </Link>
            <p className="mt-7 text-xl font-semibold text-text">{t.pieFrase}</p>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-muted">{t.pieQueHace(asistentesMedidos(locale))}</p>
          </div>

          <nav aria-label={t.pieNav} className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-4">
            {cols.map((c) => (
              <div key={c.titulo} className="min-w-0">
                <h2 className="text-[15px] font-semibold text-accent">{c.titulo}</h2>
                <ul className="mt-5 flex flex-col gap-3 text-base leading-snug break-words">
                  {c.enlaces.map((e) => (
                    <li key={e.href}>
                      <Vinculo e={e} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {extra.map((f) => (
          <div
            key={f.titulo}
            className="mt-14 grid gap-5 border-t border-border pt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-16"
          >
            <h2 className="text-[15px] font-semibold text-accent">{f.titulo}</h2>
            <ul className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 text-base leading-snug break-words sm:grid-cols-4">
              {f.enlaces.map((e) => (
                <li key={e.href} className="min-w-0">
                  <Vinculo e={e} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted">
          <p>{t.pieDerechos(2026)}</p>
        </div>
      </div>
    </footer>
  )
}
