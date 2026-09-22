# PeajeSettlement

On-chain settlement for Peaje payments. An AI agent signs an EIP-3009 `transferWithAuthorization` for the price in an HTTP 402 challenge; the Peaje gateway submits it through `settle`, which pulls the stablecoin into the contract, credits the merchant the net amount and the platform its fee, all in one transaction. Merchants withdraw whenever they want, directly or through a gasless signed withdrawal.

Works with any EIP-3009 stablecoin the owner allowlists, so a new stablecoin is a transaction, not a redeploy.

## Deployments

Same address on both chains: same deployer, same nonce.

| Network | Address | Accepted tokens | Deploy |
|---|---|---|---|
| Arbitrum Sepolia (421614) | [`0x583Cd05d…62225`](https://sepolia.arbiscan.io/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDC `0x75faf114…6AA4d`, USDG `0xFFC95faa…41892` | [tx](https://sepolia.arbiscan.io/tx/0x2db7d650578ec89ec3d784defe2f5a77f549a3fe20e3a8227e81b8a8c6152097), verified on Sourcify (exact match) |
| Robinhood Chain Testnet (46630) | [`0x583Cd05d…62225`](https://explorer.testnet.chain.robinhood.com/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDG `0x7E955252…1802F` | [tx](https://explorer.testnet.chain.robinhood.com/tx/0x5ed87048d54b2c7501b79b23c7ef1869facdda808b3762125fe0a4b6e12dbb13), verified on Blockscout |

Robinhood Chain's own testnet "USDC" is a mock without EIP-3009, so that rail settles in Paxos USDG, whose EIP-712 domain (`Global Dollar`, version `1`) was read from the token contract.

## Flow

```
agent ── signs EIP-3009 authorization (to = PeajeSettlement) ──> gateway
gateway (relayer) ── settle(token, merchant, auth) ──> PeajeSettlement
    ├─ claimable[token][merchant]     += amount - fee
    ├─ claimable[token][feeRecipient] += fee
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

39 tests: unit tests for every revert path and permission, a 1,000-run fuzz test on the fee math, and a stateful invariant suite that interleaves settlements, withdrawals and direct token donations, asserting after every call that the balance covers what is owed and that what is owed equals the sum of claimable balances. Coverage of `PeajeSettlement.sol`: 100% of branches and functions.

The test token (`test/mocks/MockEIP3009.sol`) implements EIP-3009 with real EIP-712 signature verification, so tests sign authorizations with actual keys.

## Deploy

```bash
DEPLOYER_PRIVATE_KEY=0x... \
FEE_RECIPIENT=0x... \
RELAYER=0x... \
FEE_BPS=200 \
ACCEPTED_TOKENS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
forge script script/DeployPeajeSettlement.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

`ACCEPTED_TOKENS` is a comma-separated list. `0x75fa…AA4d` is Circle's USDC on Arbitrum Sepolia (EIP-712 domain `"USD Coin"`, version `"2"`).
