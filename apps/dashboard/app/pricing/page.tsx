import { permanentRedirect } from 'next/navigation'

// El slug canónico de precios es /precios.
export default function Pricing(): never {
  permanentRedirect('/precios')
}
