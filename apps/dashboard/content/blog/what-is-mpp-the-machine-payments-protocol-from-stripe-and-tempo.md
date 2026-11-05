---
title: "What is MPP, the Machine Payments Protocol from Stripe and Tempo?"
description: What the Machine Payments Protocol (MPP) is, who created it, how a payment works with the 402 response, what agents pay with and how to start accepting it on your site or API.
date: 2026-11-05
slug: what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo
lang: en
categoria: Guide
portada: 4
portada_titulo: What is MPP
traduccion: que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia
---

# What is MPP, the Machine Payments Protocol from Stripe and Tempo?

MPP (Machine Payments Protocol) is an open standard that lets an AI agent pay a website or an API without going through a checkout or creating an account. Stripe and Tempo wrote it and launched it on March 18, 2026, the same day Tempo's main network went live. When an agent asks for something that costs money, the site answers `402 Payment Required` with the payment options it accepts, the agent pays, repeats the request with proof of payment and gets what it asked for along with a receipt.

Updated: November 2026

According to [Tempo's announcement](https://tempo.xyz/blog/mainnet), the directory of MPP-compatible services started with more than 100 services.

## How does an MPP payment work?

In four steps, all inside HTTP:

1. The agent requests the resource, for example `GET /api/report`.
2. The site answers 402 with a challenge for each payment option it accepts, in the `WWW-Authenticate: Payment` header. Each challenge states the amount, the currency and where the payment goes.
3. The agent picks a payment option, authorizes it and repeats the request with the payment credential.
4. The site verifies the payment and delivers the resource with a receipt.

The agent needs no API key or user account, because the payment works as its credential. That sets it apart from a subscription: each request can be charged on its own, even if it costs one cent.

## Who is behind MPP?

Stripe and Tempo, a payments network incubated by Stripe and Paradigm. The specification is published as a draft at the IETF, the group that defines internet standards, under the name "The Payment HTTP Authentication Scheme", and its authors include people from Tempo and Stripe. Being a draft means it can still change and the IETF has not approved it as a standard.

## What do agents pay with?

MPP is not tied to a single payment method. Each one is defined in its own specification, and the same 402 can offer several:

| Payment method | How it arrives |
| --- | --- |
| Stablecoins on Tempo | The agent pays from its wallet on the Tempo network |
| Cards through Stripe | With Shared Payment Tokens issued by the agent |
| Other networks | Each implementation adds its own, for example Ethereum-compatible networks |

Tempo also said that Visa extended MPP to card payments on its network and that Lightspark brought it to Bitcoin over Lightning.

Besides charging per request, MPP supports sessions: the agent authorizes once, sets aside an amount and pays as it uses the service, and the small payments settle together in a single transaction. That is useful for APIs that get called hundreds of times.

## How is it different from x402?

Both use the 402 response and solve the same problem. Coinbase created x402, which travels in its own headers, while MPP uses the authentication headers HTTP already had and accepts payment methods outside the blockchain, like cards. Each agent speaks one or the other, so the safest option is to answer with both in the same 402. We compare them in more detail in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use).

## How do I start accepting MPP?

You have two paths:

- **With Stripe.** If you already charge with Stripe, its [MPP guide](https://docs.stripe.com/payments/machine/mpp) uses the `mppx` library and records each payment as a PaymentIntent. It accepts cards from US$0.50 per payment and stablecoins from 0.01 USDC, which Stripe converts and settles into your Stripe balance. Check availability for your country in the same guide.
- **With Peaje.** You put a price on a link or an API route from your dashboard, for free, and every 402 goes out with MPP offers for USDC on Arbitrum and pathUSD on Tempo, plus the same terms in x402 format. The payment reaches your business wallet in the same transaction, minus Peaje's 2% ([how it works](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go)).

Before charging, check that agents can find you and understand what you sell. The [free radar](https://usepeaje.com/radar) tells you in less than a minute what an agent sees when it reaches your site, and it also checks whether you accept any payment protocol.

## Sources

- [Tempo: mainnet and MPP launch](https://tempo.xyz/blog/mainnet)
- [mpp.dev: protocol overview](https://mpp.dev/overview)
- [IETF: The Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/)
- [Stripe: accept agent payments with MPP](https://docs.stripe.com/payments/machine/mpp)
- [Peaje pricing](https://usepeaje.com/precios)
