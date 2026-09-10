import Link from 'next/link'
import { getDict } from '@/lib/i18n'
import { tenantIfMine } from '@/lib/session'
import { Sidebar } from './sidebar'

export default async function TenantLayout({ children, params }: LayoutProps<'/t/[slug]'>) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([tenantIfMine(slug), getDict()])

  if (!tenant) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-medium">{d.panel.necesitasEntrar}</h1>
        <p className="mt-2 text-sm text-muted">
          {d.panel.soloEmailPre}
          <code className="font-mono">{slug}</code>
          {d.panel.soloEmailPost}
        </p>
        <Link
          href="/acceder"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black"
        >
          {d.panel.entrarConEmail}
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
