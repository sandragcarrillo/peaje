import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { comparativa } from '@/lib/comparar'
import { PaginaComparativa, metadataComparativa } from '../../comparar/vista'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await comparativa('es', (await params).slug)
  return c ? metadataComparativa(c) : {}
}

export default async function CompararPagina({ params }: Props) {
  const c = await comparativa('es', (await params).slug)
  if (!c) notFound()
  return <PaginaComparativa c={c} />
}
