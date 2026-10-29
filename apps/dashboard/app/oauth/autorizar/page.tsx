import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDict } from '@/lib/i18n'
import { destinoVisible, revisarPedido } from '@/lib/oauth'
import { currentUserId } from '@/lib/session'
import { store } from '@/lib/store'
import { Permiso } from './permiso'

/**
 * Pantalla de permiso del inicio de sesión del MCP: la herramienta (Claude,
 * ChatGPT, Cursor…) manda acá a la persona, que inicia sesión si hace falta,
 * elige el negocio y da permiso. El código lo canjea el gateway
 * (apps/gateway/src/oauth.ts). Sin cliente o con un redirect ajeno no se
 * redirige a ningún lado: se muestra el problema.
 */
export default async function Autorizar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const crudos = await searchParams
  const p = Object.fromEntries(Object.entries(crudos).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>
  const pedido = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === 'string')).toString()
  const [r, d] = await Promise.all([revisarPedido(p), getDict()])
  const t = d.oauth

  if (!r.ok && 'problema' in r) return <Problema titulo={t.problemaTitulo} texto={r.problema === 'cliente' ? t.problemaCliente : t.problemaRedirect} />
  if (!r.ok) redirect(r.volver)

  const userId = await currentUserId()
  if (!userId) redirect(`/acceder?volver=${encodeURIComponent(`/oauth/autorizar?${pedido}`)}`)
  const negocios = await store.listTenantsByPrivyUserId(userId)
  if (negocios.length === 0) {
    return (
      <Problema titulo={t.problemaTitulo} texto={t.sinNegocio}>
        <Link href="/nuevo" className="btn btn-primario btn-chico">
          {t.crearNegocio}
        </Link>
      </Problema>
    )
  }

  return (
    <Permiso
      pedido={pedido}
      herramienta={r.pedido.cliente.name}
      destino={destinoVisible(r.pedido.redirectUri)}
      negocios={negocios.map((n) => ({ slug: n.slug, nombre: n.name, sitio: n.originUrl }))}
    />
  )
}

function Problema({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16">
      <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
      <p className="text-sm text-muted">{texto}</p>
      {children}
    </div>
  )
}
