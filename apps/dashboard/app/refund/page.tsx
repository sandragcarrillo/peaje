import { permanentRedirect } from 'next/navigation'

// El slug canónico de la política es /reembolsos, como en Puente.
export default function Refund(): never {
  permanentRedirect('/reembolsos')
}
