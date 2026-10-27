/**
 * Origen de primer contacto (lib/origen.ts), la lista de ADMIN_EMAILS
 * (lib/admin.ts) y los datos de /admin/origenes (lib/origenes.ts). Puro, sin red.
 *   cd apps/dashboard && node --conditions=react-server --test --import tsx test/origen.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emailsAdmin, esEmailAdmin } from '../lib/admin'
import { esNavegacion, hostDeReferrer, limpiarParte, MAX_PARTE, origenDeVisita, origenValido } from '../lib/origen'
import { armarOrigenes, diaDe, diasDeVentana, tienePro } from '../lib/origenes'

const q = (s: string) => new URLSearchParams(s)
const visita = (search: string, referer?: string | null, hostPropio = 'usepeaje.com') =>
  origenDeVisita({ searchParams: q(search), referer, hostPropio })

test('limpiarParte: minúsculas, [a-z0-9._-], sin acentos, hasta 60', () => {
  assert.equal(limpiarParte('Comunidad'), 'comunidad')
  assert.equal(limpiarParte('  Platanus Hack 26 '), 'platanus-hack-26')
  assert.equal(limpiarParte('Café Señor'), 'cafe-senor')
  assert.equal(limpiarParte('a//b??c'), 'a-b-c')
  assert.equal(limpiarParte('--.hola.--'), 'hola')
  assert.equal(limpiarParte('<script>alert(1)</script>'), 'script-alert-1-script')
  assert.equal(limpiarParte('x'.repeat(100))?.length, MAX_PARTE)
  // El corte no deja un guion colgando.
  assert.equal(limpiarParte(`${'a'.repeat(59)} b`), 'a'.repeat(59))
  for (const vacio of [null, undefined, '', '   ', '!!!', '🙂']) assert.equal(limpiarParte(vacio), null)
})

test('orden: ref, después utm, después el referrer externo', () => {
  assert.equal(visita('ref=Comunidad&utm_source=x', 'https://t.co/abc'), 'comunidad')
  assert.equal(visita('utm_source=LinkedIn&utm_medium=social&utm_campaign=Lanzamiento Oct', 'https://t.co/abc'), 'linkedin/social/lanzamiento-oct')
  assert.equal(visita('utm_source=newsletter&utm_campaign=octubre'), 'newsletter/-/octubre')
  assert.equal(visita('utm_source=newsletter&utm_medium=email'), 'newsletter/email')
  assert.equal(visita('utm_source=newsletter'), 'newsletter')
  // Medium o campaign sin source no cuentan: pasa al referrer.
  assert.equal(visita('utm_medium=email&utm_campaign=x', 'https://www.Google.com/search?q=peaje'), 'google.com')
  // Un ref que queda vacío al limpiarlo no tapa lo que sigue.
  assert.equal(visita('ref=%%%&utm_source=x'), 'x')
  assert.equal(visita('ref=!!!', 'https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com')
  assert.equal(visita(''), null)
})

test('el referrer propio, vacío o roto no cuenta', () => {
  assert.equal(hostDeReferrer('https://usepeaje.com/radar'), null)
  assert.equal(hostDeReferrer('https://www.usepeaje.com/'), null)
  assert.equal(hostDeReferrer('https://api.usepeaje.com/x'), null)
  assert.equal(hostDeReferrer('https://peaje-dashboard-git-x.vercel.app/', 'peaje-dashboard-git-x.vercel.app'), null)
  assert.equal(hostDeReferrer('http://localhost:3100/radar', 'localhost'), null)
  assert.equal(hostDeReferrer(''), null)
  assert.equal(hostDeReferrer(null), null)
  assert.equal(hostDeReferrer('no es una url'), null)
  assert.equal(hostDeReferrer('about:blank'), null)
  // Un dominio que solo termina parecido sí es externo.
  assert.equal(hostDeReferrer('https://notusepeaje.com/'), 'notusepeaje.com')
  assert.equal(hostDeReferrer('https://l.instagram.com/?u=x'), 'l.instagram.com')
  assert.equal(hostDeReferrer('android-app://com.google.android.gm/'), 'com.google.android.gm')
})

test('origenValido: solo el formato que deja el proxy', () => {
  for (const ok of ['comunidad', 'linkedin/social/lanzamiento', 'newsletter/-/octubre', 'news.ycombinator.com', 'a_b-c.d']) {
    assert.equal(origenValido(ok), ok)
  }
  for (const malo of ['Comunidad', 'a/b/c/d', 'a//b', '/a', 'a/', 'con espacio', 'x'.repeat(61), '', null, undefined, '<x>']) {
    assert.equal(origenValido(malo), null, String(malo))
  }
  // Todo lo que sale de origenDeVisita pasa origenValido.
  const largo = 'x'.repeat(200)
  const v = visita(`utm_source=${largo}&utm_medium=${largo}&utm_campaign=${largo}`)
  assert.equal(origenValido(v), v)
})

test('esNavegacion: documentos sí; fetch, RSC, scripts y POST no', () => {
  const h = (x: Record<string, string>) => new Headers(x)
  assert.equal(esNavegacion('GET', h({ 'sec-fetch-dest': 'document' })), true)
  assert.equal(esNavegacion('GET', h({ accept: 'text/html,application/xhtml+xml' })), true)
  assert.equal(esNavegacion('POST', h({ 'sec-fetch-dest': 'document' })), false)
  assert.equal(esNavegacion('GET', h({ 'sec-fetch-dest': 'empty' })), false)
  assert.equal(esNavegacion('GET', h({ 'sec-fetch-dest': 'script' })), false)
  assert.equal(esNavegacion('GET', h({ 'sec-fetch-dest': 'document', rsc: '1' })), false)
  assert.equal(esNavegacion('GET', h({ accept: 'text/html', 'next-router-prefetch': '1' })), false)
  assert.equal(esNavegacion('GET', h({ accept: '*/*' })), false)
})

