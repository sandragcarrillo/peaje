import { getDict } from '@/lib/i18n'
import { store } from '@/lib/store'

/** Línea "Última verificación: hace X · N de 7 ok" que escribe el monitor diario. */
export async function UltimaVerificacion({ tenantId }: { tenantId: string }) {
  const { kit: d } = await getDict()
  const v = await store.lastVerification(tenantId).catch(() => null)
  const checks = (v?.checks ?? []) as { ok: boolean }[]
  const min = v ? Math.max(0, Math.round((Date.now() - new Date(v.runAt).getTime()) / 60_000)) : null
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
      {d.monitorUltima}: {v && min !== null ? `${d.monitorHace(min)} · ${d.monitorOk(checks.filter((c) => c.ok).length, checks.length)}` : d.monitorNunca}
    </p>
  )
}
