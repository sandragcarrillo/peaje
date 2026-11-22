import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { paginaPara } from '@/lib/para'
import { VistaPara, metadataPara } from '../../para/vista'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await paginaPara('en', (await params).slug)
  return c ? metadataPara(c) : {}
}

export default async function ForPagina({ params }: Props) {
  const c = await paginaPara('en', (await params).slug)
  if (!c) notFound()
  return <VistaPara c={c} />
}
