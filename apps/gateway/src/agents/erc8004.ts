import type { Agent, Tenant } from '@peaje/db'
import { NETWORKS, isNetworkId } from '@peaje/shared'
import { createPublicClient, createWalletClient, http, parseEventLogs } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { env } from '../env.js'
import { agentAccount } from './wallet.js'

/**
 * Identidad on-chain de los agentes: ERC-8004 (Trustless Agents).
 *
 * El IdentityRegistry es un ERC-721 permissionless: `register(agentURI)`
 * mintea un token cuyo tokenURI apunta a la "agent card", el JSON que Peaje
 * sirve desde su propio gateway (la spec acepta https://, no exige IPFS).
 *
 * El registro se hace en dos pasos y el segundo es el importante:
 *  1. La treasury mintea (paga el gas). Al mintear, agentWallet == treasury.
 *  2. `setAgentWallet` reapunta la identidad a la wallet del agente, firmando
 *     con esa wallet vía EIP-712. Sin este paso, todos los agentes de Peaje
 *     se verían como la misma address y el vendedor no podría distinguir
 *     quién le compró.
 *
 * Registro: https://eips.ethereum.org/EIPS/eip-8004
 */

/** Misma address en todas las testnets (deploy CREATE2). Mainnet difiere. */
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

/** Base Sepolia: es una de las redes que el subgraph de Agent0 indexa. */
const CHAIN = baseSepolia

const registryAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setAgentWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newWallet', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'
const publicClient = createPublicClient({ chain: CHAIN, transport: http(rpcUrl) })

function treasuryWallet() {
  return createWalletClient({
    account: privateKeyToAccount(env.treasuryPrivateKey),
    chain: CHAIN,
    transport: http(rpcUrl),
  })
}

/** URL pública de la agent card de un agente. Es el agentURI del registro. */
export function agentCardUrl(tenant: Tenant, agent: Agent): string {
  return `${env.publicUrl}/${tenant.slug}/agents/${agent.id}/card.json`
}

/**
 * Agent card en el formato del EIP (campos `services`, `x402Support`,
 * `supportedTrust`). Las skills OASF van dentro del servicio OASF, no en la
 * raíz: así las lee el subgraph de Agent0.
 */
export function agentCard(tenant: Tenant, agent: Agent): Record<string, unknown> {
  const base = `${env.publicUrl}/${tenant.slug}`
  const red = isNetworkId(agent.network) ? NETWORKS[agent.network] : null

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name,
    description:
      `Agente comprador de ${tenant.name}, operado con Peaje. Misión: ${agent.mission}. ` +
      `Paga por request vía MPP (HTTP 402)${red ? ` en ${red.label} con ${red.tokenSymbol}` : ''}, ` +
      'con presupuesto acotado al saldo de su propia wallet.',
    image: `${env.publicUrl}/agent-avatar.png`,
    services: [
      { name: 'web', endpoint: base },
      {
        name: 'OASF',
        endpoint: `${base}/agents/${agent.id}/card.json`,
        version: '0.8',
        skills: ['payments/x402', 'discovery/service_selection'],
        domains: ['commerce', 'apis integration'],
      },
    ],
    x402Support: true,
    active: agent.status !== 'done',
    registrations: [
      {
        agentId: agent.erc8004AgentId ? Number(agent.erc8004AgentId) : undefined,
        agentRegistry: `eip155:${CHAIN.id}:${IDENTITY_REGISTRY}`,
      },
    ],
    supportedTrust: ['reputation'],
  }
}

export type RegistroResultado = {
  agentId: string
  chainId: number
  tx: string
  walletVinculada: boolean
}

/**
 * Registra el agente en ERC-8004 y vincula su wallet. Devuelve null si falta
 * configuración o si la treasury no tiene gas en Base Sepolia: el agente
 * funciona igual sin identidad on-chain, solo que anónimo.
 */
export async function registrarAgente(
  tenant: Tenant,
  agent: Agent,
): Promise<RegistroResultado | null> {
  if (!agent.privyWalletId) return null

  const uri = agentCardUrl(tenant, agent)
  if (uri.includes('localhost')) {
    console.warn(
      '[erc8004] GATEWAY_PUBLIC_URL apunta a localhost: la card no sería accesible. Se omite el registro.',
    )
    return null
  }

  try {
    const wallet = treasuryWallet()

    // El hash es lo único que devuelve writeContract; el agentId sale del
    // evento Registered del receipt (fuente autoritativa).
    const tx = await wallet.writeContract({
      address: IDENTITY_REGISTRY,
      abi: registryAbi,
      functionName: 'register',
      args: [uri],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
    const [evento] = parseEventLogs({ abi: registryAbi, eventName: 'Registered', logs: receipt.logs })
    if (!evento) throw new Error('El registro no emitió el evento Registered')
    const agentId = evento.args.agentId.toString()

    const walletVinculada = await vincularWallet(agentId, agent).catch((error) => {
      console.warn('[erc8004] registrado pero no se pudo vincular la wallet:', error)
      return false
    })

    console.log('[erc8004] agente registrado', { agente: agent.name, agentId, walletVinculada })
    return { agentId, chainId: CHAIN.id, tx, walletVinculada }
  } catch (error) {
    console.warn('[erc8004] no se pudo registrar al agente:', error)
    return null
  }
}

/**
 * Vincula la wallet del agente a su identidad. La firma EIP-712 la produce la
 * propia wallet del agente (Privy), que es la prueba de control que pide el
 * contrato. El deadline tiene que caer dentro de los 5 minutos.
 */
async function vincularWallet(agentId: string, agent: Agent): Promise<boolean> {
  const account = agentAccount(agent.privyWalletId!, agent.walletAddress as `0x${string}`)
  const owner = privateKeyToAccount(env.treasuryPrivateKey).address
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 240)

  const signature = await account.signTypedData({
    domain: {
      name: 'ERC8004IdentityRegistry',
      version: '1',
      chainId: CHAIN.id,
      verifyingContract: IDENTITY_REGISTRY,
    },
    types: {
      AgentWalletSet: [
        { name: 'agentId', type: 'uint256' },
        { name: 'newWallet', type: 'address' },
        { name: 'owner', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'AgentWalletSet',
    message: {
      agentId: BigInt(agentId),
      newWallet: agent.walletAddress as `0x${string}`,
      owner,
      deadline,
    },
  })

  const tx = await treasuryWallet().writeContract({
    address: IDENTITY_REGISTRY,
    abi: registryAbi,
    functionName: 'setAgentWallet',
    args: [BigInt(agentId), agent.walletAddress as `0x${string}`, deadline, signature],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  return receipt.status === 'success'
}

/** Address de la treasury y su saldo en Base Sepolia, para diagnóstico. */
export async function estadoRegistro() {
  const address = privateKeyToAccount(env.treasuryPrivateKey).address
  const balance = await publicClient.getBalance({ address }).catch(() => null)
  return {
    chain: CHAIN.name,
    chainId: CHAIN.id,
    registry: IDENTITY_REGISTRY,
    treasury: address,
    balanceWei: balance?.toString() ?? null,
    listo: balance !== null && balance > 0n,
  }
}
