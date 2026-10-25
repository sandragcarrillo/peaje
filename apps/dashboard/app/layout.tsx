import type { Metadata } from 'next'
import { Hanken_Grotesk, Space_Mono } from 'next/font/google'
import Link from 'next/link'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountMenu } from '@/components/account-menu'
import { getDict, getLocale } from '@/lib/i18n'
import { LocaleProvider } from '@/lib/i18n/client'
import { currentTenant } from '@/lib/session'
import { CONTACTO } from '@/lib/legal'
import { Logo } from './components/logo'
import './globals.css'
import { Providers } from './providers'
import { PeajeHead } from '@peaje/next/head'
import { salir } from './salir/actions'

// Grotesca para titulares y body, mono para todo el chrome técnico.
// Ver design/direccion-visual.md §3.
const sans = Hanken_Grotesk({ variable: '--font-grotesca', subsets: ['latin'] })
const mono = Space_Mono({ variable: '--font-chrome', weight: ['400', '700'], subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.nav.metaTitulo, description: d.nav.metaDescripcion }
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [tenant, locale, d] = await Promise.all([currentTenant(), getLocale(), getDict()])

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tema antes de hidratar, sin parpadeo
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('peaje_theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <PeajeHead slug="peaje" originHost="usepeaje.com" />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <LocaleProvider locale={locale}>
        <Providers>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-bg via-bg/90 to-transparent"
          />
          <header className="isla-tinta sticky top-4 z-40 mx-auto max-w-5xl px-6">
            <div className="flex items-center justify-between rounded-full border border-border bg-panel px-5 py-2.5 shadow-lg shadow-black/30">
              <Link href="/" className="flex items-center">
                <Logo />
              </Link>
              {tenant ? (
                <nav className="flex items-center gap-3 text-sm">
                  <AccountMenu slug={tenant.slug} email={tenant.email ?? tenant.name} />
                  <ThemeToggle />
                  <LanguageToggle locale={locale} />
                  <form action={salir}>
                    <button
                      type="submit"
                      className="btn btn-secundario btn-chico"
                    >
                      {d.nav.salir}
                    </button>
                  </form>
                </nav>
              ) : (
                <nav className="flex items-center gap-3 text-sm">
                  <Link
                    href="/nuevo"
                    className="btn btn-primario btn-chico"
                  >
                    {d.nav.registrar}
                  </Link>
                  <Link
                    href="/acceder"
                    className="btn btn-secundario btn-chico"
                  >
                    {d.nav.entrar}
                  </Link>
                  <ThemeToggle />
                  <LanguageToggle locale={locale} />
                </nav>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 pt-10 pb-20">{children}</main>
        </Providers>
        </LocaleProvider>
        <footer className="border-t border-border px-6 py-8">
          {/* Paddle exige términos, privacidad, reembolsos y precios enlazados desde todo el sitio. */}
          <nav
            aria-label={d.legal.pieNav}
            className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs text-muted"
          >
            <Link href="/precios" className="hover:text-text">{d.legal.piePrecios}</Link>
            <Link href="/terms" className="hover:text-text">{d.legal.pieTerminos}</Link>
            <Link href="/privacy" className="hover:text-text">{d.legal.piePrivacidad}</Link>
            <Link href="/reembolsos" className="hover:text-text">{d.legal.pieReembolsos}</Link>
            <a href={`mailto:${CONTACTO}`} className="hover:text-text">{d.legal.pieContacto}</a>
          </nav>
          <p className="mx-auto mt-4 max-w-5xl text-center font-mono text-xs text-muted">Peaje · 2026</p>
        </footer>
      </body>
    </html>
  )
}
