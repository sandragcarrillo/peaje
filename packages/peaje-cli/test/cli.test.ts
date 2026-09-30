import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fusionarRobots } from '../src/aplicar'
import { clean, init } from '../src/comandos'
import { detectar } from '../src/detectar'
import { descargarKitCon, urlKit, type DescargarKit } from '../src/kit'
import { agregarDependencia, agregarImport, envolverNextConfig, insertarJsonLdEstatico, insertarPeajeHead } from '../src/next'
import type { Kit } from '../src/tipos'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const kitBase = JSON.parse(readFileSync(join(FIXTURES, 'kit.json'), 'utf8')) as Kit

const temporales: string[] = []
after(() => {
  for (const t of temporales) rmSync(t, { recursive: true, force: true })
})

/** Copia el fixture a un tmp para que los tests puedan escribir sin ensuciar el repo. */
function copia(nombre: string): string {
  const dir = mkdtempSync(join(tmpdir(), `peaje-${nombre}-`))
  cpSync(join(FIXTURES, nombre), dir, { recursive: true })
  temporales.push(dir)
  return dir
}

/** Kit falso: el mismo shape real, con el host que pidió el CLI. */
const pedidos: { gateway: string; slug: string; host: string | null; solo?: string }[] = []
const descargarKit: DescargarKit = async (gateway, slug, host, solo) => {
  pedidos.push({ gateway, slug, host, solo })
  if (slug === 'no-existe') throw new Error('No business with slug "no-existe"')
  if (solo === 'aeo') {
    // El gateway con ?layers=aeo: solo head (Organization) y robots, sin proxy.
    const org = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Demo <b>', url: 'https://demo.test/' }, null, 2)}\n</script>`
    return {
      ...kitBase,
      slug,
      host: host ?? 'unknown',
      layers: ['aeo'],
      files: [
        { path: 'peaje/head.html', mode: 'snippet', content: org, nota: 'head' },
        kitBase.files.find((f) => f.path === 'public/robots.txt')!,
      ],
      remove: [],
      manual: [],
      paidPath: null,
    }
  }
  const kit: Kit = { ...kitBase, slug, host: host ?? 'unknown', layers: kitBase.layers ?? ['agentes', 'aeo'] }
  if (host !== 'next') {
    // El gateway devuelve el proxy del host pedido; acá basta con renombrar el archivo.
    kit.files = kit.files.map((f) =>
      f.path === 'peaje/next.config.ts' ? { ...f, path: `peaje/${host ?? 'todos'}.txt`, mode: host === 'nginx' || host === 'caddy' ? 'include' : 'snippet' } : f,
    )
  }
  return kit
}

const base = { gateway: 'http://gw.test', dryRun: false, descargarKit, timestamp: 'T' }

test('fixture 1: Next app router con rewrites() array y <head>', async () => {
  const dir = copia('next-app')
  const { resultado, codigo, det } = await init({ ...base, slug: 'demo', dir })
  assert.equal(codigo, 0)
  assert.equal(resultado.ok, true)
  assert.equal(resultado.stack, 'next')
  assert.equal(resultado.host, 'next')
  assert.equal(det.router, 'app')
  assert.equal(pedidos.at(-1)?.host, 'next')

  const config = readFileSync(join(dir, 'next.config.ts'), 'utf8')
  assert.ok(config.startsWith(`import { withPeaje } from '@peaje/next'\n`))
  assert.ok(config.includes(`export default withPeaje(nextConfig, { slug: "demo" })`))
  assert.ok(config.includes(`async rewrites()`), 'los rewrites originales quedan')
  // Next 15 en el fixture: el middleware se llama middleware.ts; desde 16, proxy.ts.
  const mw = readFileSync(join(dir, 'middleware.ts'), 'utf8')
  assert.ok(mw.includes(`import { peajeProxy } from '@peaje/next/proxy'`))
  assert.ok(mw.includes(`peajeProxy({ slug: "demo" })`))
  assert.ok(!existsSync(join(dir, 'proxy.ts')))
  assert.equal(det.nextMajor, 15)

  const layout = readFileSync(join(dir, 'app/layout.tsx'), 'utf8')
  assert.ok(layout.includes(`import { PeajeHead } from '@peaje/next/head'`))
  // El import va después del import multilínea, no en medio.
  assert.ok(layout.indexOf(`from 'next/font/google'`) < layout.indexOf(`@peaje/next/head`))
  assert.match(layout, /<head>\n\s+<PeajeHead slug="demo" \/>\n\s+<meta name="theme-color"/)

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['@peaje/next'], '^0.2.0')
  assert.ok(resultado.next.some((n) => n.startsWith('pnpm add @peaje/next')))

  // robots nuevo, snippets bajo peaje/, copia estática movida al backup
  assert.ok(existsSync(join(dir, 'public/robots.txt')))
  assert.ok(existsSync(join(dir, 'peaje/next.config.ts')))
  assert.ok(existsSync(join(dir, 'peaje/head.html')))
  assert.ok(!existsSync(join(dir, 'public/openapi.json')))
  assert.ok(existsSync(join(dir, '.peaje-backup/T/public/openapi.json')))
  assert.deepEqual(resultado.moved, ['public/openapi.json -> .peaje-backup/T/public/openapi.json'])
  assert.ok(resultado.written.includes('next.config.ts'))
  assert.ok(resultado.written.includes('app/layout.tsx'))
  assert.ok(resultado.manual.some((m) => m.includes('<a href="/developers">')))

  // Segunda corrida: idempotente.
  const otra = await init({ ...base, slug: 'demo', dir })
  assert.ok(!otra.resultado.written.includes('next.config.ts'))
  assert.ok(!otra.resultado.written.includes('app/layout.tsx'))
  assert.equal(otra.resultado.moved.length, 0)
  assert.equal((readFileSync(join(dir, 'next.config.ts'), 'utf8').match(/withPeaje\(/g) ?? []).length, 1)
})

