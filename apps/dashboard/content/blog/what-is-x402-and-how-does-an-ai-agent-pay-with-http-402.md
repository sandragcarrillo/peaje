---
title: "What is x402 and how does an AI agent pay with HTTP 402?"
description: What x402 is, who created it and who governs it today, what travels in the version 2 headers, how the exact scheme and the facilitator work, what the Bazaar is and how Peaje offers it.
date: 2026-11-07
slug: what-is-x402-and-how-does-an-ai-agent-pay-with-http-402
lang: en
categoria: Guide
portada: 4
portada_titulo: What is x402
traduccion: que-es-x402-y-como-funciona-el-pago-de-un-agente-de-ia-con-http-402
---

# What is x402 and how does an AI agent pay with HTTP 402?

x402 is an open standard that lets an AI agent pay for a resource inside the same HTTP request, with stablecoins and without an account or API key. Coinbase created it in May 2025, and today it is stewarded by the x402 Foundation, which runs inside the Linux Foundation. Your site answers `402` with its terms in the `PAYMENT-REQUIRED` header, the agent signs the payment and sends it in `PAYMENT-SIGNATURE`, and it gets the resource along with the settlement result in `PAYMENT-RESPONSE`.

Updated: November 2026

According to the [Coinbase Developer Platform documentation](https://docs.cdp.coinbase.com/x402/welcome), its service has already processed more than 100 million x402 payments across Base and Solana.

## Who created x402 and who governs it today?

Coinbase started it, and in less than a year it moved to a neutral foundation:

| Date | What happened |
| --- | --- |
| May 2025 | Coinbase launches x402 |
| September 23, 2025 | Cloudflare and Coinbase announce the x402 Foundation |
| December 9, 2025 | Version 2 of the specification comes out |
| April 2, 2026 | The Linux Foundation announces it is launching the x402 Foundation and taking in the protocol contributed by Coinbase |
| July 14, 2026 | The foundation starts operating with 40 member organizations |

The specification and the reference code are on GitHub under the Apache 2.0 license, now under the foundation's account. It no longer depends on a single company, and anyone can implement it without asking permission. How it compares with the Stripe and Tempo protocol is in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use).

## What travels in the version 2 headers?

Version 2 moved all payment data into headers and left behind the version 1 headers, `X-PAYMENT` and `X-PAYMENT-RESPONSE`. The three new headers carry base64-encoded JSON:

| Header | Who sends it | What it carries |
| --- | --- | --- |
| `PAYMENT-REQUIRED` | Your site, with the 402 | The resource and an `accepts` list with each payment option: scheme, network, amount, currency, who gets paid and how many seconds the offer is valid |
| `PAYMENT-SIGNATURE` | The agent, when it repeats the request | The offer it picked and its signed payment |
| `PAYMENT-RESPONSE` | Your site, with the resource | Whether the charge went through, the network, who paid and the transaction |

Networks are written in CAIP-2 format, which puts the family first and then the chain number, for example `eip155:42161` for Arbitrum One. The amount goes in the currency's smallest unit, so with USDC, which has 6 decimals, `10000` is one cent. Version 2 also formalized extensions, which add features without changing the base protocol, and the official libraries still understand version 1 clients. What the 402 itself is and what an agent gets when it does not pay is in [what is 402 Payment Required](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying).

## How do the "exact" scheme and the facilitator work?

`exact` is the scheme for charging a fixed amount, like one cent per request. On Ethereum-compatible networks, the agent signs a transfer authorization for the exact amount and address in the offer, and someone else sends the transaction. With USDC that authorization uses EIP-3009, the `transferWithAuthorization` function the token already has. Whoever receives the signature submits it to the network and pays the gas, so the agent does not need to hold ETH. For tokens without EIP-3009, the specification uses Permit2, which needs a prior approval from the agent.

The facilitator is the server that does that part for your site: it checks the signature (`/verify`) and settles the payment on the network (`/settle`), on one or several networks. The specification says the facilitator cannot change the amount or the destination, and that its role is limited to sending the transaction. Your site can use an external one, like Coinbase's, or do it on its own.

Besides `exact`, the specification defines `upto`, which authorizes up to a cap and charges what was used, and `batch-settlement`, which on EVM networks bundles many small charges to settle them in a batch.

## What is the x402 Bazaar?

It is how agents discover which services charge with x402. In the specification, `bazaar` is an extension: your server describes the endpoint in the 402 (method, parameters and what it returns), and the facilitators that support it catalog it and publish it at `GET /discovery/resources` and `GET /discovery/search`. Coinbase runs its own and defines it as a catalog of payment-gated services discovered by its facilitator. For an agent, it works like a search engine for paid APIs: it finds the URL, sees the price and pays without signing up. There are other ways to get found, and we cover them in [how do AI agents find my API](https://usepeaje.com/blog/how-do-ai-agents-find-my-api).

## How does Peaje offer x402?

Every priced route or link answers a 402 with MPP offers and, in the same response, the `PAYMENT-REQUIRED` header in x402 version 2 format. Today there is a single x402 offer:

- **Network and currency:** USDC on Arbitrum One (`eip155:42161`), with the `exact` scheme and EIP-3009 authorization. Payment in pathUSD on Tempo goes out only as an MPP offer ([what is MPP](https://usepeaje.com/blog/what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo)).
- **Who gets paid:** Peaje's contract, which in the same transaction sends 98% to your business wallet and 2% to Peaje ([how much Peaje keeps](https://usepeaje.com/blog/how-much-does-peaje-keep-from-each-ai-agent-payment)).
- **Amount:** the price plus the network cost, which never goes above US$0.02, because Peaje sends the transaction and pays the gas.
- **Facilitator:** Peaje plays that role without using an external one: it checks the signature, asks your site for the response before charging and, if the payment goes through, delivers the resource with `PAYMENT-RESPONSE`.
- **Catalog:** your domain serves `/discovery/resources` in the Bazaar format, with one entry per URL that charges and the same terms its 402 carries. Since payments do not go through Coinbase's facilitator, your routes are not added to its Bazaar on their own.

In "Agent visits" you see x402 clients separately, along with the "Payment funnel": 402s served, how many agents came back with a payment and how many paid. Payments start turned off, and you turn them on in Revenue with "Turn on payments". Before that, the [free radar](https://usepeaje.com/radar) tells you whether your site already answers x402 and MPP.

## Sources

- [x402.org: version 2 launch](https://x402.org/x402-v2-launch/)
- [x402 specification, version 2](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- [x402: version 2 HTTP transport](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md)
- [x402: exact scheme on EVM networks](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md)
- [x402: bazaar extension](https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md)
- [Coinbase Developer Platform: x402](https://docs.cdp.coinbase.com/x402/welcome)
- [Coinbase Developer Platform: Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
- [Cloudflare: Cloudflare and Coinbase will launch the x402 Foundation](https://www.cloudflare.com/press/press-releases/2025/cloudflare-and-coinbase-will-launch-x402-foundation/)
- [Linux Foundation: launching the x402 Foundation](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol)
- [x402.org: operational launch of the x402 Foundation](https://x402.org/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications/)
- [Peaje pricing](https://usepeaje.com/precios)
