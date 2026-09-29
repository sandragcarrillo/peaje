'use client'

import type { PlanDelNegocio } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'

export function Plan({ plan }: { plan: PlanDelNegocio | null }) {
  const { miAgente: t } = useDict()
  if (!plan) return <p className="text-sm text-muted">{t.sinPlan}</p>
  return (
    <div className="space-y-3">
      <p className="text-sm">{plan.summary}</p>
      <ol className="divide-y divide-border border border-border">
        {plan.steps.map((s, i) => (
          <li key={i} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {s.done ? '✓ ' : `${i + 1}. `}
                {s.title}
              </span>
              <span className="font-mono text-xs text-muted">
                {t.metricas[s.metric] ?? s.metric}: {s.baseline ?? t.sinMedir} {t.pasoAntes} · {s.current ?? t.sinMedir} {t.pasoAhora} · {s.target} {t.pasoMeta}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{s.why}</p>
            <p className="mt-1 text-xs">{s.deliverable}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
