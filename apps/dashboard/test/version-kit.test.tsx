/**
 * Línea de versión y prompt para actualizar del Kit (app/t/[slug]/kit/version-kit.tsx),
 * renderizados a HTML. Puro, sin red.
 *   cd apps/dashboard && npx tsx --test test/version-kit.test.tsx
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { VersionKit } from '../app/t/[slug]/kit/version-kit'
import { LocaleProvider } from '../lib/i18n/client'
import type { Locale } from '../lib/i18n/dict'
import type { ChequeoIntegracion } from '../app/t/[slug]/kit/actions'
import type { UltimasVersionesKit } from '@peaje/shared'

const KIT_URL = 'https://usepeaje.com/t/cafe/kit'

const html = (instalado: ChequeoIntegracion['kit'], ultimas: UltimasVersionesKit, locale: Locale = 'en') =>
  renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <VersionKit instalado={instalado} ultimas={ultimas} kitUrl={KIT_URL} />
    </LocaleProvider>,
  )
// El HTML escapa las comillas: se comparan contra el texto plano.
const texto = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

const next = { paquete: '@peaje/next' as const, version: '0.3.3' }

test('al día: solo la línea con la versión, sin aviso ni prompt', () => {
  const h = texto(html(next, { '@peaje/next': '0.3.3' }))
  assert.match(h, /@peaje\/next 0\.3\.3 · latest version/)
  assert.doesNotMatch(h, /<details/)
})

test('hay una más nueva: aviso y prompt con paquete, versión, lockfile, build sin commit ni deploy, y la URL del kit', () => {
  const h = texto(html(next, { '@peaje/next': '0.3.4', '@peaje/proxy': '0.2.3' }))
  assert.match(h, /@peaje\/next 0\.3\.3</)
  assert.match(h, /There is a newer version of @peaje\/next: 0\.3\.4\./)
  assert.match(h, /View the update prompt/)
  assert.match(h, /Update @peaje\/next to version 0\.3\.4/)
  for (const cmd of ['npm install', 'pnpm add', 'yarn add', 'bun add']) assert.ok(h.includes(`${cmd} @peaje/next@0.3.4`), cmd)
  assert.match(h, /Change nothing else/)
  assert.match(h, /Run the build and tell me if it passed. Do not commit or deploy: I do that./)
  assert.ok(h.includes(`open ${KIT_URL} and press "Verify again"`))
  assert.doesNotMatch(h, /@peaje\/proxy/)
})

test('en español, el mismo prompt en la lengua de la UI', () => {
  const h = texto(html(next, { '@peaje/next': '0.3.4' }, 'es'))
  assert.match(h, /Hay una versión más nueva de @peaje\/next: 0\.3\.4\./)
  assert.match(h, /Ver el prompt para actualizar/)
  assert.match(h, /Actualiza @peaje\/next a la versión 0\.3\.4/)
  assert.ok(h.includes(`abre ${KIT_URL} y presiona "Verificar de nuevo"`))
})

test('sin header: aviso condicional y prompt que detecta el paquete en package.json', () => {
  const h = texto(html('anterior', { '@peaje/next': '0.3.4', '@peaje/proxy': '0.2.3' }))
  assert.match(h, /If it uses @peaje\/next or @peaje\/proxy, that version is old/)
  assert.match(h, /@peaje\/next \(new version: 0\.3\.4\) or @peaje\/proxy \(new version: 0\.2\.3\)/)
  assert.match(h, /If it uses neither, change nothing and tell me/)
  assert.ok(h.includes('npm install <package>@<version>'))
})

test('nunca un aviso equivocado: sin npm, o con npm todavía en la versión sin header, nada que actualizar', () => {
  // npm no respondió: la versión instalada sí, sin "latest" ni aviso.
  const sinNpm = texto(html(next, {}))
  assert.match(sinNpm, /@peaje\/next 0\.3\.3</)
  assert.doesNotMatch(sinNpm, /latest version|newer/)
  // Sin header y npm en 0.3.2 / 0.2.2: el sitio puede estar en la última.
  assert.equal(html('anterior', { '@peaje/next': '0.3.2', '@peaje/proxy': '0.2.2' }), '')
  assert.equal(html('anterior', {}), '')
  assert.equal(html(undefined, { '@peaje/next': '0.3.4' }), '')
})
