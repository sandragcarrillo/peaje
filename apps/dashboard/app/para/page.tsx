import type { Metadata } from 'next'
import { Indice, metadataIndice } from './vista'

export const metadata: Metadata = metadataIndice('es')

export default function ParaIndice() {
  return <Indice idioma="es" />
}
