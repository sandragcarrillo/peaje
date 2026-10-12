import { cachedScore, escanear, gradeDe, prevision, type OraScore } from '@/lib/ora'
import { dominioDeRadar } from '@/app/radar/dominio'

/**
 * El radar como API: lo que Peaje vende a los agentes en su propio dominio.
 * Con precio en el panel del sitio "peaje", proxy.ts responde el 402 antes de
 * llegar acá; esta función solo corre cuando el agente ya pagó (o en local,
 * donde la ruta no tiene precio).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ dominio: string }> }) {
  const { dominio: entrada } = await ctx.params
  const dominio = dominioDeRadar(decodeURIComponent(entrada))
  if (!dominio) {
    return Response.json({ error: 'invalid-domain', hint: 'Use a public domain, for example /api/radar/example.com' }, { status: 400 })
  }

  let score: OraScore | null = await cachedScore(dominio)
  if (!score) {
    const r = await escanear(dominio)
    if ('error' in r) {
      return Response.json(
        r.error === 'inalcanzable'
          ? { error: 'unreachable', hint: `${dominio} did not answer. Check the domain and that the site is published.` }
          : { error: 'scan-failed', hint: 'The scanner did not answer. Try again in a minute.' },
        { status: r.error === 'inalcanzable' ? 404 : 502 },
      )
    }
    score = r.score
  }

  const p = prevision(score)
  const pasan: { id: string; name: string }[] = []
  for (const layer of score.layers) for (const c of layer.checks) if (c.status === 'pass') pasan.push({ id: c.id, name: c.name })

  return Response.json({
    domain: score.domain,
    score: p.actual,
    grade: gradeDe(p.actual),
    upToWithPeaje: p.estimado,
    upToGradeWithPeaje: gradeDe(p.estimado),
    scannedAt: score.scannedAt ?? null,
    passing: pasan,
    missing: p.arreglables.map((a) => ({
      id: a.check.id,
      name: a.check.name,
      points: a.check.estScoreGain ?? a.check.maxScore,
      fixedBy: a.viaGateway ? 'peaje-gateway' : a.bloque,
    })),
    source: 'Score measured by Ora (ora.ai). The value with Peaje is an estimate of what the kit fixes.',
    page: `https://usepeaje.com/radar?d=${encodeURIComponent(score.domain)}`,
  })
}
