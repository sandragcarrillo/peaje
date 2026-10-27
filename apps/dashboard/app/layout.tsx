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
import { RadarPill } from './components/radar-pill'
import './globals.css'
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
        {/* Con `name` PeajeHead no pide la agent card al gateway (dice "Peaje"): un fetch menos antes del primer byte. */}
        <PeajeHead slug="peaje" originHost="usepeaje.com" name="Peaje" />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        {/*
          Las secciones a sangre de la landing miden 100vw, y 100vw incluye la
          barra de scroll vertical cuando el sistema la muestra (Windows, Linux,
          macOS con "mostrar siempre"): sobraban ~15px de scroll horizontal.
          `overflow-x: clip` en este envoltorio de ancho completo corta ese
          sobrante sin crear un contenedor de scroll, así el navbar sticky sigue
          pegado. En el body no sirve: ahí se pasa al viewport como `hidden` y
          la página igual se puede correr de lado.
        */}
        <div className="overflow-x-clip">
        <LocaleProvider locale={locale}>
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
                  {/* Salir junto al correo: los dos son de la cuenta; tema e idioma van al final. */}
                  <AccountMenu slug={tenant.slug} email={tenant.email ?? tenant.name} />
                  <form action={salir}>
                    <button
                      type="submit"
                      className="btn btn-secundario btn-chico"
                    >
                      {d.nav.salir}
                    </button>
                  </form>
                  <ThemeToggle />
                  <LanguageToggle locale={locale} />
                </nav>
              ) : (
                <>
                  {/*
                    Enlaces al centro desde lg, como en boringmarketing.com; debajo
                    de lg solo queda la píldora del Radar a la derecha. En el
                    teléfono el CTA largo no entra junto al Radar y el idioma: ahí
                    se esconde y queda el del hero de cada página. Sin CTA en la nav:
                    el de cada página basta (decisión de San, 26 oct 2026).
                  */}
                  <nav aria-label={d.nav.linkComo} className="etiqueta hidden items-center gap-6 lg:flex">
                    <Link href="/#como-funciona" className="text-muted hover:text-text">{d.nav.linkComo}</Link>
                    <Link href="/precios" className="text-muted hover:text-text">{d.nav.linkPrecios}</Link>
                    <RadarPill texto={d.nav.linkRadar} />
                  </nav>
                  <div className="flex items-center gap-2 text-sm sm:gap-3">
                    <span className="contents lg:hidden">
                      <RadarPill texto={d.nav.linkRadar} />
                    </span>
                    <Link href="/acceder" className="etiqueta hidden px-1 text-muted hover:text-text md:inline">
                      {d.nav.entrar}
                    </Link>
                    <span className="hidden lg:contents">
                      <ThemeToggle />
                    </span>
                    <LanguageToggle locale={locale} />
                  </div>
                </>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 pt-10 pb-20">{children}</main>
        </LocaleProvider>
        <footer className="border-t border-border px-6 py-8">
          {/* Paddle exige términos, privacidad, reembolsos y precios enlazados desde todo el sitio. */}
          <nav
            aria-label={d.legal.pieNav}
            className="etiqueta mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-2 text-muted"
          >
            <Link href="/precios" className="hover:text-text">{d.legal.piePrecios}</Link>
            <Link href="/terms" className="hover:text-text">{d.legal.pieTerminos}</Link>
            <Link href="/privacy" className="hover:text-text">{d.legal.piePrivacidad}</Link>
            <Link href="/reembolsos" className="hover:text-text">{d.legal.pieReembolsos}</Link>
            <a href={`mailto:${CONTACTO}`} className="hover:text-text">{d.legal.pieContacto}</a>
          </nav>
          <p className="etiqueta mx-auto mt-4 max-w-5xl text-center text-muted">Peaje · 2026</p>
        </footer>
        </div>
      </body>
    </html>
  )
}
