import { redirect } from 'next/navigation'

/** score se juntó con Inicio (el panel del negocio). Los links viejos van ahí. */
export default async function Score({ params }: PageProps<'/t/[slug]/score'>) {
  const { slug } = await params
  redirect(`/t/${slug}`)
}
