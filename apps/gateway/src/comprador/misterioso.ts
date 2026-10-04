import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { MysteryIssue, MysteryMission, MysteryProbe, MysteryProbeTarget, MysteryRun, Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { env } from '../env.js'
import { store } from '../store.js'
import { docsBase, gatewayBase } from '../base.js'
import { leerSitio, MODEL } from '../monitor/reporte.js'
import { descubrirCandidatos, elegirVarios, evaluar, type Candidato, type Evaluado } from '../agents/discovery.js'
import { validarCompra } from '../agents/llm.js'

/**
 * Comprador misterioso. Un agente comprador sintético que hace lo mismo que
 * un comprador real hasta justo antes de pagar, y NUNCA paga:
 *
 *   1. Opus escribe 3 misiones realistas que un agente recibiría de su dueño
 *      y que este negocio debería ganar (sin el nombre del negocio).
 *   2. Por cada misión corre el descubrimiento del comprador de Peaje tal
 *      cual (directorio + Bazaar de x402 + ERC-8004, `evaluar`, `elegirVarios`
 *      y el veto `validarCompra`) y registra si el negocio apareció, en qué
 *      puesto, a quién eligió en su lugar y por qué.
 *   3. Pide la URL con precio del negocio sin pagar y valida el 402 como un
 *      cliente estricto (x402 v2 y MPP), en su dominio y en el gateway.
 *
 * Los problemas técnicos que el dueño puede arreglar salen como tareas
 * `fix:402:<id>`; las que ya no aparecen se cierran solas en la corrida
 * siguiente.
 */

/** Lo que gasta por request un agente comprador típico (el p90 del Bazaar ronda US$0,15). */
const TOPE_COMPRADOR = 0.1
/** Validaciones del modelo por misión: el comprador real valida hasta 4; acá 2 para cuidar el costo. */
const VALIDACIONES_POR_MISION = 2
/** User-agent que visitas.ts ignora: la prueba no ensucia el embudo del negocio. */
const UA = 'peaje-verificador/1.0 (mystery-shopper)'

let anthropic: Anthropic | null = null

// ---- misiones ----

const MisionesSchema = z.object({
  missions: z.array(
    z.object({
      mission: z.string().describe('What the buying agent was asked to get, in the words its user would use'),
      terms: z.array(z.string()).describe('4 to 10 one-word search terms, lowercase, no accents, with Spanish and English synonyms'),
    }),
  ),
})

type Mision = { mission: string; terms: string[] }

type Vendible = { kind: 'route' | 'link'; path: string; priceUsd: string; description: string | null }

async function vendibles(tenant: Tenant): Promise<Vendible[]> {
  const [routes, resources] = await Promise.all([store.listRoutes(tenant.id), store.listResources(tenant.id)])
  return [
    ...routes
      .filter((r) => Number(r.priceUsd) > 0)
      .map((r) => ({ kind: 'route' as const, path: r.pathPattern, priceUsd: r.priceUsd, description: r.description ?? null, method: r.method }))
      .sort((a, b) => Number(a.method !== 'GET') - Number(b.method !== 'GET'))
      .map(({ method: _m, ...v }) => v),
    ...resources.filter((r) => Number(r.priceUsd) > 0).map((r) => ({ kind: 'link' as const, path: `/r/${r.slug}`, priceUsd: r.priceUsd, description: r.title ?? null })),
  ]
}

/**
 * Tres misiones que un agente comprador real recibiría. Los términos de
 * búsqueda salen en la misma llamada con la regla de `expandirMision` (el
 * comprador real hace una llamada aparte por misión; acá se ahorran tres).
 */
async function escribirMisiones(tenant: Tenant, items: Vendible[]): Promise<Mision[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return items.slice(0, 3).map((i) => ({ mission: i.description ?? i.path, terms: [] }))
  }
  const dominio = dominioVerificable(tenant.originUrl)
  const [plan, sitio] = await Promise.all([store.getPlan(tenant.id), dominio ? leerSitio(dominio).catch(() => '') : Promise.resolve('')])
  anthropic ??= new Anthropic()
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8_000,
    system: [
      'You write test missions for a synthetic buying agent. A buying agent is an AI agent with a wallet: its user gives it a job, it searches paid APIs and paid links, picks one and pays per request.',
      'Write the 3 most realistic jobs a user would give such an agent that this business should win with what it sells. Each is a concrete job that needs the data (a city, a date, an amount), written the way a user talks to their agent, in the language its customers would use (for a Latin American business, mix Spanish and English across the three). Never include the business name or domain. Under 20 words each.',
      'For each, also return the search terms: 4 to 10 one-word terms, lowercase, no accents, including synonyms and English and Spanish equivalents.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Business: ${tenant.name}.`,
          `Owner goal: ${plan ? `${plan.goal}: ${plan.goalDetail}` : 'not set'}.`,
          'What it sells to agents (price per request):',
          ...items.slice(0, 12).map((i) => `- ${i.kind === 'route' ? 'API' : 'link'} ${i.path} at $${Number(i.priceUsd)}: ${i.description ?? '(no description)'}`),
          '',
          `Site text:\n${sitio.slice(0, 6_000) || '(not available)'}`,
        ].join('\n'),
      },
    ],
    output_config: { format: zodOutputFormat(MisionesSchema) },
  })
  // Opus razona antes de responder y eso cuenta en max_tokens: un corte deja el JSON a medias.
  if (res.stop_reason === 'max_tokens') throw new Error('The model ran out of room writing the missions. Try again.')
  if (res.stop_reason === 'refusal') throw new Error('The model declined to write the missions.')
  const misiones = (res.parsed_output?.missions ?? [])
    .map((m) => ({ mission: m.mission.trim(), terms: m.terms.map((t) => t.toLowerCase().trim()).filter(Boolean) }))
    .filter((m) => m.mission)
  if (misiones.length === 0) throw new Error('The model returned no missions.')
  return misiones.slice(0, 3)
}

