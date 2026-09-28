import type { Chequeo } from '@peaje/shared'
import type { NewAgentTask, Tenant } from '@peaje/db'
import { dominioVerificable, slugify } from '@peaje/shared'
import { store } from '../store.js'
import { NOMBRE_CHEQUEO, TEXTO_MOTIVO } from '../monitor/email.js'
import { sugerirContenido } from '../monitor/reporte.js'
import { completarTarea } from './verificar.js'

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