test('fixture 2: config envuelta en withSentryConfig queda manual; layout sin <head> recibe uno; robots que bloquea avisa', async () => {
  const dir = copia('next-sentry')
  const { resultado } = await init({ ...base, slug: 'demo', dir })
  const config = readFileSync(join(dir, 'next.config.mjs'), 'utf8')
  assert.ok(!config.includes('withPeaje'), 'no se toca una config con wrapper')
  assert.ok(resultado.manual.some((m) => m.includes('next.config.mjs') && m.includes('withPeaje')))

  const layout = readFileSync(join(dir, 'app/layout.tsx'), 'utf8')
  assert.match(layout, /<html lang="en">\n(\s+)<head>\n\1  <PeajeHead slug="demo" \/>\n\1<\/head>\n\1<body className="dark">/)
  assert.ok(layout.startsWith(`import './globals.css'\nimport { PeajeHead } from '@peaje/next/head'\n`))

  const robots2 = readFileSync(join(dir, 'public/robots.txt'), 'utf8')
  assert.ok(robots2.startsWith('User-agent: *\nDisallow: /\n'), 'las reglas propias quedan primero e intactas')
  assert.ok(robots2.includes('# peaje:begin') && robots2.includes('User-agent: OAI-SearchBot'), 'los bots que citan quedan permitidos por su propio grupo')
  assert.ok(resultado.manual.some((m) => m.includes('Disallow: /')))
  assert.ok(!existsSync(join(dir, 'peaje/robots.txt')), 'ya no hace falta la copia de referencia: el bloque va fusionado')
  assert.ok(resultado.next.some((n) => n.startsWith('yarn add @peaje/next')))
})

test('fixture 3: pages router: config CJS envuelta, head manual, robots existente se respeta', async () => {
  const dir = copia('next-pages')
  const { resultado, det } = await init({ ...base, slug: 'demo', dir })
  assert.equal(det.router, 'pages')
  const config = readFileSync(join(dir, 'next.config.js'), 'utf8')
  assert.ok(config.startsWith(`const { withPeaje } = require('@peaje/next')\n`))
  assert.ok(config.includes(`module.exports = withPeaje(nextConfig, { slug: "demo" })`))
  assert.ok(resultado.manual.some((m) => m.includes('pages/_document.tsx')))
  assert.ok(resultado.written.includes('public/robots.txt'), 'el robots existente recibe el bloque de Peaje')
  assert.ok(resultado.next.some((n) => n.startsWith('npm install @peaje/next')))
})

