# Peaje

**Your site or API, ready for AI agents: they find you, read you and, if you want, pay you per request.**

<p align="center">
  <img src="./project-logo.png" alt="Peaje" width="140" />
</p>

Built by:

- Sandra Carrillo ([@sandragcarrillo](https://github.com/sandragcarrillo))
- Carla Martínez ([@carlaupgrade](https://github.com/carlaupgrade))
- Angela Ocando ([@ocandocrypto](https://github.com/ocandocrypto))

**Live:** [usepeaje.com](https://usepeaje.com) · Gateway: `api.usepeaje.com` · Packages: [`@peaje/cli`](https://www.npmjs.com/package/@peaje/cli), [`@peaje/next`](https://www.npmjs.com/package/@peaje/next), [`@peaje/proxy`](https://www.npmjs.com/package/@peaje/proxy)

Try the payment cycle right now (a real priced route, weather data proxied from Open-Meteo):

```bash
curl -i "https://api.usepeaje.com/clima-andino/v1/forecast?latitude=4.71&longitude=-74.07&daily=temperature_2m_max&forecast_days=5"
```

It answers `402 Payment Required` with one offer per rail (Arbitrum Sepolia USDC and USDG, Robinhood Chain USDG, Tempo pathUSD, Arc USDC, plus Circle Nanopayments); an MPP or x402 agent picks one, pays and gets the data. All rails are testnets today.

## What it is

Three steps, in the order a site owner meets them:

1. **Radar, free, no account.** Enter a domain at [usepeaje.com/radar](https://usepeaje.com/radar): in about 30 seconds you see your agent-readiness score today, the ceiling with Peaje, and the list of what agents find and what is missing. The score comes from [Ora](https://ora.ai), an independent measure.
2. **Install Peaje.** One command, `npx @peaje/cli@1 init <slug>`, or one text pasted into Claude Code, Cursor, Lovable or v0. The site becomes readable by agents (`llms.txt`, `openapi.json`, an MCP server, agent cards, JSON-LD) and every route can carry a price, including zero. Charging is optional: when a route has a price, the site answers `402` on its own domain and agents pay in stablecoin via **[MPP](https://mpp.dev/)** or x402. No API keys, no accounts for agents, and no crypto in the onboarding: the business wallet is created automatically ([Privy](https://privy.io)).
3. **AEO agent (Pro, US$29 a month, 14-day trial).** An agent that measures whether ChatGPT, Perplexity, Gemini and Claude cite the site for a set of questions, builds a plan around the owner's goal, writes the pages that answer those questions from facts on the site, hands each task to the owner's coding tool through an MCP server or the CLI, verifies the live site and measures again at 2 and 6 weeks. It also checks which AI bots can read the site and runs a mystery shopper against the payment step. Talks on the dashboard and on Telegram.

Peaje keeps 2% of each payment. On Tempo the split is native: 98% lands in the business wallet and 2% in Peaje's, in the agent's own transaction, and Peaje holds nothing. On Arbitrum, Robinhood and Arc the [PeajeSettlement](./contracts) contract credits the business and the fee on-chain in the same transaction, and the business withdraws without gas.

## How Peaje has been improving

Four hackathons, one product, each round building on the last.

### Platanus Hack 26, Bogotá (August 2026): the selling side

- A multi-tenant gateway (Hono + mppx) that charges AI agents per request over **MPP / HTTP 402** on Tempo and proxies the paid request to the business origin.
- Email-only onboarding with an automatic business wallet (Privy): no API keys, no crypto in the signup.
- Priced links and API routes from the dashboard, withdrawals end to end, and the first agent-readiness kit with the Ora score.

### ETHGlobal ETHOnline 2026, Continuity Track (September): the full loop

- **Discovery anchored at the business domain**: `agents.md`, `llms.txt`, `ard.json`, enriched `openapi.json` (RFC 9457 errors, versioning, idempotency), `api-catalog` (RFC 9727), `.well-known/mcp`, JSON-LD and RFC 8288 Link headers, all generated from the DB. The demo site went from 40 to 73 on Ora.
- **Agent commerce protocols**: UCP profile, ACP checkout sessions and AP2 cart mandates signed with ES256.
- **Multi-rail payments**: Arc USDC with EIP-3009, Arbitrum Sepolia and Robinhood Chain through [PeajeSettlement](./contracts) (merchant and fee split on-chain, gasless withdrawals), **Circle Nanopayments** at 250 ms per payment, a Chainlink depeg guard, and The Graph indexing settlements and ERC-8004 reputation.
- **The buyer agent**: ask, plan, approve. It discovers across the Peaje directory, the x402 Bazaar and the ERC-8004 registry, vetoes bad matches before spending, pays via MPP or x402 (real USDC on Base mainnet), and turns what it bought into a readable answer with the receipt behind it.
- A per-tenant developer portal, a paid-tools MCP server per business, and the platform fee (2% by default).

### Arbitrum Open House Buildathon and Colosseum (October): found first, then paid

- **Repositioned around being found.** Public radar on any domain, landing in three steps, charging presented as optional. The reasoning is in [docs/revision-producto-2026-10-01.md](./docs/revision-producto-2026-10-01.md).
- **Install on any framework.** `@peaje/proxy` brings the 402-on-your-domain proxy to Express, Hono and Vite on Vercel; `@peaje/next` covers Next.js; `@peaje/cli` detects the framework and writes the code. The kit offers two paths: a self-contained text for AI coding tools, or the command and the hosting variable for people who use a terminal.
- **The AEO agent.** Plan per goal, citation measurement on four answer engines, full page drafts, missing facts answered in the chat, tasks over MCP and CLI, live verification, 2- and 6-week follow-ups, bot access and freshness checks, mystery shopper, Telegram bot with several sites per chat. 
- **PeajeSettlement v2.1** ([contracts](./contracts)): `settleWithPermit` for EIP-2612 tokens, 70 Foundry tests with invariants, Slither clean, deployed on Arbitrum Sepolia, Robinhood Chain, Arc and Tempo testnets. On Tempo the split is native: 98% straight to the business wallet, 2% to Peaje, in the agent's own transaction ([write-up](./docs/improvements/2026-10-05-tempo-permit.md)).
- **Security review and fixes** ([details](./docs/improvements/2026-09-30-security-review.md)): Peaje signs only with the wallet created for each site; priced routes still charge when the path changes case or encoding; the gateway cannot be redirected to another host; simultaneous withdrawals cannot spend the same balance twice.
- **Pro billing through Peaje's own 402**, payable by any x402 or MPP wallet or from the Peaje balance. Own domain: `usepeaje.com` and `api.usepeaje.com`.

Two audiences test this round at the same time. On Colosseum the project will be published as looking for testers, so crypto-native builders put the payment side through its paces. In parallel, our own team and a group of content creators who have never touched crypto are using the MVP: the radar, the install and the AEO agent, with the wallet created for them and the charging left off. What both groups find decides what ships next.

## Install cost for the coding agent, measured

The kit used to be a 2,300-token prompt (o200k) that walked a coding agent through 19 rewrites, a delete list and six curl checks. It is now one line: `npx @peaje/cli@1 init <slug>`, 195 tokens, and the CLI does the deterministic part itself.

We measured both on the same Next.js test repo (existing rewrites, an i18n middleware matcher, a custom robots.txt and a stale `openapi.json`) with Claude Code headless on Sonnet 5, three runs each, no deploy allowed. Cost and turns are what Claude Code reports.

| Per install | Old prompt | `@peaje/cli` | Change |
|---|---|---|---|
| Prompt size (tokens) | 2,267 | 195 | -91% |
| Agent turns | 19.0 | 10.0 | -47% |
| Output tokens | 11,582 | 2,699 | -77% |
| Cost per session | $0.269 | $0.118 | -56% |
| Wall time | 122 s | 39 s | -68% |

The old prompt left the JSON-LD out in one of three runs. The CLI never missed the proxy, the head block or the cleanup. One CLI run was excluded because Claude Code spawned a subagent and ended the session waiting for it; the table averages the other two. Not measured: other models, other coding agents, or a session with a real deploy. Full write-up and per-run data in [docs/improvements](./docs/improvements/2026-09-22-kit-cli.md).

## Architecture

```
[Agent] ──HTTP/MCP──> [Business site · @peaje/next or @peaje/proxy] ──priced routes──> [Gateway Hono + mppx · Railway] ──proxy──> [Business origin]
                         discovery files, MCP, 402 on the business domain       │  402 → on-chain payment → receipt
                                                                                ├─ Tempo: native split, 98% to the business wallet, 2% to Peaje
                                                                                ├─ PeajeSettlement (Arbitrum · Robinhood · Arc): merchant/fee split on-chain
                                                                                ├─ Circle Nanopayments (Arbitrum · Arc): gasless after one deposit
                                                                                └─ Ledger (Supabase) credits each site net of the fee

[AEO agent] ─ citation measurement (OpenAI, Perplexity, Gemini, Claude) · plan · page drafts (Opus)
            ─ tasks → owner MCP (/_owner/mcp) and `npx @peaje/cli tasks` → live verification → 2w/6w re-measure
            ─ bot access and freshness checks · mystery shopper · Telegram

[Dashboard Next.js · Vercel] ─ radar (public) · email onboarding (Privy) · prices · kit · agent · withdrawals
```

| Piece | What it does |
|---|---|
| `apps/gateway` | Multi-tenant: `/{slug}/*` charges via MPP or x402 and proxies to the origin. Paid-tools MCP at `/{slug}/mcp`, owner MCP at `/_owner/mcp`. Discovery docs generated from the DB and anchored at the business domain. UCP/ACP/AP2. The AEO agent (plan, measurement, drafts, tasks, follow-ups, Telegram). Treasury, settlement and withdrawals with on-chain reconciliation. Pro billing. |
| `apps/dashboard` | Public radar, email registration (Privy, automatic wallet), score with before/after, priced links and API routes, kit with two install paths and a verifier, the AEO agent (chat, plan, citations, tasks, Telegram, mystery shopper, subscription), withdrawals. |
| `packages/peaje-next`, `packages/peaje-proxy`, `packages/peaje-cli` | The 402 on the business's own domain for Next.js, Express, Hono and Vite on Vercel, and the CLI that installs it and applies the agent's tasks. |
| `packages/shared`, `packages/db` | Network definitions, kit generation and verification, route matching; schema and stores (Supabase / in-memory). |
| `contracts` | PeajeSettlement, Foundry. |

## Run locally

```bash
pnpm install
cp .env.example .env   # fill in credentials
pnpm --filter @peaje/gateway dev      # :8787
pnpm --filter @peaje/dashboard dev    # :3100
```

Same cycle locally: `curl -i http://localhost:8787/<slug>/<priced-path>` returns the 402 challenge with every rail.

## Tech

- **Arbitrum**: [PeajeSettlement](./contracts) on Arbitrum Sepolia settles USDC and USDG, crediting the merchant and the platform fee on-chain in the same transaction; merchants withdraw without gas. A subgraph indexes every settlement and withdrawal.
- **Robinhood Chain**: the same contract settles USDG on Robinhood Chain testnet.
- **Tempo**: MPP/402 charging with native splits; pathUSD on both sides of the loop (charge, fund, buy).
- **Circle / Arc**: USDC rail with EIP-3009 authorizations. **Circle Nanopayments** on Arbitrum Sepolia and Arc: one deposit into Circle Gateway, then each request is a signature, no gas; measured at 250 ms per payment ([details](./docs/improvements/2026-09-27-nanopayments.md)).
- **The Graph**: ERC-8004 subgraphs feed identity and on-chain reputation into the buyer agent, and a PeajeSettlement subgraph indexes settlements and withdrawals.
- **Privy**: server wallets for businesses and agents; email-only onboarding.
- **Base / x402**: the real third-party market the buyer agent purchases from with real USDC.

## Status

- Live at [usepeaje.com](https://usepeaje.com). Payments run on test networks today, and the dashboard says so on every screen that shows money.
- Real payments verified on Arbitrum Sepolia (USDC through PeajeSettlement, payment and withdrawal), Tempo testnet (pathUSD with native split), Arc testnet (USDC) and Circle Nanopayments.
- The AEO agent runs end to end on the dashboard and Telegram, with results measured on the live site at 2 and 6 weeks.
