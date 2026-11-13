import Link from 'next/link'
import type { Dict } from '@/lib/i18n/dict'
import { BotonCobros } from '../cobros'

/**
 * Cobros a agentes, dentro del kit: el 402 en el dominio es parte de lo que el
 * kit instala, así que el dueño los activa acá y no en un aviso suelto del
 * Inicio. Mainnet: mientras no los active, sus rutas con precio son gratis para
 * los agentes. Sin wallet de cobro el botón lleva a Ingresos, donde se elige.
 */
export function AvisoCobros({ slug, conWallet, t }: { slug: string; conWallet: boolean; t: Dict['dinero'] }) {
  return (
    <div className="mt-5 flex flex-col justify-between gap-4 border border-border bg-bg p-4 sm:flex-row sm:items-center">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">{t.cobrosAvisoTitulo}</p>
        <p className="text-sm text-muted">
          {t.cobrosAvisoTexto}{' '}
          <Link href={t.cobrosArticulo} className="underline underline-offset-4 hover:text-text">
            {t.cobrosConoceMas}
          </Link>
        </p>
        {conWallet ? null : <p className="text-sm text-muted">{t.cobrosSinWallet}</p>}
      </div>
      {conWallet ? (
        <BotonCobros slug={slug} activos={false} />
      ) : (
        <Link href={`/t/${slug}/ingresos`} className="btn btn-primario btn-chico shrink-0 self-start sm:self-center">
          {t.cobrosIrAIngresos}
        </Link>
      )}
    </div>
  )
}