test('fixture 4: Vite + vercel.json: middleware.js de Vercel con @peaje/proxy, sin fusionar vercel.json', async () => {
  const dir = copia('vite-vercel')
  const { resultado, codigo } = await init({ ...base, slug: 'demo', dir })
  assert.equal(codigo, 0)
  assert.equal(resultado.stack, 'vite')
  assert.equal(pedidos.at(-1)?.host, 'vercel')
  assert.ok(existsSync(join(dir, 'peaje/vercel.txt')), 'el snippet del host queda de referencia')
  assert.ok(existsSync(join(dir, 'peaje/head.html')))
  assert.ok(existsSync(join(dir, 'public/robots.txt')))
  assert.ok(resultado.manual.some((m) => m.includes('peaje/head.html')))
  // Sin tsconfig: middleware.js en la raíz, al lado de package.json.
  const mw = readFileSync(join(dir, 'middleware.js'), 'utf8')
  assert.ok(mw.startsWith(`import peaje from '@peaje/proxy/vercel'\n`))
  assert.ok(mw.includes(`export default peaje({ slug: "demo" })`))
  assert.ok(mw.includes(`matcher: ['/((?!assets/|favicon.ico).*)']`))
  assert.ok(!resultado.manual.some((m) => m.includes('Merge peaje/vercel.txt')), 'el middleware ya cubre lo del vercel.json')
  assert.ok(resultado.manual.some((m) => m.startsWith('Set PEAJE_ORIGIN_SECRET')))
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['@peaje/proxy'], '^0.1.0')
  assert.equal(pkg.dependencies['@vercel/functions'], undefined, 'el middleware no necesita @vercel/functions')
  assert.equal(pkg.devDependencies.vite, '^6.0.0', 'lo que había queda')
  assert.ok(resultado.next[0]?.startsWith('bun add @peaje/proxy   #'))
  assert.ok(!resultado.next.some((n) => n.includes('@peaje/next')), 'sin Next no se instala @peaje/next')

  // Idempotente, y un middleware propio no se pisa.
  const otra = await init({ ...base, slug: 'demo', dir })
  assert.ok(!otra.resultado.written.includes('middleware.js'))
  assert.ok(!otra.resultado.written.includes('package.json'))
  const propio = copia('vite-vercel')
  writeFileSync(join(propio, 'middleware.ts'), 'export default function mw() {}\n')
  const conPropio = await init({ ...base, slug: 'demo', dir: propio })
  assert.equal(readFileSync(join(propio, 'middleware.ts'), 'utf8'), 'export default function mw() {}\n')
  assert.ok(conPropio.resultado.manual.some((m) => m.startsWith('middleware.ts exists') && m.includes(`peaje({ slug: "demo" }, yourMiddleware)`)))
})

test('fixture 6: Express con entrada inequívoca: require + app.use justo después de express()', async () => {
  const dir = copia('express-app')
  const { resultado, codigo, det } = await init({ ...base, slug: 'demo', dir })
  assert.equal(codigo, 0)
  assert.equal(resultado.stack, 'express')
  assert.equal(det.servidor, 'server.js')
  const server = readFileSync(join(dir, 'server.js'), 'utf8')
  assert.ok(server.startsWith(`'use strict'\nconst { peajeExpress } = require('@peaje/proxy/express')\nconst express = require('express')`))
  assert.match(server, /const app = express\(\)\napp\.use\(peajeExpress\(\{ slug: "demo" \}\)\)\napp\.use\(express\.json\(\)\)/, 'antes del body parser')
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['@peaje/proxy'], '^0.1.0')
  assert.ok(resultado.next[0]?.startsWith('npm install @peaje/proxy '))
  assert.ok(resultado.manual.some((m) => m.startsWith('Set PEAJE_ORIGIN_SECRET')))
  assert.ok(!resultado.manual.some((m) => m.startsWith('Pick the ONE proxy file')), 'sin host conocido igual no hay archivo que elegir')
  assert.ok(!resultado.manual.some((m) => m.startsWith('Next.js:')))

  const otra = await init({ ...base, slug: 'demo', dir })
  assert.ok(!otra.resultado.written.includes('server.js'))
  assert.equal((readFileSync(join(dir, 'server.js'), 'utf8').match(/peajeExpress\(/g) ?? []).length, 1)
})

