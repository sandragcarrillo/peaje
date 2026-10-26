/**
 * Barrido de fondos de testnet de las wallets de la app de Privy vieja a sus
 * contrapartes nuevas. Ver docs/privy-migracion.md. Correr DESPUÉS de
 * scripts/privy-migracion.mts --apply (sin eso no hay destino).
 *
 * Por defecto es --dry: lee saldos y muestra qué movería. Con --apply firma
 * con las wallets viejas (PRIVY_VIEJA_APP_ID / PRIVY_VIEJA_APP_SECRET, siguen
 * siendo de la app vieja) y mueve, por red y token:
 *
 * - Negocio: custodiada vieja (custodial_wallet_legacy) → wallet del dueño (owner_wallet).
 * - Agente: wallet vieja (wallet_address_legacy) → su wallet nueva (wallet_address).
 * - Wallets de la app vieja que nada referencia (agentes borrados, pruebas):
 *   solo con --huerfanas-a=treasury o --huerfanas-a=0x…; si no, se listan.
 *
 * Cómo se mueve cada red:
 * - Arc, Arbitrum (USDC y USDG), Robinhood: EIP-3009 transferWithAuthorization
 *   firmada por la wallet vieja y sometida por la treasury (TREASURY_PRIVATE_KEY),
 *   que paga el gas. Se mueve el saldo entero. Bajo 0.01 se salta.
 * - Tempo: transfer desde la wallet vieja con fee en pathUSD (el gas sale del
 *   mismo token). Se deja 0.005 para la comisión. Bajo 0.01 se salta.
 *
 * Saldo dentro de PeajeSettlement (claimable) no se mueve acá: si aparece,
 * se avisa (hoy es 0 en las cinco wallets de negocio).
 *
 *   pnpm exec tsx --env-file=.env scripts/privy-barrer.mts            # plan
 *   pnpm exec tsx --env-file=.env scripts/privy-barrer.mts --apply    # mueve
 */
import { getStore } from '@peaje/db'
import { CLAIMABLE_ABI, fromBaseUnits, NETWORK_IDS, NETWORKS, SETTLEMENT_CONTRACTS, TOKENS, type NetworkId } from '@peaje/shared'
import { PrivyClient } from '@privy-io/node'
import { createViemAccount } from '@privy-io/node/viem'
import {
  createClient,
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseAbi,
  parseSignature,
  parseUnits,
  type LocalAccount,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'

const APLICAR = process.argv.includes('--apply')
const huerfanasFlag = process.argv.find((a) => a.startsWith('--huerfanas-a='))?.slice('--huerfanas-a='.length) ?? null

const MINIMO = 0.01
const MARGEN_TEMPO = 0.005

const appId = process.env.PRIVY_VIEJA_APP_ID
const appSecret = process.env.PRIVY_VIEJA_APP_SECRET
if (!appId || !appSecret) throw new Error('Faltan PRIVY_VIEJA_APP_ID / PRIVY_VIEJA_APP_SECRET')
if (appId === process.env.PRIVY_NUEVA_APP_ID) throw new Error('PRIVY_VIEJA_APP_ID es la app nueva')
const vieja = new PrivyClient({ appId, appSecret })

const treasuryKey = process.env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined
const treasury = treasuryKey ? privateKeyToAccount(treasuryKey) : null
if (APLICAR && !treasury) throw new Error('Falta TREASURY_PRIVATE_KEY: paga el gas de los transfers relayados')

const huerfanasA: `0x${string}` | null =
  huerfanasFlag === 'treasury' ? (treasury?.address ?? null) : /^0x[0-9a-fA-F]{40}$/.test(huerfanasFlag ?? '') ? (huerfanasFlag as `0x${string}`) : null

// ---- clientes por red ----

function cadena(network: NetworkId) {
  const def = NETWORKS[network]
  return defineChain({
    id: def.testnet.chainId,
    name: def.label,
    nativeCurrency: network === 'arc' ? { name: 'USDC', symbol: 'USDC', decimals: 18 } : { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [def.testnet.rpcUrl] } },
  })
}
const lectores = new Map<NetworkId, ReturnType<typeof createPublicClient>>()
function lector(network: NetworkId) {
  let c = lectores.get(network)
  if (!c) {
    c = createPublicClient({ chain: cadena(network), transport: http() })
    lectores.set(network, c)
  }
  return c
}

async function saldo(network: NetworkId, address: `0x${string}`): Promise<bigint> {
  return lector(network).readContract({ address: NETWORKS[network].token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
}

async function claimable(network: NetworkId, address: `0x${string}`): Promise<bigint> {
  const contrato = SETTLEMENT_CONTRACTS[network]
  if (!contrato) return 0n
  return lector(network).readContract({ address: contrato, abi: CLAIMABLE_ABI, functionName: 'claimable', args: [NETWORKS[network].token, address] })
}

const eip3009Abi = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
])

