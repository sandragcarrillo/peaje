# Peaje

**The cash register of the agent economy: your site charges AI agents per request, and the same balance funds an agent that buys for you.**

<p align="center">
  <img src="./project-logo.png" alt="Peaje" width="140" />
</p>

Built by:

- Sandra Carrillo ([@sandragcarrillo](https://github.com/sandragcarrillo))
- Carla Martínez ([@carlaupgrade](https://github.com/carlaupgrade))
- Angela Ocando ([@ocandocrypto](https://github.com/ocandocrypto))

**Demo:** [peaje-dashboard.vercel.app](https://peaje-dashboard.vercel.app) · Gateway: `peaje-gateway.up.railway.app`

Try the live payment cycle right now (a real priced route, weather data proxied from Open-Meteo):

```bash
curl -i "https://peaje-gateway.up.railway.app/clima-andino/v1/forecast?latitude=4.71&longitude=-74.07&daily=temperature_2m_max&forecast_days=5"
```

It answers `402 Payment Required` with one offer per rail in the challenge (Tempo pathUSD, Arc USDC, Arbitrum Sepolia USDC and USDG, Robinhood Chain USDG); an MPP/x402-capable agent picks one, pays and gets the data.

## What it is

Peaje has two sides, both running on the same balance:

**Sell to agents.** Any business with a URL registers with an email, sets prices on its links or API routes (or imports its sitemap), and gets a gateway that charges AI agents per request via **[MPP](https://mpp.dev/)** ([HTTP 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402), the machine-to-machine payment standard by [Tempo](https://tempo.xyz/) + [Stripe](https://docs.stripe.com/payments/machine/mpp)). Agents pay on their own in stablecoin; revenue lands in the dashboard. No payment code, no crypto in the onboarding: the wallet is created automatically ([Privy](https://privy.io)).

**Buy from agents.** Every account gets one buyer agent with its own wallet. You ask in plain language ("this week's weather forecast for Bogotá, in three lines"), the agent searches the full market of agent services, shows you what it would buy, at what price and why, and only spends when you approve. It pays, reads what it bought, and returns a human-readable answer with the on-chain receipt behind it.

The wallet **is** the budget: an agent physically cannot overspend, because its balance is its ceiling.

## What was built during ETHGlobal ETHOnline 2026 (Continuity Track)

Peaje started at Platanus Hack 26 (Bogotá) as the selling side. During ETHOnline it grew into the full loop:

- **Discovery anchored at the business domain**: `agents.md`, `llms.txt`, `ard.json`, enriched `openapi.json` (RFC 9457 errors, versioning, idempotency), `api-catalog` (RFC 9727), `.well-known/mcp`, JSON-LD and RFC 8288 Link headers, all generated from the DB and self-named at the business's own domain. Agent-readiness score of the demo site went **from 40 to 73** ([Ora](https://ora.ai)), with the before/after shown in the dashboard.
- **Agent commerce protocols**: UCP profile (`/.well-known/ucp`), ACP checkout sessions, and AP2 cart mandates signed with ES256 (key published in the UCP profile).
- **Per-tenant developer portal** generated from the DB, plus a paid-tools MCP server per business.
- **The buyer agent**, redesigned around ask → plan → approve:
  - Discovers across three sources: the Peaje directory (every Peaje rail), the **x402 Bazaar** (Coinbase's index, ~15,000 real third-party services, fully indexed and cached), and the **ERC-8004 identity registry via The Graph** (on-chain reputation feeds every decision).
  - Pays via **MPP on Tempo, Arc, Arbitrum Sepolia and Robinhood Chain** (testnet) and via **x402 with real USDC on Base mainnet**, from the same Privy server wallet.
  - An LLM veto runs before any payment: if the best match does not answer the request, nothing is spent. Buying nothing beats buying garbage.
  - Your request is translated into the service's actual query (city coordinates, forecast variables, date ranges) and the purchased content is synthesized into a readable answer in your language.
  - Funding from any of your businesses' balances or straight from your personal wallet, on the network you choose.
- **Platform fee**: Peaje takes a configurable take rate per transaction (default 2%, `PEAJE_FEE_PCT`). Agents pay the listed price; the business is credited the net; the difference stays in the treasury.

## Architecture

```
[Agent] ──HTTP/MCP──> [Gateway Hono + mppx · Railway] ──proxy──> [Business site/API]
                         │  402 → on-chain payment (Tempo · Arc · Arbitrum · Robinhood) → receipt
                         ├─ PeajeSettlement (Arbitrum, Robinhood): merchant/fee split on-chain
                         └─ Ledger (Supabase) credits each tenant (net of fee)

[Buyer agent] ─ discovery: Peaje directory + x402 Bazaar + ERC-8004 (The Graph)
              ─ pays: MPP (Tempo · Arc · Arbitrum · Robinhood, testnet) · x402 (Base mainnet, USDC)
              ─ wallet: Privy server wallet per agent (balance = hard budget)

[Dashboard Next.js · Vercel] ─ email onboarding (Privy), prices, score,
                               agent ask/plan/approve, withdrawals
```

| Piece | What it does |
|---|---|
| `apps/gateway` | Multi-tenant: `/{slug}/*` charges via MPP and proxies to the origin. Paid-tools MCP at `/{slug}/mcp`. Discovery docs generated from the DB and anchored at the business domain. UCP/ACP/AP2. Buyer-agent engine (discovery, veto, purchase, synthesis, scheduler). Treasury and withdrawals with on-chain reconciliation. |
| `apps/dashboard` | Email registration (Privy, automatic wallet), agent-readiness score with before/after, priced links + sitemap import, agent-ready kit with verifier, the single-agent buyer view, market explorer, withdrawals. |
| `packages/db` | Schema and stores (Supabase / in-memory). |

## Run locally

```bash
pnpm install
cp .env.example .env   # fill in credentials
pnpm --filter @peaje/gateway dev      # :8787
pnpm --filter @peaje/dashboard dev    # :3100
```

Same cycle locally: `curl -i http://localhost:8787/<slug>/<priced-path>` returns the 402 challenge with every rail.

## Sponsor tech

- **Tempo**: MPP/402 charging, pathUSD settlements on both sides of the loop (charge, fund, buy).
- **Circle / Arc**: USDC rail with EIP-3009 authorizations for charging, funding and buying.
- **Arbitrum**: [PeajeSettlement](./contracts) on Arbitrum Sepolia settles USDC and USDG, crediting the merchant and the platform fee on-chain in the same transaction; merchants withdraw without gas.
- **Robinhood Chain**: the same contract settles USDG on Robinhood Chain testnet.
- **The Graph**: ERC-8004 subgraphs feed identity and on-chain reputation into every purchase decision, and a PeajeSettlement subgraph indexes every settlement and withdrawal.
- **Privy**: server wallets for businesses and agents; email-only onboarding.
- **Base / x402**: the real third-party market the buyer agent purchases from with real USDC.

## Status

- Real payments on Tempo testnet (pathUSD), Arc testnet (USDC) and Arbitrum Sepolia (USDC through PeajeSettlement), verifiable on their explorers. PeajeSettlement is also deployed and verified on Robinhood Chain testnet.
- Buyer agent verified end to end: real weather data purchased for $0.02, delivered as a three-line human answer with receipt.
- Withdrawals run against the chain and reconcile automatically.
