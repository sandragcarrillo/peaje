/**
 * Dispara el monitor en el gateway que está corriendo. Lo usa el cron de
 * Railway (ver docs/monitor.md):
 *   tsx src/monitor/cli.ts daily    → POST /internal/monitor/run
 *   tsx src/monitor/cli.ts weekly   → POST /internal/monitor/weekly
 * Necesita GATEWAY_INTERNAL_URL e INTERNAL_API_SECRET.
 */
export {}

const modo = process.argv[2] === 'weekly' ? 'weekly' : 'run'
const base = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_PUBLIC_URL
const secret = process.env.INTERNAL_API_SECRET
if (!base || !secret) {
  console.error('Faltan GATEWAY_INTERNAL_URL (o GATEWAY_PUBLIC_URL) e INTERNAL_API_SECRET')
  process.exit(1)
}
const res = await fetch(`${base.replace(/\/$/, '')}/internal/monitor/${modo}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(25 * 60_000),
})
const cuerpo = await res.text()
console.log(`${modo}: ${res.status} ${cuerpo.slice(0, 2_000)}`)
process.exit(res.ok ? 0 : 1)