async function moverRelayado(network: NetworkId, firmante: LocalAccount, to: `0x${string}`, value: bigint) {
  const def = NETWORKS[network]
  const chain = cadena(network)
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600)
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`
  const signature = await firmante.signTypedData({
    domain: { ...def.eip3009!, chainId: chain.id, verifyingContract: def.token },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: { from: firmante.address, to, value, validAfter: 0n, validBefore, nonce },
  })
  const { r, s, v, yParity } = parseSignature(signature)
  const relayer = createWalletClient({ account: treasury!, chain, transport: http() })
  const hash = await relayer.writeContract({
    address: def.token,
    abi: eip3009Abi,
    functionName: 'transferWithAuthorization',
    args: [firmante.address, to, value, 0n, validBefore, nonce, v !== undefined ? Number(v) : yParity + 27, r, s],
  })
  const receipt = await lector(network).waitForTransactionReceipt({ hash, timeout: 60_000 })
  if (receipt.status !== 'success') throw new Error(`revertida ${hash}`)
  return hash
}

async function moverTempo(firmante: LocalAccount, to: `0x${string}`, value: bigint) {
  const wallet = createClient({ account: firmante, chain: { ...tempoModerato, feeToken: TOKENS.pathUsd }, transport: http() })
  return Actions.token.transfer(wallet, { to, token: TOKENS.pathUsd, amount: value })
}

// ---- qué se barre ----

type Origen = { etiqueta: string; address: `0x${string}`; walletId: string; destino: `0x${string}` | null; motivoSinDestino?: string }

const store = getStore()
const origenes: Origen[] = []
const referenciadas = new Set<string>()

for (const t of await store.listTenants()) {
  const address = (t.custodialWalletLegacy ?? t.custodialWallet) as `0x${string}` | null
  const walletId = t.custodialWalletIdLegacy ?? t.custodialWalletId
  if (t.slug === 'clima-andino') {
    // No se toca: sus wallets cuentan como referenciadas para no barrerlas como huérfanas.
    for (const a of await store.listAgents(t.id)) referenciadas.add(a.walletAddress.toLowerCase())
    continue
  }
  if (address) referenciadas.add(address.toLowerCase())
  if (address && walletId) {
    const destino = t.custodialWalletLegacy ? (t.ownerWallet as `0x${string}` | null) : null
    origenes.push({ etiqueta: `negocio ${t.slug}`, address, walletId, destino, motivoSinDestino: destino ? undefined : 'falta correr privy-migracion --apply' })
  }
  for (const a of await store.listAgents(t.id)) {
    const vieja = (a.walletAddressLegacy ?? a.walletAddress) as `0x${string}`
    const id = a.privyWalletIdLegacy ?? a.privyWalletId
    referenciadas.add(vieja.toLowerCase())
    if (!id) continue
    const dest = a.walletAddressLegacy ? (a.walletAddress as `0x${string}`) : null
    origenes.push({ etiqueta: `agente ${t.slug}/${a.name}`, address: vieja, walletId: id, destino: dest, motivoSinDestino: dest ? undefined : 'falta correr privy-migracion --apply' })
  }
}

// Wallets de la app vieja que ninguna fila referencia.
for await (const w of vieja.wallets().list({ chain_type: 'ethereum' })) {
  if (referenciadas.has(w.address.toLowerCase())) continue
  origenes.push({
    etiqueta: `huérfana ${w.display_name ?? w.id}`,
    address: w.address as `0x${string}`,
    walletId: w.id,
    destino: huerfanasA,
    motivoSinDestino: huerfanasA ? undefined : 'sin destino (usa --huerfanas-a=treasury o una address)',
  })
}

// ---- plan y ejecución ----

const corta = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`
console.log(APLICAR ? 'Modo --apply: mueve fondos de testnet.' : 'Modo --dry: solo lee saldos, no mueve nada.')
if (treasury) console.log(`Treasury (paga el gas relayado): ${corta(treasury.address)}`)

let movimientos = 0
let fallos = 0
for (const o of origenes) {
  const lineas: string[] = []
  for (const network of NETWORK_IDS) {
    const def = NETWORKS[network]
    let raw: bigint
    try {
      raw = await saldo(network, o.address)
    } catch {
      lineas.push(`      ? ${def.label}: no se pudo leer`)
      continue
    }
    const enContrato = await claimable(network, o.address).catch(() => 0n)
    if (enContrato > 0n) lineas.push(`      ! ${def.label}: ${fromBaseUnits(enContrato, def.decimals)} en PeajeSettlement (no se mueve acá)`)
    if (raw === 0n) continue
    const monto = Number(fromBaseUnits(raw, def.decimals))
    const enviar = network === 'tempo' ? raw - parseUnits(String(MARGEN_TEMPO), def.decimals) : raw
    if (monto < MINIMO || enviar <= 0n) {
      lineas.push(`      · ${def.label}: ${monto} ${def.tokenSymbol} (polvo, se salta)`)
      continue
    }
    const txt = `${fromBaseUnits(enviar, def.decimals)} ${def.tokenSymbol}`
    if (!o.destino) {
      lineas.push(`      · ${def.label}: ${txt} sin mover (${o.motivoSinDestino})`)
      continue
    }
    if (!APLICAR) {
      lineas.push(`      → ${def.label}: ${txt} → ${corta(o.destino)}`)
      movimientos++
      continue
    }
    try {
      const firmante = createViemAccount(vieja, { walletId: o.walletId, address: o.address }) as unknown as LocalAccount
      const hash = network === 'tempo' ? await moverTempo(firmante, o.destino, enviar) : await moverRelayado(network, firmante, o.destino, enviar)
      lineas.push(`      ✓ ${def.label}: ${txt} → ${corta(o.destino)} (${def.testnet.explorerUrl}/tx/${hash})`)
      movimientos++
    } catch (e) {
      lineas.push(`      ✗ ${def.label}: ${txt} falló: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`)
      fallos++
    }
  }
  console.log(`\n  ${o.etiqueta} ${corta(o.address)}${o.destino ? ` → ${corta(o.destino)}` : ''}`)
  console.log(lineas.length > 0 ? lineas.join('\n') : '      sin saldo')
}

console.log(
  `\n${APLICAR ? 'Movidos' : 'A mover'}: ${movimientos}${fallos ? `, fallidos: ${fallos} (re-correr reintenta solo lo que quede)` : ''}.`,
)
if (!APLICAR) console.log('Nada se movió. Corre con --apply para barrer.')
