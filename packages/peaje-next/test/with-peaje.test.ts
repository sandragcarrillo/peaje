import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RUTAS_DINAMICAS, RUTAS_PROXY } from '@peaje/shared'
import { baseDe, fusionarRewrites, GATEWAY_POR_DEFECTO, withPeaje, type ConfigConRewrites, type RewritesObjeto } from '../src/index'

const slug = 'cafe-andino'
const gateway = 'https://gateway.example'
const base = `${gateway}/${slug}`
const TOTAL = RUTAS_PROXY.length + RUTAS_DINAMICAS.length

async function rewritesDe(config: unknown): Promise<RewritesObjeto> {
  const c = (typeof config === 'function' ? await config('phase-production-build', { defaultConfig: {} }) : config) as ConfigConRewrites
  assert.ok(c.rewrites, 'la config envuelta debe tener rewrites()')
  const r = await c.rewrites()
  assert.ok(!Array.isArray(r), 'rewrites() envuelto siempre devuelve objeto')
  return r
}

test('sin rewrites previos: solo las reglas de Peaje en beforeFiles', async () => {
  const r = await rewritesDe(withPeaje({ reactStrictMode: true }, { slug, gateway }))
  assert.equal(r.beforeFiles?.length, TOTAL)
  assert.equal(r.afterFiles, undefined)
  assert.ok(r.beforeFiles?.every((x) => x.destination.startsWith(base)))
  const llms = r.beforeFiles?.find((x) => x.source === '/llms.txt')
  assert.deepEqual(llms?.missing, [{ type: 'header', key: 'x-peaje-fetch' }])
})

test('rewrites() que devuelve array: pasa a afterFiles intacto', async () => {
  const propias = [{ source: '/viejo', destination: '/nuevo' }]
  const r = await rewritesDe(withPeaje({ rewrites: () => propias }, { slug, gateway }))
  assert.equal(r.beforeFiles?.length, TOTAL)
  assert.deepEqual(r.afterFiles, propias)
})

test('rewrites() que devuelve objeto: conserva before/after/fallback y antepone', async () => {
  const previo = {
    beforeFiles: [{ source: '/a', destination: '/b' }],
    afterFiles: [{ source: '/c', destination: '/d' }],
    fallback: [{ source: '/:path*', destination: 'https://legacy.example/:path*' }],
  }
  const r = await rewritesDe(withPeaje({ rewrites: async () => previo }, { slug, gateway }))
  assert.equal(r.beforeFiles?.length, TOTAL + 1)
  assert.deepEqual(r.beforeFiles?.at(-1), previo.beforeFiles[0])
  assert.deepEqual(r.afterFiles, previo.afterFiles)
  assert.deepEqual(r.fallback, previo.fallback)
})

test('rewrites() sync y async dan lo mismo', async () => {
  const propias = [{ source: '/x', destination: '/y' }]
  const sync = await rewritesDe(withPeaje({ rewrites: () => propias }, { slug, gateway }))
  const asinc = await rewritesDe(withPeaje({ rewrites: async () => propias }, { slug, gateway }))
  assert.deepEqual(sync, asinc)
})

test('nextConfig como función (phase, { defaultConfig })', async () => {
  let faseVista = ''
  const fn = (phase: string) => {
    faseVista = phase
    return { images: { domains: ['x'] }, rewrites: () => [{ source: '/p', destination: '/q' }] }
  }
  const envuelta = withPeaje(fn, { slug, gateway })
  assert.equal(typeof envuelta, 'function')
  const r = await rewritesDe(envuelta)
  assert.equal(faseVista, 'phase-production-build')
  assert.equal(r.beforeFiles?.length, TOTAL)
  assert.equal(r.afterFiles?.length, 1)
  const c = await (envuelta as (p: string, x: { defaultConfig: unknown }) => Promise<ConfigConRewrites>)('phase-production-build', { defaultConfig: {} })
  assert.deepEqual(c.images, { domains: ['x'] })
})

test('idempotente: envolver dos veces o tener reglas al gateway no duplica', async () => {
  const doble = withPeaje(withPeaje({}, { slug, gateway }), { slug, gateway })
  const r = await rewritesDe(doble)
  assert.equal(r.beforeFiles?.length, TOTAL)

  const manual = { beforeFiles: [{ source: '/mcp', destination: `${base}/mcp` }] }
  const r2 = fusionarRewrites(manual, [
    { source: '/mcp', destination: `${base}/mcp` },
    { source: '/docs', destination: `${base}/docs` },
  ])
  assert.deepEqual(
    r2.beforeFiles?.map((x) => x.source),
    ['/docs', '/mcp'],
  )
})

test('conserva el resto de la config y exige slug', async () => {
  const c = withPeaje({ reactStrictMode: true, images: { formats: ['image/avif'] } }, { slug, gateway }) as ConfigConRewrites
  assert.equal(c.reactStrictMode, true)
  assert.deepEqual(c.images, { formats: ['image/avif'] })
  assert.throws(() => withPeaje({}, { slug: '' }), /slug/)
})

test('gateway por defecto y override por env', () => {
  const previo = process.env.PEAJE_GATEWAY_URL
  delete process.env.PEAJE_GATEWAY_URL
  assert.equal(baseDe({ slug }), `${GATEWAY_POR_DEFECTO}/${slug}`)
  process.env.PEAJE_GATEWAY_URL = 'http://localhost:8799/'
  assert.equal(baseDe({ slug }), `http://localhost:8799/${slug}`)
  assert.equal(baseDe({ slug, gateway }), base)
  if (previo === undefined) delete process.env.PEAJE_GATEWAY_URL
  else process.env.PEAJE_GATEWAY_URL = previo
})
