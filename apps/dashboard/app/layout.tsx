import type { Metadata } from 'next'
import { Hanken_Grotesk, Space_Mono } from 'next/font/google'
import { headers } from 'next/headers'
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
  const [tenant, locale, d, h] = await Promise.all([currentTenant(), getLocale(), getDict(), headers()])
  // El nonce de la CSP (proxy.ts): el script del tema es inline y sin él no corre.
  const nonce = h.get('x-nonce') ?? undefined

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
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
          <header className="isla-tinta sticky top-4 z-40 mx-auto max-w-5xl px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2 rounded-full border border-border bg-panel px-3 py-2.5 shadow-lg sm:px-5 shadow-black/30">
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
                <>
                  {/* Enlaces al centro, como en boringmarketing.com; el Radar gratis destacado. */}
                  <nav aria-label={d.nav.linkProducto} className="hidden items-center gap-6 font-mono text-xs md:flex">
                    <Link href="/#producto" className="text-muted hover:text-text">{d.nav.linkProducto}</Link>
                    <Link href="/#como-funciona" className="text-muted hover:text-text">{d.nav.linkComo}</Link>
                    <Link href="/precios" className="text-muted hover:text-text">{d.nav.linkPrecios}</Link>
                    <Link href="/radar" className="font-bold text-accent hover:text-text">{d.nav.linkRadar}</Link>
                  </nav>
                  <div className="flex items-center gap-2 text-sm sm:gap-3">
                    <Link href="/radar" className="font-mono text-xs font-bold text-accent md:hidden">
                      {d.nav.linkRadar}
                    </Link>
                    <Link href="/acceder" className="hidden px-1 font-mono text-xs text-muted hover:text-text sm:inline">
                      {d.nav.entrar}
                    </Link>
                    <span className="hidden lg:contents">
                      <ThemeToggle />
                    </span>
                    <LanguageToggle locale={locale} />
                    <Link href="/nuevo" className="btn btn-primario btn-chico">
                      {d.nav.usarAgente}
                    </Link>
                  </div>
                </>
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
