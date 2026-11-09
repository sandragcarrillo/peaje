// El reloj del monitor: qué toca a cada hora, y que el diario y el semanal
// corren una sola vez por período aunque haya otra réplica o un reinicio.
// Store en memoria, sin red: los trabajos son contadores.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-reloj-monitor-0123456789abcdef0123456789ab',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
})

const { corridasDebidas, crearReloj } = await import('../src/monitor/reloj.js')

const en = (iso: string) => corridasDebidas(new Date(iso)).map((c) => `${c.job}:${c.period}`)

test('qué toca: diario desde las 11 UTC, semanal desde el lunes 12 UTC hasta el domingo', () => {
  assert.deepEqual(en('2026-11-09T10:59:00Z'), [])
  assert.deepEqual(en('2026-11-09T11:00:00Z'), ['diario:2026-11-09'])
  assert.deepEqual(en('2026-11-09T12:00:00Z'), ['diario:2026-11-09', 'semanal:2026-11-09'])
  assert.deepEqual(en('2026-11-15T10:00:00Z'), ['semanal:2026-11-09'])
  assert.deepEqual(en('2026-11-08T23:00:00Z'), ['diario:2026-11-08', 'semanal:2026-11-02'])
})

function contadores(falla?: 'diario') {
  const n = { diario: 0, semanal: 0, agendas: 0 }
  return {
    n,
    trabajos: {
      diario: async () => {
        n.diario++
        if (falla === 'diario') throw new Error('se cayó')
        return { tenants: 1 }
      },
      semanal: async () => {
        n.semanal++
        return { enviados: ['peaje'], errores: [] }
      },
      agendas: async () => {
        n.agendas++
        return { due: 0, results: [] }
      },
    },
  }
}

test('cada período corre una vez, también con un segundo proceso; las agendas cada 5 minutos', async () => {
  const a = contadores()
  const reloj = crearReloj(a.trabajos)
  await reloj.tick(new Date('2026-11-16T12:30:00Z'))
  assert.deepEqual(a.n, { diario: 1, semanal: 1, agendas: 1 })
  await reloj.tick(new Date('2026-11-16T12:31:00Z'))
  assert.deepEqual(a.n, { diario: 1, semanal: 1, agendas: 1 })
  await reloj.tick(new Date('2026-11-16T12:36:00Z'))
  assert.deepEqual(a.n, { diario: 1, semanal: 1, agendas: 2 })

  // Otra réplica o el proceso después de un reinicio: la toma está en la base.
  const b = contadores()
  await crearReloj(b.trabajos).tick(new Date('2026-11-16T12:40:00Z'))
  assert.deepEqual(b.n, { diario: 0, semanal: 0, agendas: 1 })

  // Al día siguiente toca el diario otra vez; el semanal sigue hecho.
  await reloj.tick(new Date('2026-11-17T11:05:00Z'))
  assert.deepEqual(a.n, { diario: 2, semanal: 1, agendas: 3 })
})

test('un diario que falla no tumba la vuelta ni se repite en el mismo día', async () => {
  const c = contadores('diario')
  const reloj = crearReloj(c.trabajos)
  await reloj.tick(new Date('2026-11-23T11:00:00Z'))
  await reloj.tick(new Date('2026-11-23T11:10:00Z'))
  assert.equal(c.n.diario, 1)
  assert.equal(c.n.agendas, 2)
})
