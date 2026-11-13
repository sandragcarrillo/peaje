// Las páginas que el sitio ya tiene, del sitemap: sirven para no proponer como
// nueva una página que ya existe con otras palabras.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paginasDelSitio } from '../src/acceso/revisar.js'

const XML: Record<string, string> = {
  'https://tienda.test/sitemap.xml': `<?xml version="1.0"?><sitemapindex>
    <sitemap><loc>https://tienda.test/sitemap-1.xml</loc></sitemap>
    <sitemap><loc>https://tienda.test/sitemap-2.xml</loc></sitemap>
  </sitemapindex>`,
  'https://tienda.test/sitemap-1.xml': `<urlset>
    <url><loc>https://tienda.test/</loc></url>
    <url><loc>https://tienda.test/blog/que-es-mcp</loc><lastmod>2026-11-01T10:00:00Z</lastmod></url>
    <url><loc>https://tienda.test/privacy</loc></url>
  </urlset>`,
  'https://tienda.test/sitemap-2.xml': `<urlset>
    <url><loc>https://tienda.test/blog/what-is-mcp</loc></url>
    <url><loc>https://tienda.test/blog/que-es-mcp</loc></url>
    <url><loc>https://otro.test/blog/ajeno</loc></url>
    <url><loc>https://tienda.test/logo.png</loc></url>
  </urlset>`,
}

test('lee todos los sitemaps del índice, sin legales, archivos, otros dominios ni repetidas; guarda 15 minutos', async () => {
  const original = globalThis.fetch
  let pedidos = 0
  globalThis.fetch = (async (url: string | URL) => {
    pedidos += 1
    const xml = XML[String(url)]
    return new Response(xml ?? 'no', { status: xml ? 200 : 404 })
  }) as typeof fetch
  try {
    const r = await paginasDelSitio('tienda.test')
    assert.equal(r.encontrado, true)
    assert.deepEqual(
      r.paginas.map((p) => p.path),
      ['/', '/blog/que-es-mcp', '/blog/what-is-mcp'],
    )
    assert.equal(r.paginas[1]!.lastmod, '2026-11-01T10:00:00Z')
    const antes = pedidos
    await paginasDelSitio('tienda.test')
    assert.equal(pedidos, antes)

    const sin = await paginasDelSitio('vacio.test')
    assert.deepEqual(sin, { encontrado: false, paginas: [] })
  } finally {
    globalThis.fetch = original
  }
})
