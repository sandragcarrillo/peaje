import type { Tenant } from '@peaje/db'
import type { Motivo } from '@peaje/shared'
import type { Reporte } from './reporte.js'
import { ARREGLO } from '../reportes/visitas.js'
import { TEXTO_ESFUERZO, TEXTO_IMPACTO } from '../tareas/prioridad.js'

/**
 * Correos del monitor por Resend: la alerta (un evento, qué se rompió y el
 * comando que lo arregla) y el reporte semanal. HTML plano, legible en Gmail.
 * Mismas variables que la entrega del agente comprador.
 */

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const estilo = 'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111'
const mono = 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f4f4f4;padding:10px 12px;border-radius:4px;white-space:pre-wrap'

/** `text` es la versión en texto plano (la usan los clientes sin HTML y ayuda con los filtros de spam). */
/** Un adjunto de Resend. Con `content_id`, la imagen se embebe y el HTML la usa como `cid:<content_id>`. */
export type Adjunto = { filename: string; content: string; content_id?: string }

export async function enviarCorreo(to: string, subject: string, html: string, opts?: { replyTo?: string; text?: string; attachments?: Adjunto[] }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.AGENTS_FROM_EMAIL
  if (!key || !from) throw new Error('Falta RESEND_API_KEY o AGENTS_FROM_EMAIL en el gateway')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, ...(opts?.text ? { text: opts.text } : {}), ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}), ...(opts?.attachments?.length ? { attachments: opts.attachments } : {}) }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`)
}

/** Texto para personas de cada chequeo y de cada motivo de fallo. */
export const NOMBRE_CHEQUEO: Record<string, string> = {
  dominio: 'public domain',
  proxy: 'proxy rewrites',
  frescura: 'stale copies',
  'json-ld': 'JSON-LD',
  links: 'discovery links',
  robots: 'robots.txt',
  bots: 'answer-engine bots can read the site',
}

export const TEXTO_MOTIVO: Record<string, string> = {
  'sin-dominio': 'the business has no public domain configured in Peaje',
  'proxy-nada': 'none of the proxied paths answer from the gateway: the rewrites are not deployed',
  'proxy-parcial': 'some proxied paths do not answer: a rule is missing or a middleware matcher swallows it',
  'copias-viejas': 'static copies are served by the site instead of the gateway',
  'jsonld-falta': 'no JSON-LD block on the homepage',
  'links-falta': 'the discovery <link> tags are missing from the homepage',
  'links-sin-home': 'the homepage has no visible link to /developers',
  'robots-falta': 'no robots.txt',
  'robots-bloquea': 'robots.txt blocks the answer-engine bots',
  'bots-bloqueados': 'a WAF or bot fight mode blocks search bots',
  'bots-challenge': 'a Cloudflare challenge is served to search bots',
  'bots-sin-html': 'the homepage is an empty shell without JavaScript',
}

export function htmlAlerta(tenant: Tenant, r: Reporte, eventos: string[]): { subject: string; html: string } {
  const fallos = eventos.filter((e) => e.startsWith('new_failure:')).map((e) => e.slice('new_failure:'.length))
  const cambios = eventos.filter((e) => e.endsWith('_changed'))
  const primero = fallos[0] ? (NOMBRE_CHEQUEO[fallos[0]] ?? fallos[0]) : cambios[0] === 'robots_changed' ? 'robots.txt changed' : 'llms.txt changed'
  const subject = `${tenant.name}: ${fallos.length > 0 ? `${primero} stopped working` : primero}`

  const lineas = r.fallando
    .filter((f) => fallos.includes(f.id))
    .map((f) => `<li><strong>${esc(NOMBRE_CHEQUEO[f.id] ?? f.id)}</strong>: ${esc(f.texto)}${f.detalle.length ? `<br><span style="color:#666">${esc(f.detalle.join(' · '))}</span>` : ''}</li>`)

  const html = `<div style="${estilo}">
