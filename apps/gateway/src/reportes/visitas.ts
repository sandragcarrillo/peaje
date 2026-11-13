import type { ClaseVisita, ReportFrequency, Tenant, VisitStats } from '@peaje/db'
import type { Chequeo, Motivo } from '@peaje/shared'
import { store } from '../store.js'
import { largoNominal } from './agenda.js'

/**
 * El reporte programado de visitas de agentes: qué pasó desde el último
 * envío (o en el largo de la frecuencia, la primera vez), quién vino, pagos,
 * lo más visitado y el cambio contra el período anterior del mismo largo.
 * Texto corto con el markdown mínimo que entienden los canales (**negrita**,
 * viñetas "- " y `código`). Las rutas van como código: Telegram convierte en
 * comando tocable un "/mcp" suelto. Solo números que salen del store; con
 * cero visitas, una cosa concreta para hacer.
 */

type Idioma = 'es' | 'en'

const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')
export const urlVisitas = (slug: string) => `${DASHBOARD}/t/${slug}/agentes-visitas`

/**
 * "Quién vino": los grupos de `grupoDe` (@peaje/db), el mismo clasificador del
 * panel. Los asistentes principales, los que pagan y cada clase tienen su
 * línea; las demás marcas, la suya mientras haya lugar (MAX_LINEAS) y si no
 * van juntas en "otros rastreadores de IA y buscadores". Los escáneres y bots
 * sin marca ni clase, al final.
 */
const PRINCIPALES = new Set(['marca:ChatGPT', 'marca:Claude', 'marca:Perplexity', 'marca:Google', 'clase:openai-entrenamiento', 'clase:pago'])
const MAX_LINEAS = 8
// Cuántos nombres van entre paréntesis en una línea de clase.
const NOMBRES = 3

const T = {
  es: {
    titulo: (n: string) => `**${n}: visitas de agentes**`,
    nominal: { daily: 'en las últimas 24 horas', weekly: 'en los últimos 7 días', monthly: 'en el último mes' } as Record<ReportFrequency, string>,
    anterior: { daily: 'el día anterior', weekly: 'la semana anterior', monthly: 'el mes anterior' } as Record<ReportFrequency, string>,
    anteriorLibre: 'el período anterior del mismo largo',
    desde: (f: string) => `desde el ${f}`,
    visitas: (n: string) => `${n} ${n === '1' ? 'visita' : 'visitas'}`,
    mas: (n: string, ant: string, pct: string) => `${n} más que ${ant} (+${pct}%)`,
    menos: (n: string, ant: string, pct: string) => `${n} menos que ${ant} (-${pct}%)`,
    igual: (ant: string) => `igual que ${ant}`,
    antesCero: (ant: string) => `${ant} no hubo ninguna`,
    quien: 'Quién vino:',
    clases: {
      'openai-entrenamiento': 'Rastreador de entrenamiento de OpenAI',
      pago: 'Agentes que pagan',
      directorios: 'Directorios de agentes y MCP',
      mcp: 'Clientes MCP',
      sdk: 'SDKs de agentes y x402',
      scripts: 'Scripts y herramientas',
      previas: 'Enlaces compartidos en redes y chats',
      seo: 'Herramientas de SEO',
      otros: 'Escáneres y otros bots',
    } as Record<ClaseVisita, string>,
    otrasMarcas: 'Otros rastreadores de IA y buscadores',
    pagos: (n: string, monto: string) => `Pagos: ${n} ${n === '1' ? 'pedido pagado' : 'pedidos pagados'}, ${monto}.`,
    top: 'Lo más visitado:',
    cero: (periodo: string) => `No hubo visitas de agentes ${periodo}.`,
    cosa: 'Lo primero que haría:',
    boton: 'Ver las visitas',
  },
  en: {
    titulo: (n: string) => `**${n}: agent visits**`,
    nominal: { daily: 'in the last 24 hours', weekly: 'in the last 7 days', monthly: 'in the last month' } as Record<ReportFrequency, string>,
    anterior: { daily: 'the day before', weekly: 'the week before', monthly: 'the month before' } as Record<ReportFrequency, string>,
    anteriorLibre: 'the previous period of the same length',
    desde: (f: string) => `since ${f}`,
    visitas: (n: string) => `${n} ${n === '1' ? 'visit' : 'visits'}`,
    mas: (n: string, ant: string, pct: string) => `${n} more than ${ant} (+${pct}%)`,
    menos: (n: string, ant: string, pct: string) => `${n} fewer than ${ant} (-${pct}%)`,
    igual: (ant: string) => `the same as ${ant}`,
    antesCero: (ant: string) => `none ${ant}`,
    quien: 'Who came:',
    clases: {
      'openai-entrenamiento': 'OpenAI training crawler',
      pago: 'Paying agents',
      directorios: 'Agent and MCP directories',
      mcp: 'MCP clients',
      sdk: 'Agent and x402 SDKs',
      scripts: 'Scripts and tools',
      previas: 'Links shared on social and chat apps',
      seo: 'SEO tools',
      otros: 'Scanners and other bots',
    } as Record<ClaseVisita, string>,
    otrasMarcas: 'Other AI crawlers and search engines',
    pagos: (n: string, monto: string) => `Payments: ${n} paid ${n === '1' ? 'request' : 'requests'}, ${monto}.`,
    top: 'Most visited:',
    cero: (periodo: string) => `No agent visits ${periodo}.`,
    cosa: 'The first thing I would do:',
    boton: 'See visits',
  },
}

