import { Providers } from '../providers'

/**
 * Privy (login por código) solo carga acá y en /acceder: son las únicas páginas
 * que lo usan, y su JavaScript (con las librerías de wallets) pesa casi 2 MB.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>
}