<p>Peaje checked <strong>${esc(r.dominio)}</strong> a minute ago${r.previaAt ? ` and compared it with yesterday` : ''}.</p>
${fallos.length ? `<p>This stopped working:</p><ul>${lineas.join('')}</ul>` : ''}
${cambios.includes('robots_changed') ? `<p>Your <code>robots.txt</code> changed since the last check${r.fallando.some((f) => f.id === 'robots' || f.id === 'bots') ? ' and the answer-engine bots are now affected' : ', and the bots can still read you'}.</p>` : ''}
${cambios.includes('llms_changed') ? `<p>Your <code>llms.txt</code> changed since the last check.</p>` : ''}
${fallos.length ? `<p>The fix, for your coding agent or your terminal:</p><pre style="${mono}">${esc(r.comando)}</pre>` : ''}
<p><a href="${esc(r.kitUrl)}">Open the kit page</a> to run the check again after deploying.</p>
<p style="color:#666;font-size:13px">You get this because ${esc(tenant.name)} is on Peaje Pro. Reply to this email if something looks wrong.</p>
</div>`
  return { subject, html }
}

const NOMBRE_CHEQUEO_ES: Record<string, string> = {
  dominio: 'dominio público',
  proxy: 'el kit de Peaje',
  frescura: 'copias viejas',
  'json-ld': 'datos del negocio (JSON-LD)',
  links: 'enlaces para agentes',
  robots: 'robots.txt',
  bots: 'los bots de búsqueda pueden leer el sitio',
}

const S = {
  es: {
    asuntoSemana: (n: string, k: number) => `${n}: ${k === 1 ? '1 cosa' : `${k} cosas`} para probar esta semana`,
    asuntoOrden: (n: string) => `${n}: todo en orden esta semana`,
    hola: (d: string) => `Tu semana en <strong>${d}</strong>.`,
    semana: (k: number) => (k === 1 ? 'Esta semana probemos con esto' : `Esta semana probemos con ${k === 2 ? 'estas 2' : `estas ${k}`}`),
    semanaPie: 'Están en el orden en que conviene hacerlas. Si alguna no va, descártala desde su página y la próxima semana te propongo otra.',
    ver: 'Ver la tarea',
    orden: 'No hay nada que te convenga cambiar esta semana. Sigo midiendo y te aviso cuando algo se mueva.',
    movido: 'Qué se hizo',
    nadaHecho: 'Esta semana no se verificó ningún cambio en tu sitio.',
    cambio: 'Qué cambió esta semana',
    detalle: 'El detalle',
    cortoPuntaje: (p: string) => `Puntaje: ${p}`,
    cortoCitas: (c: string, previa: string | null) => `Te citan en ${c} de las respuestas${previa ? ` (antes ${previa})` : ''}`,
    plan: 'Tu plan',
    sinPlan: (url: string) => `<strong>Todavía no tienes un plan.</strong> <a href="${url}">Cuéntale tu objetivo al agente</a> y arma uno para tu negocio.`,
    puntaje: 'Qué tan listo está tu sitio para los agentes',
    vsSemana: 'frente a la semana pasada',
    sinPuntaje: 'sin dato',
    arreglar: 'Qué arreglar',
    tecnico: (t: number) => `<strong>Estado técnico</strong>: las ${t} revisiones pasan. No hay nada que arreglar.`,
    pagos: (c: number, r: string) => `<strong>Pagos</strong>: ${c} pedidos pagados, $${r} para ti`,
    visitas: (t: number, pagadas: string) => `<strong>Quién te visitó</strong>: ${t} pedidos de agentes${pagadas}.`,
    pagadas: (p: number) => `, ${p} pagados`,
    bots: (b: string) => ` Bots de IA que leyeron tus archivos para agentes: ${b}.`,
    sinBots: ' Ningún bot de IA leyó tus archivos para agentes esta semana.',
    citas: (s: string, previa: string | null) => `<strong>Asistentes de IA</strong>: citan tu sitio en ${s} de las respuestas a tus preguntas${previa ? ` (${previa} la vez anterior)` : ''}.`,
    enLugar: (c: string) => ` En tu lugar aparecen: ${c}.`,
    comprador: '¿Te elegiría un agente que compra?',
    tareas: (k: number) => `<strong>Todas las tareas abiertas</strong> (${k}). Conecta Claude Code o Cursor a Peaje una vez y pídele "trabaja las tareas de Peaje": lee cada una, la aplica en tu código y Peaje la revisa en el sitio publicado.`,
    esperando: ' · esperando que se publique',
    enCurso: ' · en curso',
    verTareas: 'Ver las tareas y cómo conectar',
    pie: (url: string) => `<a href="${url}">Abrir tu dashboard</a>. Responde este correo si quieres que el agente de Peaje revise algo puntual.`,
    tipo: { content: 'contenido', route: 'ruta', fix: 'arreglo' } as Record<string, string>,
  },
  en: {
    asuntoSemana: (n: string, k: number) => `${n}: ${k === 1 ? '1 thing' : `${k} things`} to try this week`,
    asuntoOrden: (n: string) => `${n}: all clear this week`,
    hola: (d: string) => `Your week at <strong>${d}</strong>.`,
    semana: (k: number) => (k === 1 ? 'This week, let us try this' : `This week, let us try these ${k}`),
    semanaPie: 'They are in the order worth doing them. If one does not fit, dismiss it from its page and I will propose another next week.',
    ver: 'See the task',
    orden: 'There is nothing worth changing this week. I keep measuring and will tell you when something moves.',
    movido: 'What got done',
    nadaHecho: 'No change on your site was verified this week.',
    cambio: 'What changed this week',
    detalle: 'The detail',
    cortoPuntaje: (p: string) => `Score: ${p}`,
    cortoCitas: (c: string, previa: string | null) => `Cited in ${c} of the answers${previa ? ` (was ${previa})` : ''}`,
    plan: 'Your plan',
    sinPlan: (url: string) => `<strong>No plan yet.</strong> <a href="${url}">Tell the agent your goal</a> and it builds one for this business.`,
    puntaje: 'Agent-readiness score',
    vsSemana: 'vs last week',
    sinPuntaje: 'not available',
    arreglar: 'What to fix',
    tecnico: (t: number) => `<strong>Technical status</strong>: all ${t} checks pass. Nothing to fix.`,
    pagos: (c: number, r: string) => `<strong>Payments</strong>: ${c} paid requests, $${r} for you`,
    visitas: (t: number, pagadas: string) => `<strong>Who visited</strong>: ${t} requests from agents${pagadas}.`,
    pagadas: (p: number) => `, ${p} paid`,
    bots: (b: string) => ` AI bots that read your agent files: ${b}.`,
    sinBots: ' No AI bot read your agent files this week.',
    citas: (s: string, previa: string | null) => `<strong>Answer engines</strong>: they cite your site in ${s} of the answers to your questions${previa ? ` (${previa} last time)` : ''}.`,
    enLugar: (c: string) => ` Showing up instead: ${c}.`,
    comprador: 'Would a buying agent pick you?',
    tareas: (k: number) => `<strong>All open tasks</strong> (${k}). Connect Claude Code or Cursor to Peaje once and ask it to "work through the Peaje tasks": it reads each one, applies it in your repo, and Peaje checks it on the live site.`,
    esperando: ' · waiting for the deploy',
    enCurso: ' · in progress',
    verTareas: 'See the tasks and how to connect',
    pie: (url: string) => `<a href="${url}">Open your dashboard</a>. Reply to this email if you want the Peaje agent to look at something specific.`,
    tipo: { content: 'content', route: 'route', fix: 'fix' } as Record<string, string>,
  },
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`)
const conDelta = (r: Reporte, vs: string) => `${r.score}${r.scorePrevio !== null && r.scorePrevio !== undefined ? ` (${r.score! - r.scorePrevio >= 0 ? '+' : ''}${r.score! - r.scorePrevio} ${vs})` : ''}`

