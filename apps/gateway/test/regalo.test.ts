// El paquete gratis: 2 informes y 10 respuestas, una vez por dominio.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accesoPro, conRegalo, dominioDeRegalo, MemoryStore, REGALO, regaloRestante } from '@peaje/db'
import { fueraDelRegalo, lineaRegalo, restoRegalo, type Saldo } from '../src/tareas/creditos.js'

const nuevo = (store: MemoryStore, slug: string, originUrl: string) => store.createTenant({ slug, name: slug, originUrl, embedSecret: 'x' })

test('el dominio del paquete ignora www y descarta lo que no es un sitio público', () => {
  assert.equal(dominioDeRegalo('https://www.taller.co/algo'), 'taller.co')
  assert.equal(dominioDeRegalo('https://taller.co'), 'taller.co')
  assert.equal(dominioDeRegalo('http://localhost:3000'), null)
  assert.equal(dominioDeRegalo('http://192.168.1.4'), null)
  assert.equal(dominioDeRegalo('no es url'), null)
})

test('un negocio gratis nuevo recibe el paquete entero y queda activo', async () => {
  const store = new MemoryStore()
  const t = await conRegalo(store, await nuevo(store, 'a', 'https://taller.co'))
  assert.deepEqual(t.regalo, { informes: REGALO.informes, respuestas: REGALO.respuestas })
  const acceso = accesoPro(t)
  assert.equal(acceso.activo, true)
  assert.equal(acceso.plan, 'regalo')
  assert.equal(acceso.limites.preguntas, 10)
})

test('lo usado se descuenta por tipo: consultas de las respuestas, lo demás de los informes', () => {
  assert.deepEqual(regaloRestante([{ credits: 30, reason: 'dashboard:build_plan' }, { credits: 2, reason: 'consulta' }, { credits: 2, reason: 'consulta' }]), { informes: 1, respuestas: 8 })
  // Una devolución deja el informe disponible otra vez.
  assert.deepEqual(regaloRestante([{ credits: 30, reason: 'dashboard:run_citation_check' }, { credits: -30, reason: 'devolución:dashboard:run_citation_check' }]), { informes: 2, respuestas: 10 })
  assert.deepEqual(regaloRestante([{ credits: 60, reason: 'x' }, { credits: 40, reason: 'consulta' }]), { informes: 0, respuestas: 0 })
})

test('registrar el mismo dominio otra vez no da otro paquete', async () => {
  const store = new MemoryStore()
  const a = await nuevo(store, 'a', 'https://taller.co')
  await store.addCreditCharge({ tenantId: a.id, credits: 30, reason: 'dashboard:build_plan' })
  await store.addCreditCharge({ tenantId: a.id, credits: 30, reason: 'run_citation_check' })
  for (let i = 0; i < 10; i++) await store.addCreditCharge({ tenantId: a.id, credits: 2, reason: 'consulta' })
  const b = await conRegalo(store, await nuevo(store, 'b', 'https://www.taller.co'))
  assert.deepEqual(b.regalo, { informes: 0, respuestas: 0 })
  assert.equal(accesoPro(b).activo, false)
  // Otro dominio sí lo recibe.
  const c = await conRegalo(store, await nuevo(store, 'c', 'https://otro.co'))
  assert.equal(accesoPro(c).plan, 'regalo')
})

test('sin dominio público no hay paquete, y un plan pago no se toca', async () => {
  const store = new MemoryStore()
  const local = await conRegalo(store, await nuevo(store, 'l', 'http://localhost:3000'))
  assert.equal(accesoPro(local).activo, false)
  const pago = { ...(await nuevo(store, 'p', 'https://pago.co')), plan: 'pro' as const, planUntil: new Date(Date.now() + 86_400_000).toISOString() }
  const igual = await conRegalo(store, pago)
  assert.equal(igual.regalo, undefined)
  assert.equal(accesoPro(igual).plan, 'pro')
})

test('el paquete cubre informes y respuestas, y nada más', () => {
  const s: Saldo = { total: 80, usados: 0, quedan: 80, renueva: '', regalo: { informes: 1, respuestas: 0, planUrl: 'https://usepeaje.com/t/a/agente#plan' } }
  assert.equal(fueraDelRegalo(s, 'informe'), null)
  assert.equal(fueraDelRegalo(s, 'informe', 1), 'agotado')
  assert.equal(fueraDelRegalo(s, 'consulta'), 'agotado')
  assert.equal(fueraDelRegalo(s, 'pagina'), 'no-incluido')
  assert.equal(fueraDelRegalo(s, 'serie'), 'no-incluido')
  assert.equal(fueraDelRegalo(s, 'comprador'), 'no-incluido')
  // Con plan pago no aplica.
  assert.equal(fueraDelRegalo({ total: 500, usados: 0, quedan: 500, renueva: '' }, 'pagina'), null)
  assert.match(lineaRegalo(s, 'no-incluido', 'es'), /no entra en el paquete gratis.*agente#plan/)
  assert.match(lineaRegalo(s, 'agotado', 'en'), /already used/)
  assert.equal(restoRegalo({ informes: 1, respuestas: 3 }, 'es'), 'Paquete gratis: te quedan 1 informe y 3 respuestas del agente.')
})
