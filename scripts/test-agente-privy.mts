/**
 * Prueba el linchpin del agente comprador: ¿una wallet custodiada por Privy
 * puede firmar la autorización EIP-3009 que pide el rail de Arc y pagar un
 * 402 real? Si esto anda, el resto del agente es UI.
 *
 * Uso: tsx --env-file=.env scripts/test-agente-privy.mts <url-paga>
 */
import { PrivyClient } from '@privy-io/node'
import { createViemAccount } from '@privy-io/node/viem'
import { Mppx, evm } from 'mppx/client'
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatUnits, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const url = process.argv[2] ?? 'http://localhost:8787/clima-andino/r/advanced-discovery'
const USDC = '0x3600000000000000000000000000000000000000' as const

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
})

const privy = new PrivyClient({
  appId: (process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID)!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

// 1. Wallet del agente, creada por Privy (igual que la del merchant).
const wallet = await privy.wallets().create({
  chain_type: 'ethereum',
  display_name: `agente-test-${Date.now()}`,
})
console.log(`agente   ${wallet.address} (privy wallet ${wallet.id})`)

// 2. Fondeo desde la treasury: el presupuesto del agente ES su saldo.
const treasury = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY as `0x${string}`)
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() })
const treasuryWallet = createWalletClient({ account: treasury, chain: arcTestnet, transport: http() })

const fondeo = await treasuryWallet.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [wallet.address as `0x${string}`, parseUnits('0.5', 6)],
})
await publicClient.waitForTransactionReceipt({ hash: fondeo })
console.log(`fondeo   0.5 USDC · tx ${fondeo}`)

// 3. El agente paga el 402 firmando con Privy (sin clave privada local).
const account = createViemAccount(privy, {
  walletId: wallet.id,
  address: wallet.address as `0x${string}`,
})

Mppx.create({
  methods: [
    evm({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account: account as any,
      authorization: { name: 'USDC', version: '2' },
      networks: [arcTestnet.id],
    }),
  ],
})

const started = Date.now()
const res = await fetch(url)
console.log(`pago     status ${res.status} en ${Date.now() - started}ms`)
console.log(`receipt  ${res.headers.get('Payment-Receipt')?.slice(0, 60) ?? 'sin receipt'}…`)

const saldo = await publicClient.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [wallet.address as `0x${string}`],
})
console.log(`saldo    ${formatUnits(saldo, 6)} USDC restantes`)
console.log(res.ok ? '\n✅ Privy firma EIP-3009 y paga en Arc' : '\n❌ falló el pago')