/** Qué cambió, en una línea para el chat: puntaje y citas con su comparación. Vacío si no hay ninguno de los dos. */
function lineaCambio(r: Reporte): string {
  const s = S[r.idioma]
  const partes: string[] = []
  if (typeof r.score === 'number') partes.push(s.cortoPuntaje(conDelta(r, s.vsSemana)))
  if (r.citacion) partes.push(s.cortoCitas(pct(r.citacion.share), r.citacion.previa !== null ? pct(r.citacion.previa) : null))
  return partes.length ? `${s.cambio}: ${partes.join('. ')}.` : ''
}

/** Las propuestas de la semana como texto corto (Telegram, Slack): markdown mínimo. */
export function textoSemana(r: Reporte): string {
  const s = S[r.idioma]
  const cambio = lineaCambio(r)
  if (r.semana.length === 0) return cambio ? `${s.orden}\n\n${cambio}` : s.orden
  return [
    `**${s.semana(r.semana.length)}**`,
    ...r.semana.map((p, i) => `${i + 1}. **${p.titulo}** (${TEXTO_IMPACTO[r.idioma][p.impacto]}, ${TEXTO_ESFUERZO[r.idioma][p.esfuerzo]})\n${p.porQue}`),
    ...(cambio ? [cambio] : []),
  ].join('\n\n')
}

/**
 * El correo de la semana. Abre con lo que Peaje propone hacer (pocas cosas, en
 * orden, cada una con lo que midió para proponerla); los números van después.
 * En el idioma del dueño. Los textos que vienen de otros módulos (avance del
 * plan, seguimientos) todavía salen en inglés.
 */
