import { redirect } from 'next/navigation'

/** Conexiones pasó a llamarse Integraciones. El navegador conserva el #telegram del enlace viejo. */
export default async function Conexiones({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/t/${slug}/integraciones`)
}
