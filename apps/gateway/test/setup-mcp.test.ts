// peaje_setup: lo que el agente del dueño lee después de iniciar sesión
// (usepeaje.com/onboard.md). Nunca devuelve el secreto del origen.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Chequeo } from '@peaje/shared'
import { respuestaSetup } from '../src/tareas/setup.js'

const base = { nombre: 'Taller', dominio: 'taller.test', pasos: '# Install', panelKit: 'https://usepeaje.com/t/taller/kit', verifyUrl: 'https://api.usepeaje.com/taller/kit/verify' }
const ok = (id: Chequeo['id']): Chequeo => ({ id, ok: true, motivo: 'ok' as Chequeo['motivo'] })
const mal = (id: Chequeo['id'], faltantes?: string[]): Chequeo => ({ id, ok: false, motivo: 'falta' as Chequeo['motivo'], faltantes })

test('sin instalar: devuelve los pasos y lo que solo hace el dueño', () => {
  const r = respuestaSetup({ ...base, chequeos: [mal('proxy', ['/llms.txt']), ok('robots')] })
  assert.equal(r.installed, false)
  assert.equal(r.steps, '# Install')
  assert.match(r.ownerOnly ?? '', /PEAJE_ORIGIN_SECRET/)
  assert.match(r.ownerOnly ?? '', /usepeaje\.com\/t\/taller\/kit/)
  assert.deepEqual(r.checks.failing, [{ id: 'proxy', reason: 'falta', missing: ['/llms.txt'] }])
  assert.deepEqual(r.checks.passing, ['robots'])
})

test('instalado: sin pasos, y un bloqueo de bots no cuenta como falta de instalación', () => {
  const r = respuestaSetup({ ...base, chequeos: [ok('proxy'), ok('json-ld'), mal('bots')] })
  assert.equal(r.installed, true)
  assert.equal(r.steps, null)
  assert.equal(r.ownerOnly, null)
  assert.match(r.next, /peaje_plan/)
})

test('sin dominio público no hay nada que medir', () => {
  const r = respuestaSetup({ ...base, dominio: null, chequeos: [mal('dominio')] })
  assert.equal(r.installed, false)
  assert.match(r.next, /no public domain/)
})

test('la respuesta no trae ningún secreto', () => {
  const r = JSON.stringify(respuestaSetup({ ...base, chequeos: [mal('proxy')] }))
  assert.doesNotMatch(r, /PEAJE_ORIGIN_SECRET=/)
})
