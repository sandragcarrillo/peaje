import { cachedScore, escanear, gradeDe, prevision, type OraScore } from '@/lib/ora'
import { dominioDeRadar } from '@/app/radar/dominio'

/**
 * El radar como API: lo que Peaje vende a los agentes en su propio dominio.
 * Es también el origen de la ruta `GET /api/radar/:dominio` del sitio "peaje"
 * en el gateway, y por eso de la tool `get_api_radar_by_dominio` de su MCP
 * (docs/sql/peaje-radar-route.sql): el gateway llama acá con la prueba de
 * origen y devuelve este JSON tal cual.
 *
 * A precio 0 la ruta no entra al manifiesto del proxy: usepeaje.com/api/radar
 * sigue llegando directo acá, gratis, como hoy. Con precio, proxy.ts responde
 * el 402 antes de llegar acá (necesita PEAJE_ORIGIN_SECRET en el hosting) y
 * esta función solo corre cuando el agente ya pagó.
 */

// Un scan fresco de Ora tarda unos 30 s y escanear() espera hasta 90 s.
export const maxDuration = 120

/** Cuántos arreglos van en `topFixes`: los que más suben el score, de Peaje o del sitio. */
const TOP = 5

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

  // Lo que arregla Peaje (la previsión), con los puntos de siempre, de lo que más suma a lo que menos.
  const faltan = p.arreglables
    .map((a) => ({
      id: a.check.id,
      name: a.check.name,
      points: a.check.estScoreGain ?? a.check.maxScore,
      fixedBy: a.viaGateway ? 'peaje-gateway' : a.bloque,
      ...(a.check.recommendation ? { how: a.check.recommendation } : {}),
    }))
    .sort((x, y) => (y.points ?? 0) - (x.points ?? 0))

  // Los arreglos que más suben el score, los haga Peaje o no (fixedBy null: le
  // toca al sitio). `points` es lo que Ora estima que sube el score total;
  // null si Ora no lo estima, y esos van al final.
  const dePeaje = new Map(faltan.map((f) => [f.id, f.fixedBy]))
  const vistos = new Set<string>()
  const arreglos: { id: string; name: string; points: number | null; fixedBy: string | null; how?: string; falta: number }[] = []
  for (const layer of score.layers) {
    for (const c of layer.checks) {
      if (c.status === 'pass' || c.status === 'na' || c.status === 'not_applicable' || vistos.has(c.id)) continue
      vistos.add(c.id)
      arreglos.push({
        id: c.id,
        name: c.name,
        points: typeof c.estScoreGain === 'number' ? c.estScoreGain : null,
        fixedBy: dePeaje.get(c.id) ?? null,
        ...(c.recommendation ? { how: c.recommendation } : {}),
        falta: (c.maxScore ?? 0) - (c.score ?? 0),
      })
    }
  }
  arreglos.sort((x, y) => (y.points ?? -1) - (x.points ?? -1) || y.falta - x.falta)
  const topFixes = arreglos.slice(0, TOP).map(({ falta: _f, ...a }) => a)

  return Response.json({
    domain: score.domain,
    score: p.actual,
    grade: gradeDe(p.actual),
    upToWithPeaje: p.estimado,
    upToGradeWithPeaje: gradeDe(p.estimado),
    scannedAt: score.scannedAt ?? null,
    topFixes,
    passing: pasan,
    missing: faltan,
    source: 'Score measured by Ora (ora.ai). The value with Peaje is an estimate of what the kit fixes.',
    page: `https://usepeaje.com/radar?d=${encodeURIComponent(score.domain)}`,
  })
}
