# Settlement v2: the agent pays the network cost

**Date:** 2026-09-27
**Contract:** PeajeSettlement v2 on Arbitrum Sepolia `0x36F9aEBeBce767A1FEE25Fa90F9bF13137E61231` (block 313383460). Subgraph v0.2.0.

## What changed

`settle(token, merchant, auth, networkFee)`. The 402 offer for a settlement rail is `price + that rail's network cost`, computed every 30 s from the rail's gas price (160,000 gas, the measured `settle` cost with margin) and Chainlink's ETH/USD feed, with a 20% buffer and a per-token cap the owner sets on-chain ($0.05). The merchant is credited `price × 0.98`; the platform is credited the 2% plus the network cost. The relayer cannot charge above the cap: `settle` reverts.

## Before and after, measured

Per payment at the typical price of $0.02, Arbitrum (v1 gas measured on tx `0x8789a7a3…9130`: 146,990 gas at 0.02 gwei, ETH $2,696; v2 on tx `0xd14e3937…1ed1`):

| | v1 (2% only) | v2 (2% + network cost) |
|---|---|---|
| Agent pays | $0.0200 | $0.0364 (Sepolia gas at 0.032 gwei that minute) |
| Merchant receives | $0.0196 | $0.0196 |
| Platform receives | $0.0004 | $0.0168 |
| Relayer gas | $0.0080 | $0.0080 |
| Peaje margin per payment | **-$0.0076** | **+$0.0004** plus the unspent buffer |

Break-even price for the 2% to cover gas on Arbitrum One: $0.40 in v1; none in v2, the margin is 2% at any price.

## Verified

- 45 Foundry tests (6 new), fuzz on the split with a random network fee, invariants unchanged, Slither 0 findings, 100% of functions and lines.
- Real payment through the gateway: on-chain `PaymentSettled(amount 0.036408, fee 0.0004, networkFee 0.016408)`; ledger row `amount 0.0196, platform_fee 0.0004, network_fee 0.016408`; subgraph `net 19600, totalNetworkFees 16408`.

## Not solved here

- Robinhood Chain still runs v1 and its rail is paused until the v2 deploy.
- Tempo (pathUSD has no EIP-3009) and Arc are not on the contract yet.
- On Arbitrum Sepolia the network cost is 82% of a $0.02 request. That is the argument for batching (Circle Nanopayments on Arbitrum, Arc and Base), which removes per-request gas.
