import { redirect } from 'next/navigation'

/** Clientes agente (identidad ERC-8004) ya no existe. Los links viejos van al panel. */
export default async function Clientes({ params }: PageProps<'/t/[slug]/clientes'>) {
  const { slug } = await params
  redirect(`/t/${slug}`)
}