// ---- una misión ----

const hostDe = (url: string | null) => {
  try {
    return url ? new URL(url).hostname : ''
  } catch {
    return url ?? ''
  }
}

/** Candidatos del propio negocio: sus entradas del directorio o su dominio. */
function esDelNegocio(tenant: Tenant, c: Candidato): boolean {
  if (!c.url) return false
  if (c.url.startsWith(`${env.publicUrl}/${tenant.slug}/`)) return true
  const dominio = dominioVerificable(tenant.originUrl)?.replace(/^www\./, '')
  const h = hostDe(c.url).replace(/^www\./, '')
  return !!dominio && (h === dominio || h.endsWith(`.${dominio}`))
}

const coincidencias = (e: Evaluado) => {
  const m = e.motivos.find((x) => x.startsWith('coincide con'))
  return m ? m.split('", "').length : 0
}

const ordinal = (n: number) => ['first', 'second', 'third'][n - 1] ?? `#${n}`
const ordinalEs = (n: number) => ['primero', 'segundo', 'tercero'][n - 1] ?? `en el puesto ${n}`
const usd = (x: number | null) => (x === null ? '?' : `$${x}`)

async function correrMision(tenant: Tenant, m: Mision, candidatos: Candidato[]): Promise<MysteryMission> {
  const evaluados = evaluar(candidatos, m.mission, TOPE_COMPRADOR, m.terms)
  const comprables = evaluados.filter((e) => e.score > 0 && e.url !== null && e.precio !== null && e.pagable)
  const propios = evaluados.filter((e) => esDelNegocio(tenant, e))
  const mejorPropio = propios[0] ?? null
  const idx = mejorPropio ? comprables.indexOf(mejorPropio) : -1
  const found = !!mejorPropio && idx >= 0 && coincidencias(mejorPropio) > 0
  const rank = found ? idx + 1 : null

  // La lista corta y el veto, como el runner antes de pagar (sin pagar).
  const lista = elegirVarios(evaluados, 4)
  const vetos: { e: Evaluado; motivo: string }[] = []
  let elegido: Evaluado | null = null
  let motivoElegido = ''
  for (const c of lista.slice(0, VALIDACIONES_POR_MISION)) {
    const v = await validarCompra(m.mission, c)
    if (v.compra) {
      elegido = c
      motivoElegido = v.motivo
      break
    }
    vetos.push({ e: c, motivo: v.motivo })
  }
  const chosen = !!elegido && esDelNegocio(tenant, elegido)
  const vetoPropio = vetos.find((v) => esDelNegocio(tenant, v.e))
  const enLista = !!mejorPropio && lista.some((e) => esDelNegocio(tenant, e))
  const tapadoPorHost = !!mejorPropio && !enLista && lista.some((e) => hostDe(e.url) === hostDe(mejorPropio.url) && !esDelNegocio(tenant, e))

  // Por qué perdió, en palabras simples (en y es).
  let por = ''
  let porEs = ''
  if (chosen) {
    por = motivoElegido || mejorPropio?.motivos.join('; ') || ''
    porEs = por
  } else if (vetoPropio) {
    por = `it looked at you and passed: ${vetoPropio.motivo || 'it did not think you deliver what the job needs'}`
    porEs = `te miró y te descartó: ${vetoPropio.motivo || 'no creyó que entregaras lo que pide el trabajo'}`
  } else if (mejorPropio && mejorPropio.precio !== null && mejorPropio.precio > TOPE_COMPRADOR) {
    por = `your price (${usd(mejorPropio.precio)}) is above the ${usd(TOPE_COMPRADOR)} a typical agent spends per request`
    porEs = `tu precio (${usd(mejorPropio.precio)}) supera los ${usd(TOPE_COMPRADOR)} que gasta por request un agente típico`
  } else if (!found) {
    por = `your description does not use the words it searched for (${m.terms.slice(0, 6).join(', ') || m.mission})`
    porEs = `tu descripción no usa las palabras que buscó (${m.terms.slice(0, 6).join(', ') || m.mission})`
  } else if (tapadoPorHost) {
    por = 'another business on the same Peaje gateway ranked above you, and the agent keeps one option per host'
    porEs = 'otro negocio en el mismo gateway de Peaje quedó arriba y el agente se queda con una opción por host'
  } else if (elegido && mejorPropio && elegido.precio !== null && mejorPropio.precio !== null && elegido.precio < mejorPropio.precio) {
    por = `it is cheaper (${usd(elegido.precio)} vs your ${usd(mejorPropio.precio)})`
    porEs = `es más barato (${usd(elegido.precio)} contra tus ${usd(mejorPropio.precio)})`
  } else if (elegido && mejorPropio && coincidencias(elegido) > coincidencias(mejorPropio)) {
    por = 'its description matches the job better than yours'
    porEs = 'su descripción calza mejor con el pedido que la tuya'
  } else if (elegido && mejorPropio) {
    por = `it scored higher (${elegido.score} vs your ${mejorPropio.score})`
    porEs = `sacó más puntaje (${elegido.score} contra tus ${mejorPropio.score})`
  } else {
    por = vetos.map((v) => v.motivo).filter(Boolean).join(' ') || 'nothing it found delivers what the job needs'
    porEs = por
  }

  const instead = !chosen && elegido ? { name: elegido.nombre.slice(0, 120), host: hostDe(elegido.url), priceUsd: elegido.precio } : null
  const q = `"${m.mission}"`
  let verdict: string
  let verdictEs: string
  if (chosen) {
    // Si descartó antes a otro, se dice: ganaste por el veto, no por el puesto.
    const antes = vetos[0] ? ` after passing on ${hostDe(vetos[0].e.url)}${vetos[0].motivo ? ` (${vetos[0].motivo.replace(/\.$/, '')})` : ''}` : ''
    const antesEs = vetos[0] ? `, después de descartar ${hostDe(vetos[0].e.url)}${vetos[0].motivo ? ` (${vetos[0].motivo.replace(/\.$/, '')})` : ''}` : ''
    verdict = `An agent asked for ${q} found you ${ordinal(rank ?? 1)} and would buy from you${antes}.`
    verdictEs = `Un agente al que le pidieron ${q} te encontró ${ordinalEs(rank ?? 1)} y te compraría a ti${antesEs}.`
  } else if (found && instead) {
    verdict = `An agent asked for ${q} found you ${ordinal(rank ?? 0)} and picked ${instead.host} (${usd(instead.priceUsd)}) because ${por}.`
    verdictEs = `Un agente al que le pidieron ${q} te encontró ${ordinalEs(rank ?? 0)} y eligió ${instead.host} (${usd(instead.priceUsd)}) porque ${porEs}.`
  } else if (found) {
    verdict = `An agent asked for ${q} found you ${ordinal(rank ?? 0)} but bought nothing: ${por}.`
    verdictEs = `Un agente al que le pidieron ${q} te encontró ${ordinalEs(rank ?? 0)} pero no compró nada: ${porEs}.`
  } else if (instead) {
    verdict = `An agent asked for ${q} did not find you (${por}) and picked ${instead.host} (${usd(instead.priceUsd)}).`
    verdictEs = `Un agente al que le pidieron ${q} no te encontró (${porEs}) y eligió ${instead.host} (${usd(instead.priceUsd)}).`
  } else {
    verdict = `An agent asked for ${q} did not find you (${por}) and bought nothing.`
    verdictEs = `Un agente al que le pidieron ${q} no te encontró (${porEs}) y no compró nada.`
  }

  const reason = chosen
    ? por
    : [elegido ? `${elegido.nombre}: ${elegido.motivos.join('; ')}${motivoElegido ? `. ${motivoElegido}` : ''}` : '', ...vetos.map((v) => `${v.e.nombre}: ${v.motivo}`)]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 800) || por
  return { mission: m.mission, found, rank, chosen, instead, reason, verdict, verdictEs }
}