test('Express ambiguo: sin entrada clara, instrucción exacta y nada tocado', async () => {
  const dir = copia('express-app')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { express: '^5.1.0' } }))
  const { resultado } = await init({ ...base, slug: 'demo', dir })
  assert.ok(!readFileSync(join(dir, 'server.js'), 'utf8').includes('peaje'))
  const m = resultado.manual.find((x) => x.startsWith('Express:'))
  assert.ok(m?.includes(`npm install @peaje/proxy`))
  assert.ok(m?.includes(`import { peajeExpress } from '@peaje/proxy/express'`))
  assert.ok(m?.includes(`app.use(peajeExpress({ slug: "demo" }))`))
  assert.ok(!resultado.written.includes('package.json'))
})

test('Hono en TS: dev apunta a src/, start a dist/; import ESM y app.use tras new Hono<...>()', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'peaje-hono-'))
  temporales.push(dir)
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'api', type: 'module', scripts: { dev: 'tsx watch src/index.ts', start: 'node dist/index.js' }, dependencies: { hono: '^4.9.0' } }, null, 2),
  )
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
  mkdirSync(join(dir, 'src'))
  writeFileSync(
    join(dir, 'src/index.ts'),
    `import { serve } from '@hono/node-server'\nimport { Hono } from 'hono'\n\nconst app = new Hono<{ Bindings: { X: string } }>()\n\napp.get('/', (c) => c.text('hola'))\n\nserve(app)\n`,
  )
  const { resultado, det } = await init({ ...base, slug: 'demo', dir })
  assert.equal(det.stack, 'hono')
  assert.equal(det.servidor, 'src/index.ts')
  const src = readFileSync(join(dir, 'src/index.ts'), 'utf8')
  assert.ok(src.includes(`import { Hono } from 'hono'\nimport { peajeHono } from '@peaje/proxy/hono'\n`))
  assert.ok(src.includes(`const app = new Hono<{ Bindings: { X: string } }>()\napp.use(peajeHono({ slug: "demo" }))\n`))
  assert.ok(resultado.next[0]?.startsWith('pnpm add @peaje/proxy'))
})

test('Astro y SvelteKit: instrucción con peajeFetch y el hook de cada uno', async () => {
  for (const [dep, archivo] of [
    ['astro', 'src/middleware.ts'],
    ['@sveltejs/kit', 'src/hooks.server.ts'],
  ] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'peaje-ssr-'))
    temporales.push(dir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', devDependencies: { [dep]: '*', vite: '*' } }))
    const { resultado } = await init({ ...base, slug: 'demo', dir })
    const m = resultado.manual.find((x) => x.includes(archivo))
    assert.ok(m?.includes(`peajeFetch({ slug: "demo" })`), dep)
    assert.ok(resultado.manual.some((x) => x.startsWith('Set PEAJE_ORIGIN_SECRET')))
  }
})

test('detección: Express/Hono antes que Vite, .vercel/project.json cuenta como Vercel', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peaje-det-'))
  temporales.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { express: '*' }, devDependencies: { vite: '*' } }))
  assert.equal(detectar(dir).stack, 'express')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { vite: '*' } }))
  mkdirSync(join(dir, '.vercel'))
  writeFileSync(join(dir, '.vercel/project.json'), '{}')
  assert.equal(detectar(dir).host, 'vercel')
})

test('fixture 5: monorepo con dos apps aborta pidiendo --dir y lista candidatos', async () => {
  const dir = copia('monorepo')
  await assert.rejects(init({ ...base, slug: 'demo', dir }), (e: Error) => {
    assert.match(e.message, /--dir/)
    assert.match(e.message, /apps\/web/)
    assert.match(e.message, /apps\/docs/)
    return true
  })
  // Con --dir apuntando a la app, funciona.
  const { resultado } = await init({ ...base, slug: 'demo', dir: join(dir, 'apps/web') })
  assert.equal(resultado.stack, 'next')
  assert.ok(resultado.next.some((n) => n.startsWith('pnpm add')), 'el lockfile se busca hacia arriba')
})

test('plan (dry-run) no escribe nada y lista lo mismo', async () => {
  const dir = copia('next-app')
  const { resultado } = await init({ ...base, slug: 'demo', dir, dryRun: true })
  assert.ok(resultado.written.includes('next.config.ts'))
  assert.ok(resultado.moved.length === 1)
  assert.ok(!readFileSync(join(dir, 'next.config.ts'), 'utf8').includes('withPeaje'))
  assert.ok(existsSync(join(dir, 'public/openapi.json')))
  assert.ok(!existsSync(join(dir, 'peaje')))
})

