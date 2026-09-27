# PeajeSettlement

On-chain settlement for Peaje payments. An AI agent signs an EIP-3009 `transferWithAuthorization` for the amount in an HTTP 402 challenge (the merchant's price plus that rail's network cost); the Peaje gateway submits it through `settle`, which pulls the stablecoin into the contract, credits the merchant the price net of the platform fee, and credits the platform the fee plus the network cost, all in one transaction. Merchants withdraw whenever they want, directly or through a gasless signed withdrawal.

Why the network cost is explicit: settling one payment on Arbitrum costs the relayer about $0.008 in gas, and a 2% fee on a $0.02 request is $0.0004. Without it, every small payment lost money. The agent chooses the rail, so the agent pays that rail's cost, shown in the 402; the merchant always nets `price × (1 − fee)`.

Works with any EIP-3009 stablecoin the owner allowlists, so a new stablecoin is a transaction, not a redeploy.

## Deployments

| Network | Version | Address | Accepted tokens (max network fee) | Deploy |
|---|---|---|---|---|
| Arbitrum Sepolia (421614) | v2 | [`0x36F9aEBe…61231`](https://sepolia.arbiscan.io/address/0x36F9aEBeBce767A1FEE25Fa90F9bF13137E61231) | USDC `0x75faf114…6AA4d` ($0.05), USDG `0xFFC95faa…41892` ($0.05) | [tx](https://sepolia.arbiscan.io/tx/0x4f262eda781cffb893ef39d8abf64d877a9670507f2024e249b70f273768a9be), block 313383460, verified on Sourcify |
| Arbitrum Sepolia (421614) | v1, retired | [`0x583Cd05d…62225`](https://sepolia.arbiscan.io/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDC, USDG | [tx](https://sepolia.arbiscan.io/tx/0x2db7d650578ec89ec3d784defe2f5a77f549a3fe20e3a8227e81b8a8c6152097) |
| Robinhood Chain Testnet (46630) | v1, rail paused until the v2 deploy | [`0x583Cd05d…62225`](https://explorer.testnet.chain.robinhood.com/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDG `0x7E955252…1802F` | [tx](https://explorer.testnet.chain.robinhood.com/tx/0x5ed87048d54b2c7501b79b23c7ef1869facdda808b3762125fe0a4b6e12dbb13), verified on Blockscout |

v1 and v2 differ only in `settle`: v2 takes a `networkFee` and `setAcceptedToken` takes the per-token cap. The gateway's v2 ABI cannot call a v1 contract, so a rail stays off until its contract is redeployed.

Robinhood Chain's own testnet "USDC" is a mock without EIP-3009, so that rail settles in Paxos USDG, whose EIP-712 domain (`Global Dollar`, version `1`) was read from the token contract.

## Flow

```
agent ── signs EIP-3009 authorization (to = PeajeSettlement) ──> gateway
gateway (relayer) ── settle(token, merchant, auth, networkFee) ──> PeajeSettlement
    ├─ price = amount - networkFee
    ├─ claimable[token][merchant]     += price - fee
    ├─ claimable[token][feeRecipient] += fee + networkFee
    └─ token.transferWithAuthorization(agent → contract)
merchant ── withdraw(...)  or  signs Withdraw (EIP-712) ── relayer submits withdrawWithSignature(...)
```

## Security model

| Property | How it is enforced |
|---|---|
| Only the gateway can attribute payments | `settle` is relayer-only. The EIP-3009 authorization binds payer, amount and nonce, but not the merchant, so an open `settle` would let anyone route a signed payment to a merchant of their choice. |
| Funds owed are always backed | `totalOwed[token]` equals the sum of all `claimable` balances and never exceeds the contract balance (checked by the invariant suite). |
| Tokens that deliver less than signed are rejected | `settle` measures the balance delta and reverts with `UnexpectedAmountReceived` if it differs from the authorized value. |
| Merchants are never locked in | `withdraw` and `withdrawWithSignature` work while the contract is paused and for tokens that were delisted. Pausing only stops new settlements. |
| Merchants never need gas | `withdrawWithSignature` accepts an EIP-712 signature (EOA or ERC-1271) that commits to token, amount, recipient, a per-account nonce and a deadline. The submitter cannot change any of them or replay the signature. |
| The owner cannot touch merchant funds | `recoverSurplus` only moves `balance - totalOwed`, the tokens nobody is owed (for example, an authorization someone submitted to the token directly, bypassing `settle`). |
| Fee is capped | `feeBps` can never exceed `MAX_FEE_BPS` (10%). Fee changes apply to future settlements only. |
| The relayer cannot inflate the network cost | `networkFee` is chosen per payment by the relayer but must not exceed `maxNetworkFee[token]`, set by the owner. Above the cap, `settle` reverts. |
| Admin is recoverable | `Ownable2Step` for ownership transfers; `renounceOwnership` is disabled, since without an owner relayers and tokens could never be rotated. |

Checks-effects-interactions throughout: all state is written before the external token call, and the received-amount check after the call reverts the whole settlement if it fails. `nonReentrant` guards every function that moves tokens.

## Static analysis

Slither reports 0 findings. Four detectors are triaged inline with `slither-disable-next-line`, each a deliberate pattern:

- `reentrancy-balance` in `settle`: reading the balance before and after the token call is the control that detects short deliveries. State is already written and re-entry is blocked.
- `incorrect-equality` in `recoverSurplus`: a donation can only create surplus, which is the case the function exists for.
- `timestamp` in `withdrawWithSignature`: deadline check, same pattern as EIP-2612 `permit`.
- `naming-convention` on `DOMAIN_SEPARATOR()`: the EIP-2612 name wallets and libraries look for.

## Tests

```bash
forge test
forge coverage --ir-minimum
```

45 tests: unit tests for every revert path and permission (including the network fee cap and the case where the value only covers the network fee), a 1,000-run fuzz test on the split with a random network fee, and a stateful invariant suite that interleaves settlements, withdrawals and direct token donations, asserting after every call that the balance covers what is owed and that what is owed equals the sum of claimable balances. Coverage of `PeajeSettlement.sol`: 100% of branches and functions.

The test token (`test/mocks/MockEIP3009.sol`) implements EIP-3009 with real EIP-712 signature verification, so tests sign authorizations with actual keys.

## Deploy

```bash
DEPLOYER_PRIVATE_KEY=0x... \
FEE_RECIPIENT=0x... \
RELAYER=0x... \
FEE_BPS=200 \
ACCEPTED_TOKENS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d,0xFFC95faa3d63Cde504a05B567C600B78C0b41892 \
MAX_NETWORK_FEES=50000,50000 \
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
forge script script/DeployPeajeSettlement.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

`ACCEPTED_TOKENS` and `MAX_NETWORK_FEES` are comma-separated lists, aligned; the caps are in the token's units (50000 = $0.05 for a 6-decimal stablecoin). `0x75fa…AA4d` is Circle's USDC on Arbitrum Sepolia (EIP-712 domain `"USD Coin"`, version `"2"`).
