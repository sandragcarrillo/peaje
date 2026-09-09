import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listMyTenants } from '@/lib/session'

/** Selector de negocios: un usuario puede tener varios tenants. */
export default async function Negocios() {
  const tenants = await listMyTenants()
  if (tenants.length === 0) redirect('/acceder')

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-medium">Tus negocios</h1>
        <p className="mt-2 text-sm text-muted">Elige a cuál entrar.</p>
      </header>
      <ul className="space-y-2">
        {tenants.map((t) => (
          <li key={t.id}>
            <Link
              href={`/t/${t.slug}`}
              className="block rounded-lg border border-border bg-panel p-4 hover:border-accent"
            >
              <p className="font-medium">{t.name}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {t.slug} · {t.originUrl}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/nuevo" className="inline-block text-sm text-accent hover:underline">
        + Registrar otro negocio
      </Link>
    </div>
  )
}
