---
title: "x402 vs MPP: which payment protocol for AI agents should I use?"
description: What x402 is, what MPP is, how they differ and why you do not have to pick one if your site can offer both in the same response.
date: 2026-10-28
slug: x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use
lang: en
categoria: Guide
portada: 4
portada_titulo: x402 vs MPP
traduccion: x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar
---

# x402 vs MPP: which payment protocol for AI agents should I use?

If you can, do not pick: offer both in the same response and let the agent pay with the one it knows. x402 and MPP solve the same thing, an agent paying you without a person stepping in, and both use the HTTP 402 "Payment Required" response, but each agent speaks one or the other. Peaje answers with both in the same 402, and today they run on test networks, so they move no real money yet.

Updated: October 2026

Once payments are real, Peaje keeps 2% of each payment and the rest goes to your business's wallet, according to the [homepage](https://usepeaje.com/).

## What is x402?

It is an open standard created by Coinbase. When an agent asks for something that costs money, your site answers 402 with the price, and the agent pays and repeats the request with the payment attached. Payment is in stablecoins on networks like Base or Solana, with a wallet and no account or API key, and a service called a facilitator verifies and settles each payment. Since September 2025 it has been backed by the x402 Foundation, which Coinbase launched together with Cloudflare.

## What is MPP?

MPP (Machine Payments Protocol) was launched by Stripe and Tempo on March 18, 2026, and it is written as a draft at the IETF, the group that sets internet standards, under the name "The Payment HTTP Authentication Scheme". It uses the authentication headers HTTP already had, and in a single 402 your site can offer several ways to pay: stablecoins on Tempo, cards through Stripe or Lightning. Besides paying per request, it allows sessions, where the agent pays as it goes and everything settles together at the end.

## How are they different?

| | x402 | MPP |
| --- | --- | --- |
| Who created it | Coinbase, now with the x402 Foundation | Stripe and Tempo, a draft at the IETF |
| How the price travels | x402's own headers | `WWW-Authenticate: Payment`, the standard HTTP header |
| Ways to pay | Stablecoins on Ethereum-compatible networks and Solana | Stablecoins on Tempo, cards through Stripe, Lightning and others |
| Usage billing | Per request, and each implementation adds its own sessions | Per request or per session |

## So which one do I use?

It depends on who is going to pay you. If your buyers are agents that already have a wallet with USDC on Base, x402 is the direct route. If you sell something used often, like an API that gets called hundreds of times, MPP sessions save you from settling every request separately. Since you do not know ahead of time which agent will arrive, the safest move is to answer with both, and that is what Peaje does: each 402 carries one `WWW-Authenticate: Payment` offer per network, which is MPP, and the `Payment-Required` header with the same terms in x402 form.

## What do I do before charging?

Charging is the last step. Before that, an agent has to find you, understand what you sell and at what price, and use you without getting stuck, because if ChatGPT or Claude cannot understand your site, they never get to ask you for anything. Start with the [free radar](https://usepeaje.com/radar), which shows you in under a minute what an agent sees when it arrives, and then the free kit: you register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo) and install it from your dashboard by pasting a text into your AI coding tool or with `npx @peaje/cli@1 init <slug>`. Charging is optional, and you can use everything else without pricing anything.

## What if I pick wrong?

You are not locked in. The pages and fixes your agent hands you work the same with either protocol, and with Peaje you do not have to change anything on your site if agents start preferring one of the two.

## Sources

- [MPP draft at the IETF: The Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/)
- [x402: open standard for payments over HTTP](https://www.x402.org/)
- [Quicknode: x402 vs MPP, how they work and how they differ](https://www.quicknode.com/blog/x402-vs-mpp)
- [Peaje: how it works and common questions](https://usepeaje.com/)
