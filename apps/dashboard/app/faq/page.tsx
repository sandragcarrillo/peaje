import type { Metadata } from 'next'
import { metadataFaq, PaginaFaq } from '../preguntas/pagina'

// Preguntas frecuentes en inglés. La versión en español vive en /preguntas.
export const metadata: Metadata = metadataFaq('en')

export default function Faq() {
  return <PaginaFaq locale="en" />
}
