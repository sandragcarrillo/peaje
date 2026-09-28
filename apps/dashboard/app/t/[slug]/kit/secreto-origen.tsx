import { secretoOrigen } from '@peaje/shared'
import { getDict } from '@/lib/i18n'

/**
 * PEAJE_ORIGIN_SECRET del negocio: lo que el sitio necesita en su entorno para
 * cobrar las rutas de API en su dominio. Solo se muestra con sesión (la página
 * del kit ya lo exige); el kit público nunca lo lleva.
 */
export async function SecretoOrigen({ embedSecret }: { embedSecret: string }) {
  const { kit: d } = await getDict()
  const valor = await secretoOrigen(embedSecret)
  return (
    <div className="border border-border p-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{d.secretoTitulo}</span>
      <p className="mt-2 text-sm text-muted">{d.secretoIntro}</p>
      <pre className="mt-3 overflow-x-auto bg-panel-2 px-3 py-2 font-mono text-xs">PEAJE_ORIGIN_SECRET={valor}</pre>
      <p className="mt-2 text-xs text-muted">{d.secretoNota}</p>
    </div>
  )
}