/** Una cosa concreta para hacer cuando no hubo visitas, según el chequeo que falla. */
export const ARREGLO: Partial<Record<Motivo, Record<Idioma, string>>> = {
  'sin-dominio': {
    es: 'agrega el dominio público de tu sitio en Peaje. Sin eso no podemos ver a los agentes que te visitan.',
    en: 'add your site’s public domain in Peaje. Without it we cannot see the agents that visit you.',
  },
  'proxy-nada': {
    es: 'instala el kit en tu sitio. Hoy las visitas de agentes no pasan por Peaje, así que no se cuentan. El comando está en Kit, en el dashboard.',
    en: 'install the kit on your site. Agent visits do not go through Peaje today, so they are not counted. The command is in Kit, in the dashboard.',
  },
  'proxy-parcial': {
    es: 'revisa el kit: algunas rutas de tu sitio no pasan por Peaje y esas visitas no se cuentan. El detalle está en Kit.',
    en: 'check the kit: some paths on your site do not go through Peaje, so those visits are not counted. The detail is in Kit.',
  },
  'copias-viejas': {
    es: 'tu sitio sirve copias viejas de archivos que debería servir Peaje. Bórralas y vuelve a publicar.',
    en: 'your site serves old copies of files Peaje should serve. Delete them and publish again.',
  },
  'bots-bloqueados': {
    es: 'tu sitio bloquea a los bots de búsqueda (un firewall o un modo anti bots). Déjalos pasar o no van a llegar.',
    en: 'your site blocks search bots (a firewall or a bot protection mode). Let them through or they will not arrive.',
  },
  'bots-challenge': {
    es: 'Cloudflare les muestra un desafío a los bots de búsqueda. Desactívalo para ellos.',
    en: 'Cloudflare shows a challenge to search bots. Turn it off for them.',
  },
  'bots-sin-html': {
    es: 'tu página de inicio sale vacía sin JavaScript y los bots no la pueden leer. Haz que el contenido venga en el HTML.',
    en: 'your homepage is empty without JavaScript, so bots cannot read it. Make the content come in the HTML.',
  },
  'robots-bloquea': {
    es: 'tu robots.txt bloquea a los bots de los asistentes de IA. Déjalos entrar.',
    en: 'your robots.txt blocks the AI assistants’ bots. Let them in.',
  },
  'robots-falta': {
    es: 'tu sitio no tiene robots.txt. El kit lo agrega.',
    en: 'your site has no robots.txt. The kit adds one.',
  },
  'links-falta': {
    es: 'a tu página de inicio le faltan los enlaces que les dicen a los agentes dónde está tu información. El kit los agrega.',
    en: 'your homepage is missing the links that tell agents where your information is. The kit adds them.',
  },
  'links-sin-home': {
    es: 'pon en tu página de inicio un enlace visible a /developers, para que los agentes lo encuentren.',
    en: 'add a visible link to /developers on your homepage so agents find it.',
  },
  'jsonld-falta': {
    es: 'tu página de inicio no dice en datos quién eres (JSON-LD). El kit lo agrega.',
    en: 'your homepage does not say who you are in structured data (JSON-LD). The kit adds it.',
  },
}
// Lo que más frena visitas primero.
export const PRIORIDAD: Chequeo['id'][] = ['dominio', 'proxy', 'bots', 'robots', 'frescura', 'links', 'json-ld']

