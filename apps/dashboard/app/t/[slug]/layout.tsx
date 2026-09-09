import Link from 'next/link'
import { tenantIfMine } from '@/lib/session'
import { Sidebar } from './sidebar'

export default async function TenantLayout({ children, params }: LayoutProps<'/t/[slug]'>) {
  const { slug } = await params
  const tenant = await tenantIfMine(slug)

  if (!tenant) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-medium">Necesitas entrar</h1>
        <p className="mt-2 text-sm text-muted">
          El panel de <code className="font-mono">{slug}</code> solo se abre con el email de ese
          negocio.
        </p>
        <Link
          href="/acceder"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black"
        >
          Entrar con tu email
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-10">
      <Sidebar slug={tenant.slug} name={tenant.name} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