export function htmlSemanal(tenant: Tenant, r: Reporte): { subject: string; html: string } {
  const s = S[r.idioma]
  const es = r.idioma === 'es'
  const subject = r.semana.length ? s.asuntoSemana(tenant.name, r.semana.length) : s.asuntoOrden(tenant.name)
  const semana = r.semana.length
    ? `<p style="font-size:17px"><strong>${s.semana(r.semana.length)}</strong></p><ol>${r.semana
        .map(
          (p) =>
            `<li style="margin-bottom:12px"><strong>${esc(p.titulo)}</strong> <span style="color:#666">· ${TEXTO_IMPACTO[r.idioma][p.impacto]} · ${TEXTO_ESFUERZO[r.idioma][p.esfuerzo]}</span><br>${esc(p.porQue)}<br><a href="${esc(p.url)}">${s.ver}</a></li>`,
        )
        .join('')}</ol><p style="color:#666;font-size:13px">${s.semanaPie}</p>`
    : `<p style="font-size:17px"><strong>${s.orden}</strong></p>`
  const filasRutas = r.pagos.porRuta.map((x) => `<tr><td style="padding:4px 8px">${esc(x.path)}</td><td style="padding:4px 8px;text-align:right">${x.count}</td><td style="padding:4px 8px;text-align:right">$${x.revenue}</td></tr>`).join('')
  const visitas = r.visitas ? `<p>${s.visitas(r.visitas.total, r.cobros ? s.pagadas(r.visitas.pagadas) : '')}${r.visitas.bots.length ? s.bots(esc(r.visitas.bots.join(', '))) : s.sinBots}</p>` : ''
  const nombre = (id: string) => (es ? NOMBRE_CHEQUEO_ES[id] : NOMBRE_CHEQUEO[id]) ?? id
  const motivo = (f: Reporte['fallando'][number]) => (es ? (ARREGLO[f.motivo as Motivo]?.es ?? f.texto) : f.texto)
  const fallando = r.fallando.length
    ? `<p><strong>${s.arreglar}</strong></p><ul>${r.fallando.map((f) => `<li>${esc(nombre(f.id))}: ${esc(motivo(f))}</li>`).join('')}</ul><pre style="${mono}">${esc(r.comando)}</pre>`
    : `<p>${s.tecnico(r.chequeosTotal)}</p>`
  const plan = r.plan
    ? `<p><strong>${s.plan}</strong>: ${esc(r.plan.resumen)}</p><ol>${r.plan.pasos.map((p) => `<li>${p.hecho ? '✓ ' : ''}${esc(p.titulo)} <br><span style="color:#666">${esc(p.avance)}</span></li>`).join('')}</ol>`
    : `<p>${s.sinPlan(esc(r.agenteUrl))}</p>`
  const citacion = r.citacion
    ? `<p>${s.citas(pct(r.citacion.share), r.citacion.previa !== null ? pct(r.citacion.previa) : null)}${r.citacion.competidores.length ? s.enLugar(esc(r.citacion.competidores.join(', '))) : ''}</p>`
    : ''
  const tareas = r.tareas.length
    ? `<p>${s.tareas(r.tareas.length)}</p><ol>${r.tareas.map((t) => `<li>${esc(t.titulo)} <span style="color:#666">· ${esc(s.tipo[t.tipo] ?? t.tipo)}${t.estado === 'done' ? s.esperando : t.estado === 'in_progress' ? s.enCurso : ''}</span></li>`).join('')}</ol><p><a href="${esc(r.agenteUrl)}">${s.verTareas}</a></p>`
    : ''
  // ---- M6: qué se publicó o arregló y qué movió ----
  const movido = r.movido?.length
    ? `<p><strong>${s.movido}</strong></p><ul>${r.movido.map((m) => `<li><strong>${m.url ? `<a href="${esc(m.url)}">${esc(m.titulo)}</a>` : esc(m.titulo)}</strong><br>${esc(m.linea)}</li>`).join('')}</ul>`
    : `<p><strong>${s.movido}</strong></p><p>${s.nadaHecho}</p>`
  // ---- M7: comprador misterioso, un párrafo ----
  const comprador = r.comprador
    ? `<p><strong>${s.comprador}</strong> ${esc(r.comprador.resumen)}${r.comprador.veredictos[0] ? ` ${esc(r.comprador.veredictos.find((v) => !v.includes('would buy from you')) ?? r.comprador.veredictos[0])}` : ''}${r.comprador.problemas[0] ? ` ${esc(r.comprador.problemas[0])}` : ''}</p>`
    : ''
  const score = r.score !== null ? conDelta(r, s.vsSemana) : s.sinPuntaje
  const html = `<div style="${estilo}">
<p>${s.hola(esc(r.dominio))}</p>
${semana}
${movido}
<p style="font-size:17px"><strong>${s.cambio}</strong></p>
<p><strong>${s.puntaje}</strong>: ${score}.</p>
${citacion}
${visitas}
${r.cobros ? `<p>${s.pagos(r.pagos.count, r.pagos.revenue)}${r.pagos.porRuta.length ? `:</p><table style="border-collapse:collapse;font-size:14px">${filasRutas}</table>` : '.</p>'}` : ''}
<p style="font-size:17px"><strong>${s.detalle}</strong></p>
${plan}
${fallando}
${comprador}
${tareas}
<p>${s.pie(esc(r.kitUrl))}</p>
</div>`
  return { subject, html }
}
