import type { Metadata } from 'next'
import { Indice, metadataIndice } from '../para/vista'

export const metadata: Metadata = metadataIndice('en')

export default function ForIndice() {
  return <Indice idioma="en" />
}
