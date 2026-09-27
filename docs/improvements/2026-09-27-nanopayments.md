# Circle Nanopayments: gasless payments settled in batches

**Date:** 2026-09-27
**Rails:** `gateway-arbitrum` (Arbitrum Sepolia) and `gateway-arc` (Arc testnet), USDC. Facilitator `gateway-api-testnet.circle.com`.

## What changed

Every 402 now carries two extra x402 offers, one per Gateway chain, with the `GatewayWalletBatched` domain Circle's client looks for. A buyer that deposited USDC once into Circle's Gateway Wallet pays each request with a signature only: the gateway sends the payload to Circle's `/verify` and `/settle`, Circle deducts the buyer's balance and credits Peaje's, and the batch reaches the chain later. No gas, no transaction per request, no network cost charged to the agent on these rails.

The on-chain rails (PeajeSettlement) stay first in the offer list, so MPP-native clients keep using them; Circle's client picks the Gateway offer by its domain.

## Measured

Spike, Circle's own seller middleware, Arbitrum Sepolia, 20 payments of $0.001:

| | |
|---|---|
| Deposit (one-time, 2 txs: approve + deposit) | mined in 3.5 s, credited by Circle after 10 min |
| Payment latency (verify + settle) | 250 ms average |
| Buyer transactions during 20 payments | 0 (nonce unchanged) |
| Success | 20 of 20 once the deposit was credited |

Through Peaje's gateway (local), 5 payments of $0.02 to `clima-andino`: 1.6 to 2.1 s each end to end, including the proxy to the origin and the ledger write. Ledger rows: `network gateway-arbitrum, amount 0.0196, platform_fee 0.0004, network_fee 0, agent_wallet 0x96d6…2653`. Buyer's Gateway balance 0.98 to 0.88.

Compared with the on-chain rails the same day: Arbitrum 3.2 s and $0.0166 of network cost per payment; Arc 6.7 s and $0.0048. On the Gateway rails the 2% is the whole cost.

## Gotchas found

- Circle rejects a `paymentPayload` without `resource.description` and `resource.mimeType` (HTTP 400); mppx only publishes `resource.url` and the client echoes it, so the gateway fills both before calling Circle.
- `/verify` does not check the buyer's balance; only `/settle` does (`insufficient_balance`).
- Authorizations must be valid for at least 604,800 s; the offer advertises `maxTimeoutSeconds: 604900`.
- The deposit is credited only after Circle sees finality on the source chain: 10 min on Arbitrum Sepolia. Other chains not measured.
- mppx verifies EIP-3009 signatures against the token address; the Gateway domain uses Circle's contract, so the mppx patch now accepts an `authorization.verifyingContract`.

## Not solved here

- Withdrawing Peaje's Gateway balance to a merchant wallet is wired through Circle's SDK (`withdraw`, one gas transaction by the treasury) but not yet exercised with a real withdrawal.
- The Peaje buyer agent still pays on-chain; its wallet is custodied by Privy and Circle's client wants a raw private key. Depositing from a Privy wallet needs the two deposit transactions signed through viem instead of the SDK.
- Custody: on these rails Circle credits Peaje's Gateway balance and the ledger splits per merchant, like Tempo. Non-custodial needs Circle-side splits or a second authorization per payment.
