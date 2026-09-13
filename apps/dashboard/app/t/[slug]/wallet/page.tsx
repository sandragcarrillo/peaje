import { redirect } from 'next/navigation'

/** La wallet ya no vive dentro del negocio: es de la persona. Ver /wallet. */
export default function WalletVieja() {
  redirect('/wallet')
}
