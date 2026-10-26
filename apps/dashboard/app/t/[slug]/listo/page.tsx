import { redirect } from 'next/navigation'

/** listo se juntó con Inicio (el panel del negocio). Los links viejos van ahí. */
export default async function Listo({ params }: PageProps<'/t/[slug]/listo'>) {
  const { slug } = await params
  redirect(`/t/${slug}`)
}
