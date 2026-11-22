import type { Metadata } from 'next'
import { Indice, metadataIndice } from './vista'

export const metadata: Metadata = metadataIndice('es')

export default function CompararIndice() {
  return <Indice idioma="es" />
}
