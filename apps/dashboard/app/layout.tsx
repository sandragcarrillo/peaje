import type { Metadata } from 'next'
import { Hanken_Grotesk, Space_Mono } from 'next/font/google'
import Link from 'next/link'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountMenu } from '@/components/account-menu'
import { getDict, getLocale } from '@/lib/i18n'
import { LocaleProvider } from '@/lib/i18n/client'
import { currentTenant } from '@/lib/session'
import { Logo } from './components/logo'
import './globals.css'
import { Providers } from './providers'

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
                  <Link href="/mercado" className="text-muted hover:text-text">
                    {d.nav.mercado}
                  </Link>
                  <AccountMenu slug={tenant.slug} email={tenant.email ?? tenant.name} />
                  <ThemeToggle />
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
          <p className="mx-auto max-w-5xl font-mono text-xs tracking-[0.08em] text-muted">
            PEAJE · 2026
          </p>
        </footer>
      </body>
    </html>
  )
}
