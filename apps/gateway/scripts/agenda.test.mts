/**
 * Prueba de la agenda de reportes: próxima corrida diaria, semanal y mensual
 * en America/Bogota (sin horario de verano) y America/New_York alrededor de
 * los cambios de hora de 2026 (8 de marzo, 1 de noviembre).
 *   cd apps/gateway && npx tsx scripts/agenda.test.mts
 */
import assert from 'node:assert/strict'
import { proximaCorrida, relojAUtc, relojEn, validarAgenda } from '../src/reportes/agenda.ts'

let ok = 0
function caso(nombre: string, fn: () => void) {
  try {
    fn()
    ok++
    console.log(`ok  ${nombre}`)
  } catch (error) {
    console.error(`MAL ${nombre}`)
    throw error
  }
}
const iso = (d: Date) => d.toISOString()

// ---- Bogotá: siempre UTC-5 ----
const BOG = 'America/Bogota'
caso('bogota diaria, antes de la hora del día', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 8, timezone: BOG }, new Date('2026-10-24T12:00:00Z'))), '2026-10-24T13:00:00.000Z')
})
caso('bogota diaria, justo a la hora pasa al día siguiente', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 8, timezone: BOG }, new Date('2026-10-24T13:00:00Z'))), '2026-10-25T13:00:00.000Z')
})
caso('bogota diaria a medianoche local', () => {
  // 23:30 local del 24 → 00:00 local del 25 = 05:00Z
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 0, timezone: BOG }, new Date('2026-10-25T04:30:00Z'))), '2026-10-25T05:00:00.000Z')
})
caso('bogota semanal lunes 8 (24 oct 2026 es sábado)', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'weekly', hour: 8, weekday: 1, timezone: BOG }, new Date('2026-10-24T15:00:00Z'))), '2026-10-26T13:00:00.000Z')
})
caso('bogota semanal, el mismo día ya pasada la hora → la semana siguiente', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'weekly', hour: 8, weekday: 1, timezone: BOG }, new Date('2026-10-26T14:00:00Z'))), '2026-11-02T13:00:00.000Z')
})
caso('bogota semanal, el día local manda sobre el día UTC', () => {
  // Domingo 25 a las 21:00 local = lunes 26 02:00Z. Lunes 8 local sigue siendo el 26.
  assert.equal(iso(proximaCorrida({ frequency: 'weekly', hour: 8, weekday: 1, timezone: BOG }, new Date('2026-10-26T02:00:00Z'))), '2026-10-26T13:00:00.000Z')
})
caso('bogota mensual día 1 a las 9', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'monthly', hour: 9, dayOfMonth: 1, timezone: BOG }, new Date('2026-10-24T12:00:00Z'))), '2026-11-01T14:00:00.000Z')
})
caso('bogota mensual día 28, cruza el año', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'monthly', hour: 18, dayOfMonth: 28, timezone: BOG }, new Date('2026-12-28T23:30:00Z'))), '2027-01-28T23:00:00.000Z')
})

// ---- Nueva York: EST (UTC-5) / EDT (UTC-4) ----
const NY = 'America/New_York'
caso('ny diaria 8: la hora local se mantiene al entrar el horario de verano', () => {
  const a = proximaCorrida({ frequency: 'daily', hour: 8, timezone: NY }, new Date('2026-03-07T14:00:00Z')) // 7 mar 9:00 EST
  assert.equal(iso(a), '2026-03-08T12:00:00.000Z') // 8 mar 8:00 EDT
  const b = proximaCorrida({ frequency: 'daily', hour: 8, timezone: NY }, new Date('2026-03-06T12:00:00Z'))
  assert.equal(iso(b), '2026-03-06T13:00:00.000Z') // 6 mar 8:00 EST
})
caso('ny diaria 8: al salir del horario de verano', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 8, timezone: NY }, new Date('2026-10-31T13:00:00Z'))), '2026-11-01T13:00:00.000Z') // 1 nov 8:00 EST
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 8, timezone: NY }, new Date('2026-10-30T11:00:00Z'))), '2026-10-30T12:00:00.000Z') // 30 oct 8:00 EDT
})
caso('ny semanal domingo 8 los dos domingos del cambio', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'weekly', hour: 8, weekday: 0, timezone: NY }, new Date('2026-03-02T00:00:00Z'))), '2026-03-08T12:00:00.000Z')
  assert.equal(iso(proximaCorrida({ frequency: 'weekly', hour: 8, weekday: 0, timezone: NY }, new Date('2026-10-26T00:00:00Z'))), '2026-11-01T13:00:00.000Z')
})
caso('ny la hora que no existe (2:00 del 8 mar) sale a las 3:00 EDT', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 2, timezone: NY }, new Date('2026-03-08T05:00:00Z'))), '2026-03-08T07:00:00.000Z')
  const r = relojEn(Date.parse('2026-03-08T07:00:00Z'), NY)
  assert.equal(r.h, 3)
})
caso('ny la hora que existe dos veces (1:00 del 1 nov) es la primera, EDT', () => {
  assert.equal(new Date(relojAUtc(2026, 11, 1, 1, NY)).toISOString(), '2026-11-01T05:00:00.000Z')
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 1, timezone: NY }, new Date('2026-11-01T04:30:00Z'))), '2026-11-01T05:00:00.000Z')
  // Pasada la primera 1:00, la siguiente es el 2 nov (no la segunda 1:00 del mismo día).
  assert.equal(iso(proximaCorrida({ frequency: 'daily', hour: 1, timezone: NY }, new Date('2026-11-01T05:00:00Z'))), '2026-11-02T06:00:00.000Z')
})
caso('ny mensual día 8 a las 2: marzo cae en la hora que no existe, abril normal', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'monthly', hour: 2, dayOfMonth: 8, timezone: NY }, new Date('2026-02-20T00:00:00Z'))), '2026-03-08T07:00:00.000Z')
  assert.equal(iso(proximaCorrida({ frequency: 'monthly', hour: 2, dayOfMonth: 8, timezone: NY }, new Date('2026-03-08T07:00:00Z'))), '2026-04-08T06:00:00.000Z')
})
caso('ny mensual día 1 a las 8 cruza el cambio de noviembre', () => {
  assert.equal(iso(proximaCorrida({ frequency: 'monthly', hour: 8, dayOfMonth: 1, timezone: NY }, new Date('2026-10-01T12:00:00Z'))), '2026-11-01T13:00:00.000Z')
})

// ---- validación ----
caso('validar: zona inventada, hora fuera de rango, semanal sin día', () => {
  assert.ok('error' in validarAgenda({ frequency: 'daily', hour: 8, timezone: 'Mars/Olympus' }))
  assert.ok('error' in validarAgenda({ frequency: 'daily', hour: 24 }))
  assert.ok('error' in validarAgenda({ frequency: 'weekly', hour: 8 }))
  assert.ok('error' in validarAgenda({ frequency: 'monthly', hour: 8, dayOfMonth: 31 }))
  assert.deepEqual(validarAgenda({ frequency: 'weekly', hour: '8', weekday: 1 }), { frequency: 'weekly', hour: 8, weekday: 1, dayOfMonth: null, timezone: 'America/Bogota' })
})

console.log(`\n${ok} casos bien`)
