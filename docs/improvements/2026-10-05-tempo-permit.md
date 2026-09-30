# Tempo on PeajeSettlement: settlement by EIP-2612 permit

**Date:** 2026-10-05 (work done 2026-09-29)
**Contract:** PeajeSettlement v2.1 on Tempo testnet (Moderato, 42431) [`0x3e0f648349432A5195e498D8D3b7Fa7d759752cC`](https://explore.testnet.tempo.xyz/address/0x3e0f648349432A5195e498D8D3b7Fa7d759752cC), block 37495736, deploy tx `0x9248a0d4…3fd2`, verified (`exact_match`) on Tempo's Sourcify verifier. Accepted token: pathUSD, max network fee $0.01.
**Status:** contract live and exercised with real payments. **Not wired into the 402** (see "Why the gateway rail stops here").

## Research

### pathUSD supports EIP-2612, not EIP-3009

Read on-chain from `0x20c0…0000` through `https://rpc.moderato.tempo.xyz`:

| Call | Result |
|---|---|
| `name()` | `PathUSD` |
| `decimals()` | 6 |
| `nonces(addr)` | `0` (exists) |
| `DOMAIN_SEPARATOR()` | `0xc601a8a9…d6b4` = `keccak256(EIP712Domain("PathUSD", "1", 42431, token))`, recomputed locally and equal |
| `version()`, `eip712Domain()` | revert with `UnknownFunctionSelector` |
| `transferWithAuthorization` | not implemented (TIP-20 has no EIP-3009) |

Permit is TIP-1004 (shipped with the T2 upgrade). Deviations from EIP-2612 that matter: `v` must be 27/28 (0/1 revert), a permit **overwrites** the allowance, `type(uint256).max` is a literal value (no infinite allowance), errors `PermitExpired()` / `InvalidSignature()`. Nonces are sequential per owner, shared across all spenders.

### Tempo specifics that change the numbers

- No native token. Gas is paid in a USD TIP-20; a call to a non-TIP-20 contract falls back to pathUSD as fee token. `eth_getBalance` returns a huge constant, so tooling balance checks pass.
- Base fee in attodollars per gas: floor 6×10⁸, cap 1.2×10¹⁰. Network cost is already in USD; no price feed needed.
- **New storage slot: 250,000 gas** (vs 20,000 on Ethereum); contract creation 1,000 gas/byte. This dominates the cost of `settleWithPermit` (see results).
- The installed Foundry (1.5.1) has no Tempo mode: local simulation underestimates CREATE (3.1M vs 12.1M real). Deploying needs `--skip-simulation --slow` so every transaction is estimated by the Tempo RPC.

### Can a buyer produce a permit through the 402 flow?

| Path in mppx 0.8.19 | Can sign/carry an EIP-2612 permit? |
|---|---|
| `evm.charge` (native MPP) | No. `credentialTypes` is the enum `['authorization']`; the client only signs `TransferWithAuthorization`; the server only verifies that. |
| x402 `exact` (`x402/client/Exact.js`) | No. `assetTransferMethods = ['eip3009', 'permit2']`; the client throws on anything but `eip3009`. `permit2` exists only as a payload schema (Uniswap Permit2, not EIP-2612) and there is no Permit2 on Tempo in Peaje's stack. |
| `tempo.charge` | No. The client always signs a Tempo transaction of TIP-20 `transferWithMemo` calls (pull or push). It does support `splits` (up to 10 extra transfers in the same transaction). |

A permit path is still possible **without patching mppx**: mppx exports `Method.from` / `Method.toServer` / `Method.toClient`, so Peaje can define its own payment method (for example `peaje-permit/charge`) with its own schema. A stock client never selects a method it does not have registered, so adding the offer cannot break existing clients. The client side (read `nonces(owner)` on Tempo, sign `Permit` for the contract) would live in Peaje's buyer runner (`apps/gateway/src/agents/runner.ts`). Only Peaje's own agents would use it; every external MPP client keeps paying through stock `tempo.charge`.

## Contract: `settleWithPermit`

```solidity
struct PermitPayment { address owner; uint256 value; uint256 nonce; uint256 deadline; uint8 v; bytes32 r; bytes32 s; }
function settleWithPermit(address token, address merchant, PermitPayment calldata permit, uint256 networkFee)
    external onlyRelayer whenNotPaused nonReentrant returns (uint256 net);
function permitPaymentId(address token, address owner, uint256 nonce) public pure returns (bytes32);
mapping(bytes32 paymentId => bool) public permitSettled;
```

- Same accounting as `settle`, through a shared `_credit`: token allowlist, `maxNetworkFee`, `value > networkFee`, 2% on the price, `PaymentSettled` with `nonce = permitPaymentId`.
- Replay: `paymentId = keccak256(token, owner, permitNonce)`; each id settles once, so a spent permit can never be settled again, towards the same or another merchant, even if the payer later grants a standing allowance.
- Merchant binding: like `settle`, the signature does not cover the merchant, so the function is relayer-only and the gateway chooses the merchant from the charge context. Binding it cryptographically would need a second signature from the buyer (an EIP-712 `Payment` over merchant and payment id); not done.
- Front-run permit: `permit` is public calldata, anyone can apply it first. On failure the contract accepts the payment only if the signature recovers to `owner` for **this contract** as spender, the nonce is already spent, and the allowance still covers the value. A forged struct over a nonce spent on some other spender, or a nonce not yet spent, reverts with `PermitNotUsable`.
- `deadline` is checked by the contract itself (`SignatureExpired`), so a front-run permit does not extend it.
- Pull is `safeTransferFrom` with the same balance-delta check as `_pull` (`UnexpectedAmountReceived`).

Tests: 25 new unit tests plus a 1,000-run fuzz on the split (`test/PeajeSettlement.permit.t.sol`, mock `test/mocks/MockEIP2612.sol` with pathUSD's domain), and the invariant suite now interleaves permit settlements, front-run permits and replay attempts on a second token. **70 tests pass** (45 existing unchanged). Coverage of `PeajeSettlement.sol`: 100% branches and functions, 96.9% lines. Slither: 0 findings after triaging two detectors inline (`arbitrary-send-erc20-permit` on the pull, `unused-return` on the ignored third value of `ECDSA.tryRecover`).

## Measured on Tempo testnet

Direct relayer calls to the deployed contract (payer and merchant are scratch keys funded by the faucet; the treasury is the relayer and paid gas in pathUSD at 6×10⁸ attodollars/gas). Payment: $0.011 = $0.010 price + $0.001 network fee.

| Tx | Case | Gas | Cost at floor | Cost at cap |
|---|---|---|---|---|
| `0xc46a490d…f72d` | first payment (new payer nonce, new merchant, new fee recipient and token slots) | 1,585,964 | $0.000952 (measured: treasury −952 µUSD) | $0.0190 |
| `0x61a4e439…4e0e` | same payer and merchant again | 349,476 | $0.000210 | $0.0042 |
| replay of the second call | `eth_call` | reverts `PermitAlreadySettled` | | |

After both: merchant claimable 0.0196, fee recipient 0.0024, `totalOwed` 0.022 = contract balance.

Steady state costs ~350k gas because two slots go from zero to non-zero on every payment at 250k each (the `permitSettled` flag and the payer's allowance, which the permit sets and `transferFrom` clears). The current custodial rail is one TIP-20 transfer by the payer, ~50k gas ($0.00003 floor, $0.0006 cap). The $0.01 cap covers the steady state even at the base-fee cap; a first payment at the cap would exceed it and Peaje would absorb the difference.

Deploy: 12,052,773 gas for the CREATE (+280,115 `setRelayer`, +532,738 `setAcceptedToken`), about $0.0077 at the floor.

## Why the gateway rail stops here

The client path works (custom mppx method above). What does not fit is Peaje's balance model: a network id has exactly one balance source. For `tempo` that source is the treasury ledger; for settlement networks it is `claimable` in the contract, and that switch drives balances (`saldos.ts`, dashboard `lib/saldos.ts`), withdrawals (`payoutFromTenant`), refunds (`refundOriginFailure`), payer resolution (`chain.ts`), agent funding and sweeps (`agents/wallet.ts`, which relays EIP-3009 on settlement networks and would break on pathUSD) and dashboard wallet screens (`walletops.ts`, `enviar.tsx`). With a permit offer next to the custodial fallback, Tempo would have money in two places under one id: withdrawals from the treasury would pay out funds that sit in the contract. Wiring that correctly touches `packages/db` and `apps/dashboard`, which belong to other work streams right now. Per the rule of not shipping a half-wired rail, the 402 is unchanged and nothing was added to `SETTLEMENT_NETWORKS`/`SETTLEMENT_CONTRACTS`.

## Options, with cost

| Option | What | Clients that can pay | Cost | Trade-offs |
|---|---|---|---|---|
| A. Separate rail `tempo-contract` + custom `peaje-permit` method | New `NetworkId` on the contract; custodial `tempo` stays as fallback | Peaje's own agents only (runner registers the method) | ~1 day: shared network def, custom method server+client (~150 lines, no mppx patch), settlement rail, costoRed (USD gas directly), treasury/withdraw switch, agent sweep via permit or plain transfer, dashboard lists, subgraph data source | Two Tempo balances per merchant. Permit nonces are sequential: concurrent purchases by one agent collide and must be serialized. ~350k gas per payment. |
| B. Tempo fully on the contract, permit only | Replace the custodial offer | Only Peaje's agents; external stock mppx clients lose Tempo | ~0.5 day | Breaks every external Tempo client. Not acceptable today. |
| C. Stock `tempo.charge` paying the contract + relayer `creditTransfer` (v2.2) | Payer transfers pathUSD to the contract with the challenge memo; gateway credits the surplus to the merchant on-chain | Every MPP client, zero client changes | ~1 day incl. new contract function and a migration like Arc's | Two transactions per payment; the relayer attributes a transfer it verified off-chain (payer in the event is asserted, not proven). All of Tempo moves to the contract, one balance source. |
| D. Stock `tempo.charge` with `splits` | One Tempo transaction: price×0.98 to the merchant's wallet, 2% (+ network) to Peaje | Every MPP client, zero client changes, no contract | ~0.5 day, gateway only | Split on-chain and non-custodial, but the merchant holds the funds: refunds and "balance" semantics change, and the merchant needs a Tempo payout wallet. |

Recommendation: D if the goal is "2% split on-chain, non-custodial" for everybody; A if the goal is specifically to have Tempo payments inside PeajeSettlement. The contract here supports A and does not block C.

## Not done

- Subgraph: only Arbitrum Sepolia is indexed and the event signature did not change; a Tempo data source would need an indexer that supports chain 42431.
- Scratch keys used for the measurement live only in the session scratchpad; the contract holds 0.0196 test pathUSD for a scratch merchant and 0.0024 for the treasury (withdrawable).
