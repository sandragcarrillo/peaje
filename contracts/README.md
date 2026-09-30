# PeajeSettlement

On-chain settlement for Peaje payments. An AI agent signs an EIP-3009 `transferWithAuthorization` for the amount in an HTTP 402 challenge (the merchant's price plus that rail's network cost); the Peaje gateway submits it through `settle`, which pulls the stablecoin into the contract, credits the merchant the price net of the platform fee, and credits the platform the fee plus the network cost, all in one transaction. Merchants withdraw whenever they want, directly or through a gasless signed withdrawal.

Why the network cost is explicit: settling one payment on Arbitrum costs the relayer about $0.008 in gas, and a 2% fee on a $0.02 request is $0.0004. Without it, every small payment lost money. The agent chooses the rail, so the agent pays that rail's cost, shown in the 402; the merchant always nets `price × (1 − fee)`.

Works with any EIP-3009 stablecoin the owner allowlists, so a new stablecoin is a transaction, not a redeploy.

## Deployments

| Network | Version | Address | Accepted tokens (max network fee) | Deploy |
|---|---|---|---|---|
| Arbitrum Sepolia (421614) | v2 | [`0x36F9aEBe…61231`](https://sepolia.arbiscan.io/address/0x36F9aEBeBce767A1FEE25Fa90F9bF13137E61231) | USDC `0x75faf114…6AA4d` ($0.05), USDG `0xFFC95faa…41892` ($0.05) | [tx](https://sepolia.arbiscan.io/tx/0x4f262eda781cffb893ef39d8abf64d877a9670507f2024e249b70f273768a9be), block 313383460, verified on Sourcify |
| Arbitrum Sepolia (421614) | v1, retired | [`0x583Cd05d…62225`](https://sepolia.arbiscan.io/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDC, USDG | [tx](https://sepolia.arbiscan.io/tx/0x2db7d650578ec89ec3d784defe2f5a77f549a3fe20e3a8227e81b8a8c6152097) |
| Robinhood Chain Testnet (46630) | v2 | [`0xcfe4837a…46eb7`](https://explorer.testnet.chain.robinhood.com/address/0xcfe4837a55fcf45c697f61b4577ddb894aa46eb7) | USDG `0x7E955252…1802F` ($0.05) | [tx](https://explorer.testnet.chain.robinhood.com/tx/0x626dee4f3575f68014dc66a2b1e756189e1abc435d64694075fd0363b78ef208), block 125368290, verified on Blockscout |
| Arc Testnet (5042002) | v2 | [`0xc0a98a80…3d0ed`](https://testnet.arcscan.app/address/0xc0a98a8091a987bbb86f149f61253094e663d0ed) | USDC `0x36000000…00000` ($0.01) | [tx](https://testnet.arcscan.app/tx/0x07c9c899563be113c7106ba2cf156fbc2a6227556fe9a474e338de4eff0f4f3c), block 64332716, verified on Sourcify |
| Tempo Testnet (42431) | v2.1 | [`0x3e0f6483…752cC`](https://explore.testnet.tempo.xyz/address/0x3e0f648349432A5195e498D8D3b7Fa7d759752cC) | pathUSD `0x20c00000…00000` ($0.01), via `settleWithPermit` | [tx](https://explore.testnet.tempo.xyz/tx/0x9248a0d437e29683b9e14323aedc567f90ed980bb46a8cea8cf9ae64e3c03fd2), block 37495736, verified on Tempo's Sourcify (`contracts.tempo.xyz`) |
| Robinhood Chain Testnet (46630) | v1, retired | [`0x583Cd05d…62225`](https://explorer.testnet.chain.robinhood.com/address/0x583Cd05d8C13E6a160B09B8BF5704e9E32962225) | USDG | [tx](https://explorer.testnet.chain.robinhood.com/tx/0x5ed87048d54b2c7501b79b23c7ef1869facdda808b3762125fe0a4b6e12dbb13) |

v1 and v2 differ only in `settle`: v2 takes a `networkFee` and `setAcceptedToken` takes the per-token cap. On Arc, gas is paid in USDC itself, so the network cost needs no ETH price and the cap is lower. v2.1 adds `settleWithPermit` for tokens with EIP-2612 and no EIP-3009, which is Tempo's pathUSD (TIP-1004 permit, domain `"PathUSD"`, version `"1"`); everything else is unchanged. The Tempo contract is deployed and tested with real payments but the gateway still settles Tempo to the treasury: see `docs/improvements/2026-10-05-tempo-permit.md`.

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
| Tokens that deliver less than signed are rejected | `settle` and `settleWithPermit` measure the balance delta and revert with `UnexpectedAmountReceived` if it differs from the authorized value. |
| A permit settles once | `settleWithPermit` records `permitPaymentId(token, owner, permitNonce)`; a spent permit reverts with `PermitAlreadySettled`, towards any merchant, even if the payer later grants a standing allowance. It is relayer-only for the same reason as `settle`: a permit does not bind the merchant. |
| A front-run permit still settles, a forged one does not | If someone applies the permit to the token first, `settleWithPermit` proceeds only when the signature recovers to the owner for this contract as spender, the nonce is spent and the allowance covers the value. Otherwise `PermitNotUsable`. |
| Merchants are never locked in | `withdraw` and `withdrawWithSignature` work while the contract is paused and for tokens that were delisted. Pausing only stops new settlements. |
| Merchants never need gas | `withdrawWithSignature` accepts an EIP-712 signature (EOA or ERC-1271) that commits to token, amount, recipient, a per-account nonce and a deadline. The submitter cannot change any of them or replay the signature. |
| The owner cannot touch merchant funds | `recoverSurplus` only moves `balance - totalOwed`, the tokens nobody is owed (for example, an authorization someone submitted to the token directly, bypassing `settle`). |
| Fee is capped | `feeBps` can never exceed `MAX_FEE_BPS` (10%). Fee changes apply to future settlements only. |
| The relayer cannot inflate the network cost | `networkFee` is chosen per payment by the relayer but must not exceed `maxNetworkFee[token]`, set by the owner. Above the cap, `settle` reverts. |
| Admin is recoverable | `Ownable2Step` for ownership transfers; `renounceOwnership` is disabled, since without an owner relayers and tokens could never be rotated. |

Checks-effects-interactions throughout: all state is written before the external token call, and the received-amount check after the call reverts the whole settlement if it fails. `nonReentrant` guards every function that moves tokens.

## Static analysis

Slither reports 0 findings. Six detectors are triaged inline with `slither-disable-next-line`, each a deliberate pattern:

- `reentrancy-balance` in `settle` and `settleWithPermit`: reading the balance before and after the token call is the control that detects short deliveries. State is already written and re-entry is blocked.
- `arbitrary-send-erc20-permit` in `settleWithPermit`: `from` is the owner who signed a permit for this contract and this value (checked by the token, or by `_checkSpentPermit` when the permit was front-run); relayer-only, once per permit.
- `unused-return` in `_checkSpentPermit`: the third value of `ECDSA.tryRecover` is the error argument, not needed once the error code is checked.
- `incorrect-equality` in `recoverSurplus`: a donation can only create surplus, which is the case the function exists for.
- `timestamp` in `withdrawWithSignature` and `settleWithPermit`: deadline check, same pattern as EIP-2612 `permit`.
- `naming-convention` on `DOMAIN_SEPARATOR()`: the EIP-2612 name wallets and libraries look for.

## Tests

```bash
forge test
forge coverage --ir-minimum
```

70 tests: unit tests for every revert path and permission (including the network fee cap and the case where the value only covers the network fee), 25 for `settleWithPermit` (replay, replay towards another merchant, front-run and forged permits, expired deadline, fee cap), 1,000-run fuzz tests on the split with a random network fee for both entry points, and a stateful invariant suite that interleaves EIP-3009 and permit settlements, front-run permits, replay attempts, withdrawals and direct token donations in two tokens, asserting after every call that the balance covers what is owed and that what is owed equals the sum of claimable balances. Coverage of `PeajeSettlement.sol`: 100% of branches and functions.

The test tokens (`test/mocks/MockEIP3009.sol`, and `test/mocks/MockEIP2612.sol` with pathUSD's permit domain) verify real EIP-712 signatures, so tests sign with actual keys.

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

On Tempo the installed Foundry has no Tempo mode and its local simulation underestimates contract creation (1,000 gas per byte and 250,000 per new storage slot there), so skip it and let the Tempo RPC estimate each transaction. Gas is paid in pathUSD by the deployer:

```bash
ACCEPTED_TOKENS=0x20c0000000000000000000000000000000000000 MAX_NETWORK_FEES=10000 \
TEMPO_TESTNET_RPC_URL=https://rpc.moderato.tempo.xyz \
forge script script/DeployPeajeSettlement.s.sol --rpc-url tempo_testnet --broadcast --skip-simulation --slow
forge verify-contract <address> src/PeajeSettlement.sol:PeajeSettlement --chain 42431 \
  --verifier sourcify --verifier-url https://contracts.tempo.xyz/ --constructor-args <abi-encoded args>
```