// ---- prueba del 402 ----

function decodificarBase64Json(s: string): unknown {
  const normal = s.trim().replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(normal, 'base64').toString('utf8'))
}

function problema(id: string, side: MysteryIssue['side'], text: string, es: string): MysteryIssue {
  return { id, side, text, es }
}

type X402 = {
  x402Version?: number
  accepts?: { amount?: string; asset?: string; payTo?: string; network?: string }[]
  resource?: { url?: string; description?: string }
}

/**
 * Valida el 402 como un cliente estricto. `lado` decide de quién es el
 * arreglo: en el dominio lo que el gateway sí hace bien y el dominio no, es
 * del dueño (proxy o hosting); en el gateway es de Peaje.
 */
async function probar(url: string, via: MysteryProbeTarget['via'], item: Vendible, tenant: Tenant, gatewayOk: boolean | null): Promise<MysteryProbeTarget> {
  const issues: MysteryIssue[] = []
  const lado: MysteryIssue['side'] = via === 'domain' && gatewayOk ? 'owner' : 'peaje'
  const precio = Number(item.priceUsd)
  let res: Response
  try {
    res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(12_000) })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    issues.push(
      via === 'domain'
        ? problema('dominio-no-responde', 'owner', `${url} did not answer (${msg}). Agents that find you on your domain cannot reach the payment step.`, `${url} no respondió (${msg}). Los agentes que te encuentran en tu dominio no llegan al paso de pago.`)
        : problema('gateway-no-responde', 'peaje', `Peaje's gateway did not answer at ${url} (${msg}).`, `El gateway de Peaje no respondió en ${url} (${msg}).`),
    )
    return { via, url, status: null, ok: false, issues }
  }
  await res.arrayBuffer().catch(() => null)
  const final = res.url || url

  if (res.status !== 402) {
    issues.push(
      via === 'domain'
        ? problema(
            'dominio-sin-402',
            'owner',
            `Your domain answers ${res.status} at ${item.path} instead of asking for payment. Agents that find you there never see the price, so they cannot pay you. Your site is not forwarding this path to Peaje.`,
            `Tu dominio responde ${res.status} en ${item.path} en vez de pedir el pago. Los agentes que te encuentran ahí nunca ven el precio, así que no pueden pagarte. Tu sitio no le pasa este path a Peaje.`,
          )
        : problema('gateway-sin-402', 'peaje', `Peaje's gateway answered ${res.status} instead of 402 at ${url}.`, `El gateway de Peaje respondió ${res.status} en vez de 402 en ${url}.`),
    )
    return { via, url: final, status: res.status, ok: false, issues }
  }

  // x402 v2: el header PAYMENT-REQUIRED (base64 JSON). Muchos clientes solo leen esto.
  const crudo = res.headers.get('payment-required')
  let x402: X402 | null = null
  if (!crudo) {
    issues.push(problema('x402-falta', lado, 'The payment answer has no PAYMENT-REQUIRED header, so x402 clients (the most common kind) do not know how to pay.', 'La respuesta de pago no trae el header PAYMENT-REQUIRED, así que los clientes x402 (los más comunes) no saben cómo pagar.'))
  } else {
    try {
      x402 = decodificarBase64Json(crudo) as X402
    } catch {
      issues.push(problema('x402-ilegible', lado, 'The PAYMENT-REQUIRED header cannot be read (it is not base64 JSON). x402 clients give up there.', 'El header PAYMENT-REQUIRED no se puede leer (no es JSON en base64). Los clientes x402 abandonan ahí.'))
    }
  }
  if (x402) {
    if (x402.x402Version !== 2) issues.push(problema('x402-version', lado, `The payment header says x402 version ${x402.x402Version ?? 'none'}; current clients expect 2.`, `El header de pago dice versión x402 ${x402.x402Version ?? 'ninguna'}; los clientes actuales esperan la 2.`))
    const ofertas = Array.isArray(x402.accepts) ? x402.accepts : []
    if (ofertas.length === 0) {
      issues.push(problema('x402-sin-ofertas', lado, 'The payment header lists no way to pay (accepts is empty).', 'El header de pago no lista ninguna forma de pagar (accepts vacío).'))
    } else {
      const incompletas = ofertas.filter((o) => !o.amount || !o.asset || !o.payTo || !o.network)
      if (incompletas.length) issues.push(problema('x402-oferta-incompleta', lado, `${incompletas.length} of ${ofertas.length} payment options miss the amount, token, recipient or network. Clients skip them.`, `${incompletas.length} de ${ofertas.length} formas de pago no traen monto, token, destinatario o red. Los clientes las saltan.`))
      // El monto va en unidades de 6 decimales. En rieles con costo de red se suma el gas (hasta US$0,05).
      const montos = ofertas.map((o) => Number(o.amount) / 1e6).filter((x) => Number.isFinite(x))
      const menor = montos.filter((x) => x + 1e-9 < precio)
      const mayor = montos.filter((x) => x > precio + 0.06)
      if (menor.length) issues.push(problema('monto-menor', lado, `Some payment options ask for less than your listed price ($${precio}): ${menor.map((x) => `$${x}`).join(', ')}.`, `Algunas formas de pago piden menos que tu precio publicado ($${precio}): ${menor.map((x) => `$${x}`).join(', ')}.`))
      if (mayor.length) issues.push(problema('monto-mayor', lado, `Some payment options ask for much more than your listed price ($${precio}): ${mayor.map((x) => `$${x}`).join(', ')}. Agents compare the listed price with what they are asked to sign.`, `Algunas formas de pago piden mucho más que tu precio publicado ($${precio}): ${mayor.map((x) => `$${x}`).join(', ')}. Los agentes comparan el precio publicado con lo que les piden firmar.`))
    }
    // resource.url: los clientes estrictos abortan si no coincide con la URL que pidieron.
    const rurl = x402.resource?.url ?? ''
    if (!rurl) {
      issues.push(problema('x402-sin-url', lado, 'The payment header does not say which URL it charges for. Strict clients abort.', 'El header de pago no dice qué URL cobra. Los clientes estrictos abortan.'))
    } else if (via === 'domain') {
      const dominio = hostDe(url).replace(/^www\./, '')
      const h = hostDe(rurl).replace(/^www\./, '')
      if (h !== dominio)
        issues.push(
          problema(
            'dominio-otro-host',
            'owner',
            `Your domain asks for payment but names ${hostDe(rurl)} as the thing being paid for, not ${dominio}. Strict x402 clients see the mismatch and stop. Your proxy is not passing the original host to Peaje.`,
            `Tu dominio pide el pago pero nombra ${hostDe(rurl)} como lo que se paga, no ${dominio}. Los clientes x402 estrictos ven la diferencia y se detienen. Tu proxy no le pasa a Peaje el host original.`,
          ),
        )
    } else {
      const a = new URL(rurl)
      const b = new URL(final)
      if (a.host !== b.host || a.pathname !== b.pathname) issues.push(problema('resource-no-coincide', 'peaje', `The payment header names ${rurl} but the request was ${final}. Strict clients abort.`, `El header de pago nombra ${rurl} pero se pidió ${final}. Los clientes estrictos abortan.`))
    }
    if (!x402.resource?.description) {
      issues.push(problema('x402-sin-descripcion', 'peaje', 'x402 clients get no description in the payment header (it only travels in the MPP challenge and the error text).', 'Los clientes x402 no reciben descripción en el header de pago (solo va en el desafío MPP y en el texto de error).'))
    }
  }

  // MPP: WWW-Authenticate con al menos un desafío Payment (id, method, request).
  const www = res.headers.get('www-authenticate') ?? ''
  const tieneMpp = /(^|,\s*)Payment\s/.test(www) && /\bid="/.test(www) && /\bmethod="/.test(www) && /\brequest="/.test(www)
  if (!tieneMpp) issues.push(problema('mpp-falta', lado, 'The payment answer has no MPP challenge (WWW-Authenticate: Payment), so MPP clients cannot pay.', 'La respuesta de pago no trae el desafío MPP (WWW-Authenticate: Payment), así que los clientes MPP no pueden pagar.'))

  // Descripción: lo que el agente lee para decidir. Ni vacía ni el path.
  const descripciones = [...www.matchAll(/description="((?:[^"\\]|\\.)*)"/g)].map((mm) => mm[1] ?? '')
  const desc = (x402?.resource?.description || descripciones[0] || '').trim()
  const genericas = new Set([item.path, `${tenant.name} · ${item.path}`, `GET ${item.path}`, item.path.replace(/^\/r\//, '')])
  if (!desc || genericas.has(desc) || desc.length < 20) {
    issues.push(
      problema(
        'descripcion',
        'owner',
        `Agents read "${desc || '(nothing)'}" as the description of ${item.path}. Say what it returns, the parameters and units, in English, so an agent can tell it is what it needs.`,
        `Los agentes leen "${desc || '(nada)'}" como descripción de ${item.path}. Di qué devuelve, los parámetros y las unidades, en inglés, para que un agente sepa que es lo que necesita.`,
      ),
    )
  }

  // Un 402 en el dominio sin los headers que el gateway sí manda: el hosting los quita.
  if (via === 'domain' && gatewayOk && issues.some((i) => i.id === 'x402-falta' || i.id === 'mpp-falta')) {
    issues.push(problema('dominio-quita-encabezados', 'owner', 'Your domain returns 402 but drops the payment headers Peaje sends. A CDN, middleware or proxy rule on your site is removing them.', 'Tu dominio devuelve 402 pero sin los headers de pago que Peaje manda. Una regla de CDN, middleware o proxy de tu sitio los está quitando.'))
  }
  // ok = el paso de pago funciona; la descripción se reporta aparte y no cambia de quién es el arreglo.
  const ok = !issues.some((i) => i.id !== 'x402-sin-descripcion' && i.id !== 'descripcion')
  return { via, url: final, status: res.status, ok, issues }
}

function urlDePrueba(base: string, item: Vendible): string {
  const path = item.path.replace(/:[A-Za-z0-9_]+/g, 'example').replace(/\*.*$/, '')
  return `${base}${path}`
}

export async function sondear402(tenant: Tenant, item: Vendible | null): Promise<MysteryProbe> {
  if (!item) return { item: null, targets: [] }
  const gatewayUrl = urlDePrueba(gatewayBase(tenant), item)
  const gateway = await probar(gatewayUrl, 'gateway', item, tenant, null)
  const targets = [gateway]
  const base = docsBase(tenant)
  if (base !== gatewayBase(tenant)) targets.unshift(await probar(urlDePrueba(base, item), 'domain', item, tenant, gateway.ok))
  return { item: { kind: item.kind, path: item.path, priceUsd: item.priceUsd }, targets }
}

// ---- tareas ----

const CLI = 'npx @peaje/cli@1'

function promptArreglo(tenant: Tenant, issue: MysteryIssue, probe: MysteryProbe): string {
  const dominio = probe.targets.find((t) => t.via === 'domain')
  const gateway = probe.targets.find((t) => t.via === 'gateway')
  const path = probe.item?.path ?? '/'
  const comun = [
    `# Fix the payment step: ${issue.id}`,
    '',
    `Peaje's mystery shopper (a synthetic buying agent that never pays) requested ${dominio?.url ?? gateway?.url} without paying and checked the answer the way a strict x402 / MPP client does. It found:`,
    '',
    `> ${issue.text}`,
    '',
    `How it should look: ${gateway?.url ?? `${gatewayBase(tenant)}${path}`} answers \`402\` with a \`PAYMENT-REQUIRED\` header (base64 JSON, x402 v2) and a \`WWW-Authenticate: Payment ...\` header (MPP). Your domain must answer the same thing at the same path, naming your domain.`,
    '',
    '## What to do',
    '',
  ]
  const pasos =
    issue.id === 'descripcion'
      ? [
          `1. In the Peaje dashboard, Routes, edit ${path} (or ask the Peaje agent in the chat to propose a new description).`,
          '2. Write it for an agent, in English: what the response contains, the query parameters with an example, units, and coverage (for example "Latin America"). One or two sentences.',
          '3. Save. No deploy needed: the 402 and the discovery files pick it up at once.',
          '4. Mark this task done. The next mystery shopper run checks it again.',
        ]
      : issue.id === 'dominio-otro-host'
        ? [
            `1. Find the rule in this site that forwards ${path} to Peaje (next.config rewrites, \`@peaje/next/proxy\`, vercel.json, nginx, Caddy or a Worker).`,
            '2. Make it pass the original host: send `X-Peaje-Forwarded-Host: <your domain>` (the gateway host overwrites `X-Forwarded-Host`) and `X-Forwarded-Proto: https` to the gateway. `@peaje/next/proxy` and the configs generated by the kit already do it.',
            `3. If in doubt, run \`${CLI} init ${tenant.slug} --yes\` in the repo root; it detects the stack and regenerates the forwarding.`,
            `4. Deploy, then run \`curl -si ${dominio?.url ?? ''} | grep -i payment-required\` and check the decoded \`resource.url\` is on your domain.`,
            '5. Mark this task done. The next mystery shopper run checks it again.',
          ]
        : issue.id === 'dominio-quita-encabezados'
          ? [
              '1. Look for a CDN rule, middleware or proxy setting that strips or rewrites response headers on this path (Cloudflare Transform Rules, a Next.js middleware that returns a new Response, nginx `proxy_hide_header`).',
              '2. Let `PAYMENT-REQUIRED`, `WWW-Authenticate`, `Payment-Receipt` and `Link` through untouched, and do not cache 402 answers.',
              `3. Deploy, then run \`curl -si ${dominio?.url ?? ''}\` and check both headers are there.`,
              '4. Mark this task done. The next mystery shopper run checks it again.',
            ]
          : [
              `1. In the root of this site's repo, run \`${CLI} init ${tenant.slug} --yes\`. It detects the stack (Next.js, Vercel, Cloudflare, nginx, Caddy) and adds the rule that forwards priced paths to Peaje.`,
              `2. Check that ${path} is covered. With \`@peaje/next/proxy\` it is automatic; with static configs make sure the rule forwards \`${path}\` (with its query string) to \`${gatewayBase(tenant)}${path}\`, passing \`X-Peaje-Forwarded-Host\`.`,
              '3. Deploy.',
              `4. Run \`curl -si ${dominio?.url ?? ''}\`: it must answer \`402\` with a \`PAYMENT-REQUIRED\` header.`,
              '5. Mark this task done. Peaje checks the live URL, and the next mystery shopper run checks the full answer.',
            ]
  return [...comun, ...pasos].join('\n')
}

async function sincronizarTareas(tenant: Tenant, probe: MysteryProbe): Promise<{ creadas: number; cerradas: number }> {
  if (!probe.item) return { creadas: 0, cerradas: 0 }
  // Solo lo que el dueño puede arreglar; lo del gateway es de Peaje.
  const propios = new Map<string, MysteryIssue>()
  for (const t of probe.targets) for (const i of t.issues) if (i.side === 'owner' && !propios.has(i.id)) propios.set(i.id, i)
  let creadas = 0
  const dominioUrl = probe.targets.find((t) => t.via === 'domain')?.url
  for (const i of propios.values()) {
    const r = await store.upsertTask({
      tenantId: tenant.id,
      key: `fix:402:${i.id}`,
      kind: 'fix',
      title: i.id === 'descripcion' ? `Describe ${probe.item.path} so agents know what they buy` : i.id === 'dominio-sin-402' ? `Make your domain ask agents to pay at ${probe.item.path}` : i.id === 'dominio-otro-host' ? 'Name your domain in the payment request' : i.id === 'dominio-quita-encabezados' ? 'Stop your site from dropping the payment headers' : `Fix the payment step (${i.id})`,
      summary: i.text.slice(0, 300),
      body: promptArreglo(tenant, i, probe),
      // Para el 402 en el dominio, Peaje revisa en vivo que la URL ya no sirva el contenido gratis y hable de pago.
      acceptance: i.id === 'dominio-sin-402' && dominioUrl ? [{ type: 'url', url: dominioUrl, notStatus: 200, contains: 'payment-required' }] : [],
      source: 'mystery-shopper',
    })
    if (r.created) creadas += 1
  }
  // Las que ya no aparecen: cerradas por el propio comprador.
  let cerradas = 0
  for (const t of await store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done'] })) {
    if (!t.key.startsWith('fix:402:')) continue
    if (propios.has(t.key.slice('fix:402:'.length))) continue
    await store.updateTask(tenant.id, t.id, { status: 'verified', verifiedAt: new Date().toISOString(), note: 'The mystery shopper no longer sees this problem.' })
    cerradas += 1
  }
  return { creadas, cerradas }
}

// ---- la corrida ----

export type ResultadoComprador = MysteryRun & { nothingToBuy: boolean; tasks: { creadas: number; cerradas: number } }

function resumen(misiones: MysteryMission[], probe: MysteryProbe): string {
  const elegido = misiones.filter((m) => m.chosen).length
  const visto = misiones.filter((m) => m.found && !m.chosen).length
  const perdido = misiones.filter((m) => !m.found).length
  const propios = new Set(probe.targets.flatMap((t) => t.issues.filter((i) => i.side === 'owner').map((i) => i.id)))
  const partes = [
    `Out of ${misiones.length} buying missions, an agent picked you in ${elegido}, found you but picked someone else in ${visto}, and did not find you in ${perdido}.`,
    propios.size === 0 ? 'The payment step works the way strict clients expect.' : `The payment step has ${propios.size} problem${propios.size === 1 ? '' : 's'} you can fix (left as tasks).`,
  ]
  return partes.join(' ')
}

export async function correrComprador(tenant: Tenant): Promise<ResultadoComprador> {
  const items = await vendibles(tenant)
  if (items.length === 0) {
    const run = await store.recordMysteryRun({
      tenantId: tenant.id,
      missions: [],
      probe: null,
      issues: [],
      summary: 'There is nothing an agent can buy from you yet: no priced API routes or priced links. Add one and the mystery shopper can test whether agents find and pick you.',
    })
    return { ...run, nothingToBuy: true, tasks: { creadas: 0, cerradas: 0 } }
  }

  const [misiones, candidatos] = await Promise.all([escribirMisiones(tenant, items), descubrirCandidatos()])
  const resultados: MysteryMission[] = []
  for (const m of misiones) resultados.push(await correrMision(tenant, m, candidatos))

  // El 402 se prueba sobre la primera ruta GET con precio (o el primer link).
  const probe = await sondear402(tenant, items[0] ?? null)
  const tasks = await sincronizarTareas(tenant, probe).catch((error) => {
    console.warn('[comprador] no se pudieron sincronizar las tareas', error instanceof Error ? error.message : error)
    return { creadas: 0, cerradas: 0 }
  })
  const issues = [
    ...new Map(
      probe.targets.flatMap((t) => t.issues).map((i) => [i.id, i.side === 'owner' ? i.text : `On Peaje's side, nothing for you to do: ${i.text}`] as const),
    ).values(),
  ]
  const run = await store.recordMysteryRun({ tenantId: tenant.id, missions: resultados, probe, issues, summary: resumen(resultados, probe) })
  return { ...run, nothingToBuy: false, tasks }
}

/** A pedido (chat y botón del dashboard): una corrida por negocio cada 6 horas, como la citación. */
const ultimaCorrida = new Map<string, number>()
export const ESPERA_COMPRADOR_MS = 6 * 3_600_000

export async function probarAhora(tenant: Tenant): Promise<ResultadoComprador | { error: 'too-soon'; retryInSeconds: number }> {
  const antes = ultimaCorrida.get(tenant.id) ?? 0
  if (Date.now() - antes < ESPERA_COMPRADOR_MS) return { error: 'too-soon', retryInSeconds: Math.ceil((ESPERA_COMPRADOR_MS - (Date.now() - antes)) / 1000) }
  ultimaCorrida.set(tenant.id, Date.now())
  try {
    return await correrComprador(tenant)
  } catch (error) {
    // Un fallo no consume el cupo: se puede reintentar.
    ultimaCorrida.delete(tenant.id)
    throw error
  }
}

/** Lo que ven el chat y el correo: sin ids internos. */
export function resultadoPublico(run: MysteryRun | null) {
  if (!run) return null
  return {
    ranAt: run.runAt,
    summary: run.summary,
    missions: run.missions.map((m) => ({ mission: m.mission, found: m.found, rank: m.rank, chosen: m.chosen, instead: m.instead, verdict: m.verdict, reason: m.reason })),
    paymentStep: run.probe
      ? {
          tested: run.probe.item,
          results: run.probe.targets.map((t) => ({ where: t.via === 'domain' ? 'your domain' : "Peaje's gateway", url: t.url, status: t.status, ok: t.ok })),
        }
      : null,
    issues: run.issues,
  }
}
