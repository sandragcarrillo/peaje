import { serve } from '@hono/node-server'
import { TOKENS, tempoConfig, txExplorerUrl } from '@peaje/shared'
import { Hono } from 'hono'
import { Receipt } from 'mppx'
import { Mppx, tempo } from 'mppx/client'
import { createClient, http as viemHttp, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'

/**
 * Agente comprador de demo: un servicio con wallet propia (testnet) que paga
 * challenges MPP a demanda. POST /comprar con una URL paga → el agente paga
 * el 402 y devuelve el recurso + receipt + tx.
 */

const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
if (!pk) throw new Error('Falta AGENT_PRIVATE_KEY')
const account = privateKeyToAccount(pk)

// Con esto, el fetch global paga 402s solo. Testnet únicamente.
Mppx.create({ methods: [tempo({ account })] })

const chain = createClient({ chain: tempoModerato, transport: viemHttp() })
const app = new Hono()

app.get('/', async (c) => {
  const balance = await Actions.token.getBalance(chain, {
    account: account.address,
    token: TOKENS.pathUsd,
  })
  return c.json({
    agente: account.address,
    red: 'tempo testnet (moderato)',
    balance_pathusd: balance.formatted ?? formatUnits(balance.amount, 6),
    uso: 'POST /comprar { "url": "https://gateway/.../ruta-paga" }',
  })
})

/** Recarga la wallet del agente desde el faucet de testnet. */
app.post('/fondear', async (c) => {
  await Actions.faucet.fundSync(chain, { account: account.address })
  return c.json({ ok: true, agente: account.address })
})

app.post('/comprar', async (c) => {
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
  if (!body.url) return c.json({ error: 'Falta "url"' }, 400)

  let target: URL
  try {
    target = new URL(body.url)
  } catch {
    return c.json({ error: 'URL inválida' }, 400)
  }

  const started = Date.now()
  const res = await fetch(target) // paga el 402 solo si aparece

  const receiptHeader = res.headers.get('Payment-Receipt')
  const receipt = receiptHeader ? Receipt.deserialize(receiptHeader) : null
  const text = await res.text()

  return c.json({
    url: target.toString(),
    status: res.status,
    pagado: receipt !== null,
    receipt,
    explorer: receipt ? txExplorerUrl(receipt.reference, true) : null,
    ms: Date.now() - started,
    resultado: text.slice(0, 500),
  })
})

const port = Number(process.env.AGENT_PORT ?? process.env.PORT ?? 4100)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[agente] ${account.address} escuchando en :${info.port}`)
  console.log(`[agente] rpc ${tempoConfig(true).rpcUrl}`)
})
