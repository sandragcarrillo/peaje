import { redirect } from 'next/navigation'

/** Retirar ya no existe: los pagos llegan directo a la dirección de cobro. Los links viejos van a Ingresos. */
export default async function Retirar({ params }: PageProps<'/t/[slug]/retirar'>) {
  const { slug } = await params
  redirect(`/t/${slug}/ingresos`)
}