test('stack no reconocido: kit completo bajo peaje/ y código 3', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'peaje-vacio-'))
  temporales.push(dir)
  const { resultado, codigo } = await init({ ...base, slug: 'demo', dir })
  assert.equal(codigo, 3)
  assert.equal(resultado.ok, false)
  assert.equal(resultado.stack, 'unknown')
  assert.equal(pedidos.at(-1)?.host, null)
  assert.ok(existsSync(join(dir, 'peaje/robots.txt')), 'hasta el create va bajo peaje/')
  assert.ok(!existsSync(join(dir, 'public')))
  assert.ok(resultado.manual[0]?.includes('Stack not recognized'))
})

test('clean solo mueve copias, nunca borra', async () => {
  const dir = copia('next-app')
  const { resultado } = await clean({ ...base, slug: 'demo', dir })
  assert.deepEqual(resultado.moved, ['public/openapi.json -> .peaje-backup/T/public/openapi.json'])
  assert.equal(readFileSync(join(dir, '.peaje-backup/T/public/openapi.json'), 'utf8').includes('stale copy'), true)
  assert.ok(!existsSync(join(dir, 'peaje')))
  assert.ok(readFileSync(join(dir, 'next.config.ts'), 'utf8').includes('export default nextConfig'))
})

test('detección: stack, host y gestor por fixture', () => {
  assert.equal(detectar(join(FIXTURES, 'next-sentry')).gestor, 'yarn')
  assert.equal(detectar(join(FIXTURES, 'vite-vercel')).gestor, 'bun')
  assert.equal(detectar(join(FIXTURES, 'vite-vercel')).host, 'vercel')
  assert.equal(detectar(join(FIXTURES, 'monorepo')).candidatos.length, 2)
})

test('envolverNextConfig: objeto literal, satisfies y wrappers', () => {
  const literal = envolverNextConfig(`export default {\n  reactStrictMode: true,\n}\n`, 's')
  assert.ok(literal.ok && literal.src.includes(`export default withPeaje({\n  reactStrictMode: true,\n}, { slug: "s" })`))
  const wrapper = envolverNextConfig(`export default withNextIntl(nextConfig)\n`, 's')
  assert.deepEqual(wrapper, { ok: false, motivo: 'complex' })
  const ya = envolverNextConfig(`import { withPeaje } from '@peaje/next'\nexport default withPeaje(c, { slug: 's' })`, 's')
  assert.deepEqual(ya, { ok: false, motivo: 'already' })
  const conPuntoYComa = envolverNextConfig(`const c = {};\nmodule.exports = c;\n`, 's')
  assert.ok(conPuntoYComa.ok && conPuntoYComa.src.endsWith(`module.exports = withPeaje(c, { slug: "s" })\n`))
})

test('insertarPeajeHead no confunde <header> ni <head /> y agregarImport respeta use client', () => {
  const header = insertarPeajeHead(`export default function L({children}) { return <div><header>x</header>{children}</div> }`, 's')
  assert.deepEqual(header, { ok: false, motivo: 'complex' })
  const conDirectiva = agregarImport(`'use client'\nexport const x = 1\n`, `import y from 'y'`)
  assert.equal(conDirectiva, `'use client'\nimport y from 'y'\nexport const x = 1\n`)
})

test('descargarKitCon: mensajes de red, 404 y shape', async () => {
  const red = descargarKitCon(async () => {
    throw new TypeError('fetch failed')
  })
  await assert.rejects(red('http://gw', 'demo', 'next'), /Could not reach the Peaje gateway/)
  const cuatrocientoscuatro = descargarKitCon(async () => new Response('{}', { status: 404 }))
  await assert.rejects(cuatrocientoscuatro('http://gw', 'nadie', 'next'), /No business with slug "nadie"/)
  const raro = descargarKitCon(async () => new Response('{"hola":1}', { status: 200 }))
  await assert.rejects(raro('http://gw', 'demo', 'next'), /Unexpected kit.json shape/)
  const ok = descargarKitCon(async (url) => {
    assert.equal(url, urlKit('http://gw', 'demo', 'next'))
    return new Response(JSON.stringify(kitBase), { status: 200 })
  })
  const kit = await ok('http://gw', 'demo', 'next')
  assert.equal(kit.files.length, kitBase.files.length)
  // El fixture es una foto del gateway: se compara consigo mismo, no con la lista viva de shared.
  const proxy = kit.files.find((f) => f.path === 'peaje/next.config.ts')?.content ?? ''
  assert.equal(proxy.split('source:').length, proxy.split('destination:').length)
  assert.ok(proxy.split('source:').length - 1 >= 15)
})

