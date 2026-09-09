/**
 * Agente comprador: wallet nueva (o AGENT_PRIVATE_KEY), fondeada por el
 * faucet de Tempo testnet, que paga challenges MPP por HTTP y muestra el
 * receipt. Sirve para generar compras de agentes distintos en el demo.
 *
 * Uso: pnpm exec tsx scripts/comprar.mts <url-paga>
 */
import { Mppx, tempo } from 'mppx/client'
import { createClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'

const url = process.argv[2]
if (!url) {
  console.error('uso: tsx scripts/comprar.mts <url-paga>')
  process.exit(1)
}

const pk = (process.env.AGENT_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey()
const account = privateKeyToAccount(pk)
console.log(`agente  ${account.address}${process.env.AGENT_PRIVATE_KEY ? '' : ' (wallet nueva)'}`)

if (!process.env.AGENT_PRIVATE_KEY) {
  console.log('fondeando por faucet…')
  const faucet = createClient({ chain: tempoModerato, transport: http() })
  await Actions.faucet.fundSync(faucet, { account: account.address })
  console.log(`private key (guárdala si quieres reusar el agente): ${pk}`)
}

// El fetch global queda interceptado: los 402 se pagan solos.
Mppx.create({ methods: [tempo({ account })] })

const res = await fetch(url)
const receiptHeader = res.headers.get('Payment-Receipt')
const body = await res.text()

console.log(`\nstatus  ${res.status}`)
if (receiptHeader) {
  const receipt = JSON.parse(Buffer.from(receiptHeader, 'base64url').toString())
  console.log(`pagado  tx ${receipt.reference}`)
  console.log(`        https://explore.testnet.tempo.xyz/tx/${receipt.reference}`)
}
console.log(`\n${body.slice(0, 200)}…`)
process.exit(0)
