/**
 * Agente comprador que paga por Arc (USDC): firma la autorización EIP-3009
 * off-chain y el gateway la settlea como relayer. El agente NO necesita gas,
 * solo USDC en Arc (ver scripts/fondear-agente-arc.mts).
 *
 * Uso: tsx --env-file=.env scripts/comprar-arc.mts <url-paga>
 */
import { Mppx, evm } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const url = process.argv[2]
if (!url) {
  console.error('uso: tsx scripts/comprar-arc.mts <url-paga>')
  process.exit(1)
}

const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
if (!pk) throw new Error('Falta AGENT_PRIVATE_KEY (el agente necesita USDC en Arc)')
const account = privateKeyToAccount(pk)
console.log(`agente  ${account.address} (paga por Arc)`)

// Solo el método EVM/Arc: aunque el challenge también ofrezca Tempo, este
// agente elige pagar en Arc. Ese es el punto del multi-rail.
Mppx.create({
  methods: [
    evm({
      account,
      authorization: { name: 'USDC', version: '2' },
      networks: [5042002],
    }),
  ],
})

const started = Date.now()
const res = await fetch(url)
console.log(`status  ${res.status} en ${Date.now() - started}ms`)

const receipt = res.headers.get('Payment-Receipt')
if (receipt) console.log(`receipt ${receipt.slice(0, 120)}…`)
const refund = res.headers.get('Payment-Refund')
if (refund) console.log(`refund  https://testnet.arcscan.app/tx/${refund}`)

const body = await res.text()
console.log(`body    ${body.slice(0, 300)}`)