async function queHacer(tenant: Tenant, idioma: Idioma): Promise<string> {
  const v = await store.lastVerification(tenant.id).catch(() => null)
  if (!v) {
    return idioma === 'es'
      ? 'todavía no revisamos tu sitio. Abre Kit en el dashboard y toca verificar, así vemos si los agentes pueden entrar.'
      : 'we have not checked your site yet. Open Kit in the dashboard and run the check, so we see whether agents can get in.'
  }
  const fallan = (v.checks as Chequeo[]).filter((c) => !c.ok).sort((a, b) => PRIORIDAD.indexOf(a.id) - PRIORIDAD.indexOf(b.id))
  for (const c of fallan) {
    const t = ARREGLO[c.motivo]
    if (t) return t[idioma]
  }
  return idioma === 'es'
    ? 'lo técnico está bien. Lo que más trae a los asistentes de IA es que otros sitios hablen de ti: pídeme ideas de dónde aparecer.'
    : 'the technical side is fine. What brings AI assistants most is other sites talking about you: ask me for ideas on where to show up.'
}

const num = (n: number, idioma: Idioma) => new Intl.NumberFormat(idioma === 'es' ? 'es-CO' : 'en-US').format(n)

function dinero(usd: number): string {
  const decimales = usd > 0 && usd < 0.01 ? 4 : 2
  return `US$${usd.toFixed(decimales)}`
}

/** Etiqueta del período: la nominal si el envío fue a tiempo, la fecha de inicio si no. */
function periodo(frecuencia: ReportFrequency, desde: number, hasta: number, zona: string, idioma: Idioma): { texto: string; anterior: string } {
  const largo = hasta - desde
  const nominal = largoNominal(frecuencia)
  const holgura = frecuencia === 'monthly' ? 3 * 86_400_000 : 3 * 3_600_000
  const t = T[idioma]
  if (Math.abs(largo - nominal) <= holgura) return { texto: t.nominal[frecuencia], anterior: t.anterior[frecuencia] }
  const fecha = new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', { timeZone: zona, day: 'numeric', month: 'long' }).format(new Date(desde))
  return { texto: t.desde(fecha), anterior: t.anteriorLibre }
}

