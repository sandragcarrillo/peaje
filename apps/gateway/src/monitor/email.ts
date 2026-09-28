import type { Tenant } from '@peaje/db'
import type { Reporte } from './reporte.js'

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

export async function enviarCorreo(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.AGENTS_FROM_EMAIL
  if (!key || !from) throw new Error('Falta RESEND_API_KEY o AGENTS_FROM_EMAIL en el gateway')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
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

export function htmlSemanal(tenant: Tenant, r: Reporte): { subject: string; html: string } {
  const subject = `${tenant.name} this week: ${r.chequeosOk} of ${r.chequeosTotal} checks ok${r.score !== null ? `, score ${r.score}` : ''}, ${r.pagos.count} paid requests`
  const filasRutas = r.pagos.porRuta.map((x) => `<tr><td style="padding:4px 8px">${esc(x.path)}</td><td style="padding:4px 8px;text-align:right">${x.count}</td><td style="padding:4px 8px;text-align:right">$${x.revenue}</td></tr>`).join('')
  const visitas = r.visitas
    ? `<p><strong>Who visited</strong>: ${r.visitas.total} requests from agents, ${r.visitas.pagadas} paid. ${r.visitas.bots.length ? `AI bots that read your agent files: ${esc(r.visitas.bots.join(', '))}.` : 'No AI bot read your agent files this week.'}</p>`
    : ''
  const fallando = r.fallando.length
    ? `<p><strong>What to fix</strong></p><ul>${r.fallando.map((f) => `<li>${esc(NOMBRE_CHEQUEO[f.id] ?? f.id)}: ${esc(f.texto)}</li>`).join('')}</ul><pre style="${mono}">${esc(r.comando)}</pre>`
    : `<p><strong>Technical status</strong>: all ${r.chequeosTotal} checks pass. Nothing to fix.</p>`
  const tareas = r.tareas.length
    ? `<p><strong>Tasks for your coding agent</strong> (${r.tareas.length} open). Connect Claude Code or Cursor to Peaje once and ask it to "work through the Peaje tasks": it reads each one, applies it in your repo, and Peaje checks it on the live site.</p><ol>${r.tareas.map((t) => `<li>${esc(t.titulo)} <span style="color:#666">· ${esc(t.tipo)}${t.estado === 'done' ? ' · waiting for the deploy' : t.estado === 'in_progress' ? ' · in progress' : ''}</span></li>`).join('')}</ol><p><a href="${esc(r.agenteUrl)}">See the tasks and how to connect</a></p>`
    : ''
  const contenido = r.contenido.length
    ? `<p><strong>Content to create</strong> (pages answer engines would cite):</p><ol>${r.contenido.map((c) => `<li><strong>${esc(c.pregunta)}</strong><br>${esc(c.respuesta)}<br><span style="color:#666">${esc(c.porQue)} · <a href="${esc(c.fuente)}">source</a></span></li>`).join('')}</ol>`
    : ''
  const html = `<div style="${estilo}">
<p>Your week at <strong>${esc(r.dominio)}</strong>.</p>
<p><strong>Agent-readiness score</strong>: ${r.score !== null ? `${r.score}${r.scorePrevio !== null ? ` (${r.score - r.scorePrevio >= 0 ? '+' : ''}${r.score - r.scorePrevio} vs last week)` : ''}` : 'not available'}.</p>
${fallando}
<p><strong>Payments</strong>: ${r.pagos.count} paid requests, $${r.pagos.revenue} for you${r.pagos.porRuta.length ? `:</p><table style="border-collapse:collapse;font-size:14px">${filasRutas}</table>` : '.</p>'}
${visitas}
${tareas}
${contenido}
<p><a href="${esc(r.kitUrl)}">Open your dashboard</a>. Reply to this email if you want the Peaje agent to look at something specific.</p>
</div>`
  return { subject, html }
}
