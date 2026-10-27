import type { AgentMessageLink, AgentTask, Tenant } from '@peaje/db'
import { DASHBOARD } from '../monitor/reporte.js'

/**
 * Las tarjetas que el agente deja bajo una respuesta corta: abren el reporte
 * completo en el dashboard (detrás del login del dueño). Telegram y Slack las
 * muestran como botones con URL; el chat del dashboard, como tarjetas.
 */

type Idioma = 'es' | 'en'

const base = (tenant: Pick<Tenant, 'slug'>) => `${DASHBOARD}/t/${encodeURIComponent(tenant.slug)}/agente`

/** Las páginas que conviene crear, ordenadas, con su formato y su tarea. */
export function tarjetaOportunidades(tenant: Pick<Tenant, 'slug'>, idioma: Idioma = 'es'): AgentMessageLink {
  return { label: idioma === 'es' ? 'Ver oportunidades de contenido' : 'See content opportunities', url: `${base(tenant)}/oportunidades`, kind: 'report' }
}

/** A quién cita la IA en lugar del negocio, por pregunta y por motor, y qué formatos gana. */
export function tarjetaCitas(tenant: Pick<Tenant, 'slug'>, idioma: Idioma = 'es'): AgentMessageLink {
  return { label: idioma === 'es' ? 'Ver a quién cita la IA' : 'See who AI cites instead', url: `${base(tenant)}/citas`, kind: 'report' }
}

/** Una tarea: el borrador completo de la página y las instrucciones para publicarla. */
export function tarjetaTarea(tenant: Pick<Tenant, 'slug'>, task: Pick<AgentTask, 'id' | 'title' | 'kind'>, idioma: Idioma = 'es'): AgentMessageLink {
  const corto = task.title.length > 48 ? `${task.title.slice(0, 47).trimEnd()}…` : task.title
  const prefijo = task.kind === 'content' ? (idioma === 'es' ? 'Página' : 'Page') : idioma === 'es' ? 'Tarea' : 'Task'
  // Una página abre en Contenido, con su etapa, evidencia y borrador; las demás tareas en su detalle.
  const url = task.kind === 'content' ? `${base(tenant)}/contenido?id=${encodeURIComponent(task.id)}` : `${base(tenant)}/tareas/${encodeURIComponent(task.id)}`
  return { label: `${prefijo}: ${corto}`, url, kind: 'task' }
}

/** Una página publicada (o la URL donde va a vivir). */
export function tarjetaPagina(url: string, idioma: Idioma = 'es'): AgentMessageLink {
  return { label: idioma === 'es' ? 'Abrir la página' : 'Open the page', url, kind: 'page' }
}

/** Los reportes que el agente puede abrir con open_report. */
export const REPORTES = ['opportunities', 'citations'] as const
export type Reporte = (typeof REPORTES)[number]

export function tarjetaReporte(tenant: Pick<Tenant, 'slug'>, reporte: Reporte, idioma: Idioma = 'es'): AgentMessageLink {
  return reporte === 'opportunities' ? tarjetaOportunidades(tenant, idioma) : tarjetaCitas(tenant, idioma)
}
