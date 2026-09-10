import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { LanguageToggle } from '@/components/language-toggle'
import { WalletPopover } from '@/components/wallet-popover'
import { getDict, getLocale } from '@/lib/i18n'
import { LocaleProvider } from '@/lib/i18n/client'
import { currentTenant } from '@/lib/session'
import { Logo } from './components/logo'
import './globals.css'
import { Providers } from './providers'

const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.nav.metaTitulo, description: d.nav.metaDescripcion }
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [tenant, locale, d] = await Promise.all([currentTenant(), getLocale(), getDict()])

  return (
    <html lang={locale}>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <LocaleProvider locale={locale}>
        <Providers>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-bg via-bg/90 to-transparent"
          />
          <header className="sticky top-4 z-40 mx-auto max-w-5xl px-6">
            <div className="flex items-center justify-between rounded-full border border-border bg-panel px-5 py-2.5 shadow-lg shadow-black/30">
              <Link href={tenant ? `/t/${tenant.slug}` : '/'} className="flex items-center">
                <Logo />
              </Link>
              {tenant ? (
                <nav className="flex items-center gap-3 text-sm">
                  <Link href="/mercado" className="text-muted hover:text-text">
                    {d.nav.mercado}
                  </Link>
                  <Link href="/negocios" className="text-muted hover:text-text">
                    {d.nav.negocios}
                  </Link>
                  <Link href="/agentes" className="text-muted hover:text-text">
                    {d.nav.agentes}
                  </Link>
                  <WalletPopover slug={tenant.slug} />
                  <span className="text-muted">{tenant.email ?? tenant.name}</span>
                  <LanguageToggle locale={locale} />
                  <Link
                    href="/salir"
                    prefetch={false}
                    className="rounded-full border border-border px-4 py-1.5 text-xs text-muted hover:border-muted hover:text-text"
                  >
                    {d.nav.salir}
                  </Link>
                </nav>
              ) : (
                <nav className="flex items-center gap-3 text-sm">
                  <Link
                    href="/nuevo"
                    className="rounded-full bg-text px-4 py-1.5 font-medium text-bg"
                  >
                    {d.nav.registrar}
                  </Link>
                  <Link
                    href="/acceder"
                    className="rounded-full border border-border px-4 py-1.5 text-muted hover:border-muted hover:text-text"
                  >
                    {d.nav.entrar}
                  </Link>
                  <LanguageToggle locale={locale} />
                </nav>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 pt-10 pb-28">{children}</main>
        </Providers>
        </LocaleProvider>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-24 bg-gradient-to-t from-bg via-bg/90 to-transparent"
        />
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg px-6 py-6">
          <p className="mx-auto max-w-5xl text-center text-xs text-muted">
            Made with love by{' '}
            <a
              href="https://github.com/sandragcarrillo/peaje"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-2 hover:text-text"
            >
              Team 33
            </a>{' '}
            at Platanus Hack Bogotá 26
          </p>
        </footer>
      </body>
    </html>
  )
}