test('--only aeo en Next: JSON-LD estático en el layout, sin withPeaje, sin dependencia, sin borrados', async () => {
  const dir = copia('next-app')
  const { resultado, codigo } = await init({ ...base, slug: 'demo', dir, solo: 'aeo' })
  assert.equal(codigo, 0)
  assert.equal(pedidos.at(-1)?.solo, 'aeo')

  const config = readFileSync(join(dir, 'next.config.ts'), 'utf8')
  assert.ok(!config.includes('withPeaje'), 'no toca next.config')
  const layout = readFileSync(join(dir, 'app/layout.tsx'), 'utf8')
  assert.ok(!layout.includes('PeajeHead'))
  assert.ok(layout.includes('data-peaje="organization"'))
  assert.ok(layout.includes('dangerouslySetInnerHTML'))
  assert.ok(!layout.includes('<b>'), 'el JSON va como literal JS escapado')
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies?.['@peaje/next'], undefined)
  assert.equal(resultado.moved.length, 0, 'sin proxy no hay copias que mover')
  assert.ok(existsSync(join(dir, 'public/openapi.json')), 'la copia estática queda donde estaba')
  assert.ok(resultado.next.some((n) => n.includes('verify demo --only aeo')))
  assert.ok(!resultado.manual.some((m) => m.includes('/developers')))

  // idempotente
  const segunda = await init({ ...base, slug: 'demo', dir, solo: 'aeo' })
  assert.equal((readFileSync(join(dir, 'app/layout.tsx'), 'utf8').match(/data-peaje="organization"/g) ?? []).length, 1)
  assert.equal(segunda.codigo, 0)
})

test('insertarJsonLdEstatico crea <head> cuando no existe y no duplica', () => {
  const src = `export default function L({ children }) {\n  return (\n    <html lang="es">\n      <body>{children}</body>\n    </html>\n  )\n}\n`
  const r = insertarJsonLdEstatico(src, '{"a":"</script>"}')
  assert.ok(r.ok)
  if (r.ok) {
    assert.match(r.src, /<head>\n\s+<script type="application\/ld\+json" data-peaje="organization" dangerouslySetInnerHTML=\{\{ __html: "/)
    assert.ok(!r.src.includes('</script>"'), 'el cierre de script queda escapado dentro del literal')
    const otra = insertarJsonLdEstatico(r.src, '{}')
    assert.equal(otra.ok, false)
  }
})

test('fusionarRobots conserva lo del sitio, omite el grupo * y el Sitemap duplicado, y es idempotente', () => {
  const propio = 'User-agent: *\nDisallow: /admin/\nSitemap: https://x.com/sitemap.xml\n'
  const kit = '# Agents welcome.\n\nUser-agent: OAI-SearchBot\nUser-agent: Googlebot\nAllow: /\nDisallow: /r/menu\n\nUser-agent: *\nAllow: /\n\n# Where the catalogs live\nSitemap: https://x.com/sitemap.xml'
  const r = fusionarRobots(propio, kit)!
  assert.ok(r.startsWith(propio.trim()))
  assert.ok(r.includes('User-agent: OAI-SearchBot') && r.includes('Disallow: /r/menu'))
  assert.equal((r.match(/^User-agent: \*$/gm) ?? []).length, 1, 'no se duplica el grupo *')
  assert.equal((r.match(/^Sitemap:/gm) ?? []).length, 1, 'no se duplica el Sitemap')
  assert.equal(fusionarRobots(r, kit), null)
})

test('agregarDependencia inserta una sola línea sin reordenar el resto', () => {
  const src = '{\n  "name": "x",\n  "dependencies": {\n    "next": "15.3.0",\n    "react": "19.1.0"\n  }\n}\n'
  const out = agregarDependencia(src, '@peaje/next', '^0.2.0')!
  assert.equal(out.split('\n').length, src.split('\n').length + 1)
  assert.ok(out.includes('    "@peaje/next": "^0.2.0",\n    "next": "15.3.0"'))
  assert.equal(JSON.parse(out).dependencies['@peaje/next'], '^0.2.0')
  assert.equal(agregarDependencia(out, '@peaje/next', '^0.2.0'), null)
})
