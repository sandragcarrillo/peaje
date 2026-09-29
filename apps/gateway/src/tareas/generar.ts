import type { Chequeo } from '@peaje/shared'
import type { NewAgentTask, Tenant } from '@peaje/db'
import { dominioVerificable, slugify } from '@peaje/shared'
import { store } from '../store.js'
import { NOMBRE_CHEQUEO, TEXTO_MOTIVO } from '../monitor/email.js'
import { sugerirContenido } from '../monitor/reporte.js'
import { completarTarea } from './verificar.js'
import { revisarAcceso } from '../acceso/revisar.js'

/**
 * Las tareas que el agente deja para el coding agent del dueño. Tres fuentes:
 *
 *   fix      un chequeo del verificador que falla (proxy, robots, bots...)
 *   content  una página que los motores de respuesta citarían y el sitio no tiene
 *   route    un path que los agentes pidieron y el origen no tiene (404)
 *
 * El agente nunca toca el sitio: cada tarea es un prompt completo, con los
 * criterios que Peaje revisa al marcarla hecha. `key` deduplica.
 */

const CLI = 'npx @peaje/cli@1'

function promptFix(tenant: Tenant, c: Chequeo, soloAeo: boolean): string {
  const nombre = NOMBRE_CHEQUEO[c.id] ?? c.id
  const motivo = TEXTO_MOTIVO[c.motivo] ?? c.motivo
  return [
    `# Fix: ${nombre}`,
    '',
    `Peaje's daily check of ${dominioVerificable(tenant.originUrl)} found: ${motivo}.`,
    ...(c.faltantes?.length ? ['', 'Details:', ...c.faltantes.map((f) => `- ${f}`)] : []),
    '',
    '## What to do',
    '',
    `1. In the root of this site's repo, run \`${CLI} init ${tenant.slug}${soloAeo ? ' --only aeo' : ''} --yes\`. It detects the stack and applies only what is missing.`,
    '2. Apply anything it lists under "Still manual".',
    '3. Deploy.',
    `4. Run \`${CLI} verify ${tenant.slug} --wait 600\` until it passes.`,
    '5. Mark this task done. Peaje runs the same check and closes it.',
  ].join('\n')
}

function promptContenido(tenant: Tenant, dominio: string, s: { pregunta: string; respuesta: string; porQue: string; fuente: string }, slug: string): string {
  return [
    `# New page: ${s.pregunta}`,
    '',
    `Answer engines (ChatGPT, Perplexity, Google AI, Claude) get asked this and ${tenant.name} has no page that answers it. Create one.`,
    '',
    '## The page',
    '',
    `- URL: \`https://${dominio}/${slug}\` (or the closest slug that fits this site's routing).`,
    `- Title and H1: exactly "${s.pregunta}".`,
    `- First paragraph: the direct answer in two or three sentences. Outline: ${s.respuesta}`,
    `- Use only facts that are on the site. Source for this one: ${s.fuente}`,
    '- Add at least one concrete number from the business (a price, a limit, a count) and say where it comes from.',
    '- Then 3 to 5 short sections, each answering a follow-up question someone would ask next, each self-contained.',
    '- A visible "Updated <date>" line.',
    "- Link it from the site's navigation or footer, and add it to the sitemap.",
    '',
    `Why an answer engine would cite it: ${s.porQue}`,
    '',
    '## When done',
    '',
    'Deploy, then mark this task done with the live URL. Peaje checks that the page answers on the live site.',
  ].join('\n')
}

function promptRuta(tenant: Tenant, dominio: string, path: string, visitas: number): string {
  return [
    `# Agents asked for ${path}`,
    '',
    `In the last 30 days, ${visitas} requests from agents asked for \`GET https://${dominio}${path}\` and the site answered 404. That is demand ${tenant.name} is not serving.`,
    '',
    '## What to do',
    '',
    `1. Decide whether this site can answer \`${path}\` with its own data. If it cannot, dismiss this task and say why.`,
    `2. If it can, add a route handler for \`GET ${path}\` that returns JSON. Keep the response small and documented (fields and units).`,
    '3. Deploy.',
    `4. Put a price on it in Peaje: dashboard, Routes, "Priced API routes" (method GET, path \`${path}\`, a description written for agents). The 402 then answers on this domain.`,
    '5. Mark this task done with the live URL.',
  ].join('\n')
}

