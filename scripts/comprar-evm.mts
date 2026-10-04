/**
 * Agente comprador para los rieles EVM con contrato (Arbitrum, Robinhood):
 * firma la autorización EIP-3009 y el gateway la liquida como relayer.
 * Uso: pnpm exec tsx --env-file=.env scripts/comprar-evm.mts <url-paga> [arbitrum|robinhood]
 */
import { Mppx, evm } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'
const [url, red] = [process.argv[2]!, process.argv[3] ?? 'arbitrum']
const cfg = red === 'robinhood'
  ? { authorization: { name: 'Global Dollar', version: '1' }, networks: [46630], explorer: 'https://explorer.testnet.chain.robinhood.com/tx/' }
  : { authorization: { name: 'USD Coin', version: '2' }, networks: [421614], explorer: 'https://sepolia.arbiscan.io/tx/' }
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)
console.log(`agente  ${account.address} paga por ${red}`)
// Varias ofertas evm en el 402: primero las de la cadena que este agente acepta.
Mppx.create({
  methods: [evm({ account, authorization: cfg.authorization, networks: cfg.networks })],
  orderChallenges: (c: { challenge: { method: string; request: unknown } }[]) => {
    const chain = (x: { challenge: { request: unknown } }) => {
      const r = x.challenge.request as { chainId?: number } | string
      if (typeof r === 'string') { try { return (JSON.parse(Buffer.from(r, 'base64url').toString()) as { chainId?: number }).chainId ?? 0 } catch { return 0 } }
      return r?.chainId ?? 0
    }
    return [...c].sort((a, b) => Number(cfg.networks.includes(chain(b))) - Number(cfg.networks.includes(chain(a))))
  },
})
const t0 = Date.now()
const res = await fetch(url)
console.log(`status  ${res.status} en ${Date.now() - t0}ms`)
const receipt = res.headers.get('Payment-Receipt')
if (receipt) {
  const r = JSON.parse(Buffer.from(receipt, 'base64url').toString()) as { reference?: string; method?: string }
  console.log(`pagado  ${r.method} tx ${r.reference}\n        ${cfg.explorer}${r.reference}`)
}
console.log(`body    ${(await res.text()).slice(0, 80).replace(/\n/g, ' ')}`)
