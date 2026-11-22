import type { Metadata } from 'next'
import { Indice, metadataIndice } from '../comparar/vista'

export const metadata: Metadata = metadataIndice('en')

export default function CompareIndice() {
  return <Indice idioma="en" />
}