function promptBloqueo(dominio: string, bot: string, producto: string, por: 'robots' | 'firewall'): string {
  return por === 'robots'
    ? [
        `# Let ${producto} read ${dominio}`,
        '',
        `\`https://${dominio}/robots.txt\` tells \`${bot}\` not to read the site. ${producto} uses that bot to read pages before citing them, so right now it cannot recommend you with a link.`,
        '',
        '## What to do',
        '',
        `Add a group for it at the top of robots.txt (or in app/robots.ts if the site generates it):`,
        '',
        '```',
        `User-agent: ${bot}`,
        'Allow: /',
        '```',
        '',
        'If you want to keep AI companies from training on the site, block the training bots instead (GPTBot, ClaudeBot, Google-Extended, CCBot). That does not affect recommendations.',
        '',
        'Deploy, then mark this task done.',
      ].join('\n')
    : [
        `# Your firewall blocks ${producto}`,
        '',
        `Peaje opened https://${dominio}/ with the user-agent of \`${bot}\` and got blocked (403, 429 or a challenge page), while a normal browser gets the page. ${producto} cannot read or cite what it cannot open.`,
        '',
        '## What to do',
        '',
        '- Cloudflare: Security, Bots. "Block AI bots" blocks the bots that answer as well as the ones that train. Turn it off and block only training bots with a WAF rule, or allow verified bots. Check "Bot Fight Mode" too.',
        '- Vercel: Firewall, check that no rule or Attack Challenge Mode blocks this user-agent.',
        '- Other hosts or a WAF: allow this user-agent on the pages you want recommended.',
        '',
        'Then mark this task done. Peaje opens the site as that bot again.',
      ].join('\n')
}

function promptFrescura(url: string, fecha: string | null): string {
  return [
    `# ${fecha ? 'Refresh' : 'Date'} ${url}`,
    '',
    fecha
      ? `The newest date on this page is ${fecha}. Pages AI assistants cite tend to be recent, and they read the date on the page.`
      : 'This page shows no date a reader or an AI assistant can see. Pages AI assistants cite tend to show when they were last updated.',
    '',
    '## What to do',
    '',
    '1. Review the facts on the page (prices, numbers, names, links) and update anything that changed. Use only real facts from the business.',
    '2. Add a visible line near the top: "Updated <month> <year>", and the same date in a `<time datetime="YYYY-MM-DD">` tag.',
    '3. If the site has a sitemap, update this page\'s `<lastmod>`.',
    '4. Deploy and mark this task done.',
  ].join('\n')
}

/** Tareas de arreglo: una por chequeo que falla; las que ya pasan se cierran solas. */
export async function sincronizarFixes(tenant: Tenant): Promise<{ creadas: number; cerradas: number }> {
  const v = await store.lastVerification(tenant.id)
  if (!v) return { creadas: 0, cerradas: 0 }
  const chequeos = v.checks as Chequeo[]
  const fallando = chequeos.filter((c) => !c.ok && c.id !== 'dominio')
  const soloAeo = fallando.every((c) => ['json-ld', 'robots', 'bots'].includes(c.id))
  let creadas = 0
  for (const c of fallando) {
    const nueva: NewAgentTask = {
      tenantId: tenant.id,
      key: `fix:${c.id}`,
      kind: 'fix',
      title: `Fix ${NOMBRE_CHEQUEO[c.id] ?? c.id}`,
      summary: TEXTO_MOTIVO[c.motivo] ?? c.motivo,
      body: promptFix(tenant, c, soloAeo),
      acceptance: [{ type: 'check', id: c.id }],
      source: 'monitor',
    }
    if ((await store.upsertTask(nueva)).created) creadas += 1
  }
  // Las que pasan en la última corrida: cerradas por el propio monitor.
  let cerradas = 0
  const ok = new Set<string>(chequeos.filter((c) => c.ok).map((c) => c.id))
  for (const t of await store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done'] })) {
    if (t.kind !== 'fix') continue
    const id = t.key.slice('fix:'.length)
    if (!ok.has(id)) continue
    await store.updateTask(tenant.id, t.id, { status: 'verified', verifiedAt: new Date().toISOString(), note: 'Passes in the latest daily check.' })
    cerradas += 1
  }
  return { creadas, cerradas }
}

