import 'server-only'
import { NETWORK_IDS, NETWORKS } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { validarDireccionPropia, type ResultadoDireccion } from './direccion-propia'
import { idWalletDeLaApp } from './privy'
import { store } from './store'

/** Un RPC por cadena (Arbitrum USDC y USDG comparten cadena). */
const RPC_POR_CADENA = new Map<string, string>()
for (const id of NETWORK_IDS) {
  const { chainId, rpcUrl } = NETWORKS[id].testnet
  if (![...RPC_POR_CADENA.values()].includes(rpcUrl)) RPC_POR_CADENA.set(String(chainId), rpcUrl)
}

const clientes = new Map<string, ReturnType<typeof createPublicClient>>()
function cliente(cadena: string) {
  let c = clientes.get(cadena)
  if (!c) {
    c = createPublicClient({ transport: http(RPC_POR_CADENA.get(cadena), { timeout: 8_000 }) })
    clientes.set(cadena, c)
  }
  return c
}

/** Valida contra las redes reales, la base y la app de Privy configurada. */
export function validarDireccionDelNegocio(
  raw: string,
  walletDelDueno: { id: string | null; address: string | null },
): Promise<ResultadoDireccion> {
  return validarDireccionPropia(raw, {
    // Opcional en el dashboard: sin la variable se salta solo esta regla.
    treasury: process.env.TREASURY_ADDRESS ?? null,
    redes: [...RPC_POR_CADENA.keys()],
    codigoEn: (cadena, address) => cliente(cadena).getCode({ address }),
    esWalletDeAgente: async (address) => (await store.getAgentByWalletAddress(address)) !== null,
    idWalletDeLaApp,
    walletDelDueno,
  })
}
