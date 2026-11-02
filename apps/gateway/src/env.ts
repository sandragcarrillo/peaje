import {
  DEFAULT_CURRENCY,
  modoTestnet,
  NETWORKS,
  SETTLEMENT_CONTRACTS,
  tempoConfig,
  type SettlementNetwork,
} from '@peaje/shared'

/**
 * Un solo interruptor para todos los rieles: NEXT_PUBLIC_RED=mainnet (el mismo
 * nombre en Vercel). TEMPO_NETWORK queda como respaldo del nombre viejo.
 */
const testnet = modoTestnet(process.env.NEXT_PUBLIC_RED ?? process.env.TEMPO_NETWORK)

/**
 * PeajeSettlementV3 de una red, solo desde el env. Sin dirección (o con
 * `off`) el riel no ofrece nada: no hay fallback a v2, que guardaba saldos.
 */
function settlementV3(variable: string): `0x${string}` | null {
  const value = process.env[variable]?.trim()
  if (!value || value === 'off') return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${variable} no es una dirección válida`)
  return value as `0x${string}`
}

function llave(name: string): `0x${string}` | null {
  const value = process.env[name]?.trim()
  if (!value) return null
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} no es una llave privada válida`)
  return value as `0x${string}`
}

const treasuryPrivateKey = required('TREASURY_PRIVATE_KEY') as `0x${string}`
const relayerPrivateKey = llave('RELAYER_PRIVATE_KEY')
// El relayer es una llave caliente con solo gas: nunca la de la treasury.
if (relayerPrivateKey && relayerPrivateKey.toLowerCase() === treasuryPrivateKey.toLowerCase()) {
  throw new Error('RELAYER_PRIVATE_KEY no puede ser la misma llave que TREASURY_PRIVATE_KEY')
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

const treasuryAddress = required('TREASURY_ADDRESS') as `0x${string}`

/**
 * A quién le llega el 2% del split de Tempo. En testnet puede ser la
 * treasury; en mainnet es obligatorio y tiene que ser la dirección fría (la
 * misma que el fee recipient de PeajeSettlementV3), nunca la treasury, cuya
 * llave vive en este servidor.
 */
function feeRecipientTempo(): `0x${string}` {
  const value = process.env.PEAJE_FEE_RECIPIENT?.trim()
  if (!value) {
    if (testnet) return treasuryAddress
    throw new Error('Falta PEAJE_FEE_RECIPIENT: en mainnet el 2% de Tempo va a la dirección fría')
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('PEAJE_FEE_RECIPIENT no es una dirección válida')
  if (!testnet && value.toLowerCase() === treasuryAddress.toLowerCase()) {
    throw new Error('PEAJE_FEE_RECIPIENT no puede ser la treasury en mainnet')
  }
  return value as `0x${string}`
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /**
   * Lo que depende de que los agentes paguen de verdad (el comprador
   * misterioso), apagado hasta mainnet. Mismo nombre que en el dashboard
   * (Vercel), para prender todo con un solo nombre: NEXT_PUBLIC_COBROS=1.
   */
  cobrosVisibles: process.env.NEXT_PUBLIC_COBROS === '1',
  /** Clave para firmar challenges MPP. 32+ bytes. */
  mppSecretKey: required('MPP_SECRET_KEY'),
  /** Wallet de la plataforma: cobros propios de Peaje y reembolsos de Tempo. */
  treasuryAddress,
  /** Destino del 2% en el split de Tempo (en los rieles de contrato lo fija el contrato). */
  tempoFeeRecipient: feeRecipientTempo(),
  currency: (process.env.MPP_CURRENCY ?? DEFAULT_CURRENCY) as `0x${string}`,
  /** true en testnet. Lo decide NEXT_PUBLIC_RED, igual para todos los rieles. */
  testnet,
  /** Clave de la treasury. Firma lo que es de Peaje (reembolsos de Tempo, relayar barridos de agentes). */
  treasuryPrivateKey,
  /**
   * Relayer de PeajeSettlementV3: EOA aparte, con solo gas nativo, habilitada
   * en el contrato con `setRelayer`. Sin ella los rieles de contrato no ofrecen nada.
   */
  relayerPrivateKey,
  /** Secreto compartido entre dashboard y gateway para la API interna. */
  internalSecret: required('INTERNAL_API_SECRET'),
  rpcUrl: process.env.TEMPO_RPC_URL ?? tempoConfig(testnet).rpcUrl,
  /** RPC de Arc. Solo testnet: Arc no publica mainnet todavía. */
  arcRpcUrl: process.env.ARC_RPC_URL ?? NETWORKS.arc.testnet.rpcUrl,
  /**
   * RPC por red con settlement on-chain, en el modo del despliegue (override
   * opcional por variable). null: la red no existe en este modo.
   */
  settlementRpcUrls: (testnet
    ? {
        arbitrum: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? NETWORKS.arbitrum.testnet.rpcUrl,
        'arbitrum-usdg': process.env.ARBITRUM_SEPOLIA_RPC_URL ?? NETWORKS['arbitrum-usdg'].testnet.rpcUrl,
        robinhood: process.env.ROBINHOOD_TESTNET_RPC_URL ?? NETWORKS.robinhood.testnet.rpcUrl,
        arc: process.env.ARC_RPC_URL ?? NETWORKS.arc.testnet.rpcUrl,
      }
    : {
        // El RPC público de Arbitrum One tiene límite de pedidos: en producción va uno propio.
        arbitrum: process.env.ARBITRUM_ONE_RPC_URL ?? NETWORKS.arbitrum.mainnet!.rpcUrl,
        'arbitrum-usdg': process.env.ARBITRUM_ONE_RPC_URL ?? NETWORKS['arbitrum-usdg'].mainnet!.rpcUrl,
        robinhood: null,
        arc: null,
      }) satisfies Record<SettlementNetwork, string | null>,
  /**
   * PeajeSettlementV3 por red, en el modo del despliegue. USDC y USDG de
   * Arbitrum comparten cadena y contrato. En mainnet solo Arbitrum One:
   * Robinhood y Arc no tienen mainnet en NETWORKS. Ver docs/pagos-directos.md.
   */
  settlementV3: (testnet
    ? {
        arbitrum: settlementV3('PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA'),
        'arbitrum-usdg': settlementV3('PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA'),
        robinhood: settlementV3('PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET'),
        arc: settlementV3('PEAJE_SETTLEMENT_V3_ARC_TESTNET'),
      }
    : {
        arbitrum: settlementV3('PEAJE_SETTLEMENT_V3_ARBITRUM_ONE'),
        'arbitrum-usdg': settlementV3('PEAJE_SETTLEMENT_V3_ARBITRUM_ONE'),
        robinhood: null,
        arc: null,
      }) satisfies Record<SettlementNetwork, `0x${string}` | null>,
  /** PeajeSettlement v2 (guardaba saldos): solo para leer pagos viejos. */
  settlementV2: SETTLEMENT_CONTRACTS,
  /**
   * Circle Nanopayments (gateway-arbitrum, gateway-arc): junta los pagos en el
   * saldo Gateway de la treasury y obliga a retirar. Apagado salvo `true`, y
   * siempre en mainnet: el facilitador y los contratos son los de testnet.
   */
  circleNanopayments: testnet && process.env.CIRCLE_NANOPAYMENTS_ENABLED === 'true',
  /** URL pública del gateway (para links en MCP resources y discovery). */
  publicUrl: process.env.GATEWAY_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
  /** URL pública del dashboard: ahí vive la pantalla de permiso del inicio de sesión del MCP. */
  dashboardUrl: process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com',
  /**
   * Take rate de Peaje por transacción (0.02 = 2%). El agente paga el precio
   * listado completo y el negocio recibe el neto en su wallet. En los rieles
   * de contrato el 2% es fijo en PeajeSettlementV3 (FEE_BPS); esto lo usa el
   * split de Tempo y el registro del ledger.
   */
  feePct: Math.min(0.1, Math.max(0, Number(process.env.PEAJE_FEE_PCT ?? '0.02'))),
}