/** Vuelve a revisar las tareas marcadas hechas que todavía no pasaban. */
export async function reverificarHechas(tenant: Tenant): Promise<number> {
  let verificadas = 0
  for (const t of await store.listTasks(tenant.id, { statuses: ['done'] })) {
    const r = await completarTarea(tenant, t, t.doneUrl, store)
    if (r.status === 'verified') verificadas += 1
  }
  return verificadas
}

export async function generarTareas(tenant: Tenant, opciones: { conContenido?: boolean } = {}): Promise<{ creadas: number; actualizadas: number; cerradas: number }> {
  const dominio = dominioVerificable(tenant.originUrl)
  let creadas = 0
  let actualizadas = 0

  const fixes = await sincronizarFixes(tenant)
  creadas += fixes.creadas

  if (dominio) {
    // Acceso y frescura: bots que responden bloqueados y páginas sin fecha o viejas.
    const acceso = await revisarAcceso(tenant).catch(() => null)
    for (const b of acceso?.bloqueados ?? []) {
      const r = await store.upsertTask({
        tenantId: tenant.id,
        key: `fix:${b.por}:${b.bot}`,
        kind: 'fix',
        title: b.por === 'robots' ? `Let ${b.producto} read the site (robots.txt blocks ${b.bot})` : `Your firewall blocks ${b.producto} (${b.bot})`,
        summary: b.por === 'robots' ? `robots.txt tells ${b.bot} not to read the site, so ${b.producto} cannot cite it.` : `${b.bot} gets blocked at the edge, so ${b.producto} cannot read or cite the site.`,
        body: promptBloqueo(dominio, b.bot, b.producto, b.por),
        acceptance: [{ type: 'check', id: 'bots' }],
        source: 'access',
      })
      r.created ? (creadas += 1) : (actualizadas += 1)
    }
    for (const p of (acceso?.paginas ?? []).filter((x) => x.vieja).slice(0, 5)) {
      const ruta = new URL(p.url).pathname
      const r = await store.upsertTask({
        tenantId: tenant.id,
        key: `content:refresh:${ruta}`,
        kind: 'content',
        title: p.fecha ? `Refresh ${ruta}: last dated ${p.fecha}` : `Add a visible date to ${ruta}`,
        summary: p.fecha ? `The page looks ${Math.round((p.dias ?? 0) / 30)} months old; AI assistants favor recent pages.` : 'No readable date on the page; AI assistants favor pages that show when they were updated.',
        body: promptFrescura(p.url, p.fecha),
        acceptance: [{ type: 'url', url: p.url }],
        source: 'access',
      })
      r.created ? (creadas += 1) : (actualizadas += 1)
    }

    // Rutas pedidas que no existen: al menos dos pedidos en 30 días.
    const stats = await store.visitStats(tenant.id, { days: 30 }).catch(() => null)
    for (const nf of stats?.notFound ?? []) {
      if (nf.visits < 2) continue
      const r = await store.upsertTask({
        tenantId: tenant.id,
        key: `route:GET ${nf.path}`,
        kind: 'route',
        title: `Serve GET ${nf.path}: agents asked for it ${nf.visits} times`,
        summary: `Agents requested ${nf.path} and got a 404.`,
        body: promptRuta(tenant, dominio, nf.path, nf.visits),
        acceptance: [{ type: 'url', url: `https://${dominio}${nf.path}`, notStatus: 404 }],
        source: 'visits',
      })
      r.created ? (creadas += 1) : (actualizadas += 1)
    }

    if (opciones.conContenido) {
      for (const s of await sugerirContenido(tenant, dominio)) {
        const slug = slugify(s.pregunta).slice(0, 60) || 'faq'
        const r = await store.upsertTask({
          tenantId: tenant.id,
          key: `content:${slug}`,
          kind: 'content',
          title: s.pregunta,
          summary: s.porQue,
          body: promptContenido(tenant, dominio, s, slug),
          acceptance: [{ type: 'url', url: `https://${dominio}/${slug}` }],
          source: 'agent',
        })
        r.created ? (creadas += 1) : (actualizadas += 1)
      }
    }
  }

  return { creadas, actualizadas, cerradas: fixes.cerradas }
}
