import type { Metadata } from 'next'
import { metadataFaq, PaginaFaq } from './pagina'

// Preguntas frecuentes en español. La versión en inglés vive en /faq.
export const metadata: Metadata = metadataFaq('es')

export default function Preguntas() {
  return <PaginaFaq locale="es" />
}
