import { createClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'

const pk = generatePrivateKey()
const account = privateKeyToAccount(pk)
const faucet = createClient({ chain: tempoModerato, transport: http() })
await Actions.faucet.fundSync(faucet, { account: account.address })
console.log(JSON.stringify({ pk, address: account.address }))
