/**
 * Fondea la wallet del agente con USDC en Arc testnet desde la treasury.
 * (En Arc no hay faucet programático como el de Tempo: la treasury se fondea
 * una vez en https://faucet.circle.com y de ahí reparte a agentes de demo.)
 *
 * Uso: tsx --env-file=.env scripts/fondear-agente-arc.mts [address] [monto]
 */
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatUnits, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const USDC = '0x3600000000000000000000000000000000000000' as const

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
})

const treasuryPk = process.env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined
if (!treasuryPk) throw new Error('Falta TREASURY_PRIVATE_KEY')
const treasury = privateKeyToAccount(treasuryPk)

const to = (process.argv[2] ??
  (process.env.AGENT_PRIVATE_KEY
    ? privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`).address
    : undefined)) as `0x${string}` | undefined
if (!to) throw new Error('Pasa una address o define AGENT_PRIVATE_KEY')

const amount = process.argv[3] ?? '5'

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() })
const wallet = createWalletClient({ account: treasury, chain: arcTestnet, transport: http() })

const hash = await wallet.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [to, parseUnits(amount, 6)],
})
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log(`tx ${hash} → ${receipt.status}`)

for (const [label, addr] of [['treasury', treasury.address], ['agente', to]] as const) {
  const b = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [addr] })
  console.log(label.padEnd(9), addr.slice(0, 10), formatUnits(b, 6), 'USDC')
}
