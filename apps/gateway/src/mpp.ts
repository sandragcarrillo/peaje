import { Mppx } from 'mppx/server'
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
export const mppx = Mppx.create({
  secretKey: env.mppSecretKey,
  methods: chargeMethods(),
  // Depeg guard (Chainlink USDC/USD): con USDC despegado, el challenge deja
  // de ofrecer el rail EVM/Arc y solo queda Tempo. Ver chainlink.ts.
  selectOffers: async (offers) => {
    const { depegged } = await usdcStatus()
    return depegged ? offers.filter((o) => o.method.name !== 'evm') : offers
  },
})