/** Una ruta como código: sin backticks que la rompan y con largo acotado (las de escáneres pueden ser largas). */
export function rutaComoCodigo(path: string): string {
  const limpia = path.replace(/[`\r\n]/g, '')
  return `\`${limpia.length > 80 ? `${limpia.slice(0, 79)}…` : limpia}\``
}

// Un nombre sale del user-agent: sin los caracteres que el markdown de los canales interpreta.
const nombreLimpio = (n: string) => n.replace(/[*`~<>|[\]]/g, '').trim()

type Linea = { texto: string; visits: number; nombres: { nombre: string; visits: number }[] }

/** Las líneas de "quién vino", de mayor a menor, con las dos que juntan el resto al final. */
export function lineasQuien(grupos: VisitStats['grupos'], idioma: Idioma): string[] {
  const t = T[idioma]
  const clave = (g: VisitStats['grupos'][number]) => ('marca' in g ? `marca:${g.marca}` : `clase:${g.clase}`)
  const conLinea = (g: VisitStats['grupos'][number]) => !('marca' in g) || PRINCIPALES.has(clave(g))
  const ordenados = grupos.filter((g) => g.visits > 0 && !('clase' in g && g.clase === 'otros'))
  const lineas: Linea[] = ordenados
    .filter(conLinea)
    .map((g) => ({ texto: 'marca' in g ? g.marca : t.clases[g.clase], visits: g.visits, nombres: 'marca' in g ? [] : g.nombres }))
  const marcas = ordenados.filter((g) => !conLinea(g))
  const lugar = Math.max(0, MAX_LINEAS - lineas.length)
  // Si sobra una sola marca, va con su nombre: una línea que junta una sola no aclara nada.
  const conNombre = marcas.length - lugar <= 1 ? marcas : marcas.slice(0, lugar)
  const resto = marcas.slice(conNombre.length)
  for (const g of conNombre) lineas.push({ texto: 'marca' in g ? g.marca : '', visits: g.visits, nombres: [] })
  lineas.sort((a, b) => b.visits - a.visits)
  if (resto.length) {
    lineas.push({
      texto: t.otrasMarcas,
      visits: resto.reduce((n, g) => n + g.visits, 0),
      nombres: resto.map((g) => ({ nombre: 'marca' in g ? g.marca : '', visits: g.visits })),
    })
  }
  const otros = grupos.find((g) => 'clase' in g && g.clase === 'otros')
  if (otros && otros.visits > 0) lineas.push({ texto: t.clases.otros, visits: otros.visits, nombres: otros.nombres })
  return lineas.map((l) => {
    const nombres = l.nombres.map((n) => nombreLimpio(n.nombre)).filter(Boolean).slice(0, NOMBRES)
    return `- ${l.texto}: ${num(l.visits, idioma)}${nombres.length ? ` (${nombres.join(', ')})` : ''}`
  })
}

export type ReporteVisitas = { texto: string; botones: { text: string; url: string }[]; visitas: number; previas: number }

/** Arma el reporte de [desde, hasta) contra [desde - largo, desde). */
export async function reporteVisitas(
  tenant: Tenant,
  opts: { desde: Date; hasta: Date; frecuencia: ReportFrequency; zona: string; idioma: Idioma },
): Promise<ReporteVisitas> {
  const { idioma } = opts
  const t = T[idioma]
  const desde = opts.desde.getTime()
  const hasta = opts.hasta.getTime()
  const largo = Math.max(hasta - desde, 3_600_000)
  const dias = Math.max(1, Math.ceil(largo / 86_400_000))
  const [ahora, antes] = await Promise.all([
    store.visitStats(tenant.id, { days: dias, from: new Date(desde).toISOString(), to: new Date(hasta).toISOString() }),
    store.visitStats(tenant.id, { days: dias, from: new Date(desde - largo).toISOString(), to: new Date(desde).toISOString() }),
  ])
  const p = periodo(opts.frecuencia, desde, hasta, opts.zona, idioma)
  const total = ahora.totals.visits
  const previas = antes.totals.visits
  const botones = [{ text: t.boton, url: urlVisitas(tenant.slug) }]
  const lineas: string[] = [t.titulo(tenant.name)]

  if (total === 0) {
    lineas.push(t.cero(p.texto) + (previas > 0 ? ` ${idioma === 'es' ? `En ${p.anterior} hubo ${t.visitas(num(previas, idioma))}.` : `There were ${t.visitas(num(previas, idioma))} ${p.anterior}.`}` : ''))
    lineas.push('', `${t.cosa} ${await queHacer(tenant, idioma)}`)
    return { texto: lineas.join('\n'), botones, visitas: 0, previas }
  }

  let cambio: string
  if (previas === 0) cambio = t.antesCero(p.anterior)
  else {
    const dif = total - previas
    const pct = String(Math.round((Math.abs(dif) / previas) * 100))
    cambio = dif === 0 ? t.igual(p.anterior) : dif > 0 ? t.mas(num(dif, idioma), p.anterior, pct) : t.menos(num(-dif, idioma), p.anterior, pct)
  }
  const inicio = p.texto.charAt(0).toUpperCase() + p.texto.slice(1)
  lineas.push(`${inicio}: ${t.visitas(num(total, idioma))}, ${cambio}.`)

  lineas.push('', t.quien, ...lineasQuien(ahora.grupos, idioma))

  if (ahora.totals.paid > 0) lineas.push('', t.pagos(num(ahora.totals.paid, idioma), dinero(Number(ahora.totals.revenue))))

  const top = ahora.topPaths.slice(0, 3)
  if (top.length) lineas.push('', t.top, ...top.map((x) => `- ${rutaComoCodigo(x.path)}: ${num(x.visits, idioma)}`))

  return { texto: lineas.join('\n'), botones, visitas: total, previas }
}
