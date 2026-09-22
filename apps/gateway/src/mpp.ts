import { Mppx } from 'mppx/server'
import { NETWORKS, NETWORK_IDS } from '@peaje/shared'
import { usdcStatus } from './chainlink.js'
import { env } from './env.js'
import { chargeMethods } from './methods.js'

/**
 * Instancia MPP del gateway (transporte HTTP).
 *
 * `recipient` es siempre la treasury de la plataforma: el reparto por tenant
 * ocurre en el ledger interno, no on-chain. Los métodos de cobro (una oferta
 * por red) viven en methods.ts, compartidos con la instancia MCP.
 */
const USDC_TOKENS = new Set(
  NETWORK_IDS.filter((id) => NETWORKS[id].tokenSymbol === 'USDC').map((id) => NETWORKS[id].token.toLowerCase()),
)

export const mppx = Mppx.create({
  secretKey: env.mppSecretKey,
  methods: chargeMethods(),
  // Depeg guard (Chainlink USDC/USD): con USDC despegado, el challenge deja
  // de ofrecer los rieles que cobran en USDC. Los que cobran en otro
  // stablecoin (pathUSD en Tempo, USDG en Robinhood) siguen. Ver chainlink.ts.
  selectOffers: async (offers) => {
    const { depegged } = await usdcStatus()
    if (!depegged) return offers
    return offers.filter((o) => {
      const currency = (o.request as { currency?: string }).currency?.toLowerCase()
      return !USDC_TOKENS.has(currency ?? '')
    })
  },
})
