import Link from 'next/link'
import { Logo } from '@/components/logos'
import { dictFor, getLocale, type Locale } from '@/lib/i18n'
import { FRASE_ONBOARD, FRASE_ONBOARD_EN } from '@/lib/onboard'
import { CtaPastilla } from './cta-pastilla'

/**
 * El bloque de CTAs de las páginas públicas (referencia de San: revnu.com,
 * 22 nov 2026): "Empezar gratis" al Radar, "Agenda una demo" a /demo y, debajo,
 * la pastilla que copia la instrucción para configurar Peaje desde ChatGPT,
 * Claude o Cursor. Server component: lee el idioma y le pasa a la pastilla
 * solo textos armados. Se usa en el hero y el cierre del home; sirve tal cual
 * al final del Radar y de otras páginas públicas.
 *
 * `locale` fuerza el idioma en las páginas que salen en el de su URL
 * (comparativas, "para", preguntas, blog) y evita leer la cookie. `sinEmpezar`
 * saca "Empezar gratis" donde ese botón llevaría a la misma página (el Radar).
 */
export async function CtaInicio({
  alinear = 'centro',
  className = '',
  locale: forzado,
  sinEmpezar = false,
}: {
  alinear?: 'centro' | 'inicio'
  className?: string
  locale?: Locale
  sinEmpezar?: boolean
}) {
  const locale = forzado ?? (await getLocale())
  const t = dictFor(locale).landing.cta
  const frase = locale === 'es' ? FRASE_ONBOARD : FRASE_ONBOARD_EN

  return (
    <div className={`flex w-full flex-col gap-5 ${alinear === 'centro' ? 'items-center' : 'items-start'} ${className}`}>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {sinEmpezar ? null : (
          <Link href="/radar" className="cta-boton cta-principal">
            {t.empezar}
          </Link>
        )}
        <Link href="/demo" className="cta-boton cta-oscuro group">
          {t.demo}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          >
            <path d="M3 8h9.5M8.75 4.25 12.5 8l-3.75 3.75" />
          </svg>
        </Link>
      </div>
      <CtaPastilla
        frase={frase}
        texto={t.configurar}
        dominio={t.configurarDominio}
        pista={t.configurarPista}
        copiado={t.copiado}
        alinear={alinear}
        logos={
          <>
            <span className="cta-logo relative z-[3]">
              <Logo marca="chatgpt" className="h-3.5 w-3.5" />
            </span>
            <span className="cta-logo relative z-[2]">
              <Logo marca="claude" className="h-3.5 w-3.5" />
            </span>
            <span className="cta-logo relative z-[1]">
              <Logo marca="cursor" className="h-3.5 w-3.5" />
            </span>
          </>
        }
      />
    </div>
  )
}