test('ADMIN_EMAILS: lista separada por coma, sin distinguir mayúsculas; vacía no deja entrar a nadie', () => {
  assert.deepEqual([...emailsAdmin(' San@Ejemplo.com, otra@ejemplo.com ,,no-es-correo')], ['san@ejemplo.com', 'otra@ejemplo.com'])
  assert.equal(esEmailAdmin('san@ejemplo.com', 'SAN@ejemplo.com,otra@ejemplo.com'), true)
  assert.equal(esEmailAdmin(' Otra@Ejemplo.com ', 'san@ejemplo.com,otra@ejemplo.com'), true)
  assert.equal(esEmailAdmin('intrusa@ejemplo.com', 'san@ejemplo.com'), false)
  assert.equal(esEmailAdmin('san@ejemplo.com', undefined), false)
  assert.equal(esEmailAdmin('san@ejemplo.com', ''), false)
  assert.equal(esEmailAdmin(null, 'san@ejemplo.com'), false)
})

test('días de Bogotá: la ventana termina hoy y no se corre con UTC', () => {
  // 26 oct 2026 02:00 UTC = 25 oct 21:00 en Bogotá.
  const ahora = new Date('2026-10-26T02:00:00Z')
  assert.equal(diaDe(ahora), '2026-10-25')
  assert.deepEqual(diasDeVentana(3, ahora), ['2026-10-25', '2026-10-24', '2026-10-23'])
  assert.equal(diasDeVentana(30, ahora).length, 30)
})

test('armarOrigenes: por origen y por día, Pro solo pagado y vigente', () => {
  const ahora = new Date('2026-10-26T15:00:00Z')
  const futuro = '2026-11-25T00:00:00Z'
  const pasado = '2026-10-01T00:00:00Z'
  const libre = { plan: 'free', planUntil: null, trialUntil: null }
  const leads = [
    { acquisitionSource: 'comunidad', createdAt: '2026-10-26T14:00:00Z' },
    { acquisitionSource: 'comunidad', createdAt: '2026-10-25T14:00:00Z' },
    { acquisitionSource: null, createdAt: '2026-10-26T03:00:00Z' }, // 25 oct en Bogotá
    { acquisitionSource: 't.co', createdAt: '2026-10-20T12:00:00Z' },
    // Fuera de los 7 días (19 oct en Bogotá): no cuenta.
    { acquisitionSource: 'viejo', createdAt: '2026-10-20T04:00:00Z' },
  ]
  const tenants = [
    { acquisitionSource: 'comunidad', createdAt: '2026-10-26T14:30:00Z', plan: 'pro', planUntil: futuro, trialUntil: null },
    { acquisitionSource: 'comunidad', createdAt: '2026-10-25T10:00:00Z', ...libre },
    // Plan pago vencido: no es Pro.
    { acquisitionSource: 't.co', createdAt: '2026-10-24T10:00:00Z', plan: 'founder', planUntil: pasado, trialUntil: null },
    // Prueba vigente: no es una suscripción.
    { acquisitionSource: null, createdAt: '2026-10-24T10:00:00Z', plan: 'free', planUntil: null, trialUntil: futuro },
    { acquisitionSource: null, createdAt: '2026-10-23T10:00:00Z', plan: 'founder', planUntil: futuro, trialUntil: null },
  ]
  const r = armarOrigenes({ leads, tenants, dias: 7, ahora })

  assert.deepEqual(r.totales, { leads: 4, altas: 5, pro: 2 })
  assert.deepEqual(r.filas, [
    { origen: 'comunidad', leads: 2, altas: 2, pro: 1 },
    { origen: null, leads: 1, altas: 2, pro: 1 },
    { origen: 't.co', leads: 1, altas: 1, pro: 0 },
  ])
  assert.equal(r.porDia.length, 7)
  assert.deepEqual(r.porDia[0], { dia: '2026-10-26', leads: 1, altas: 1, pro: 1 })
  assert.deepEqual(r.porDia[1], { dia: '2026-10-25', leads: 2, altas: 1, pro: 0 })
  assert.deepEqual(r.porDia.at(-1), { dia: '2026-10-20', leads: 1, altas: 0, pro: 0 })
  assert.equal(r.filas.some((f) => f.origen === 'viejo'), false)

  assert.equal(tienePro({ plan: 'pro', planUntil: futuro, trialUntil: null }, ahora), true)
  assert.equal(tienePro({ plan: 'free', planUntil: null, trialUntil: futuro }, ahora), false)
})

test('armarOrigenes sin datos: ceros, filas vacías y todos los días', () => {
  const r = armarOrigenes({ leads: [], tenants: [], dias: 30, ahora: new Date('2026-10-26T15:00:00Z') })
  assert.deepEqual(r.totales, { leads: 0, altas: 0, pro: 0 })
  assert.deepEqual(r.filas, [])
  assert.equal(r.porDia.length, 30)
})
