---
title: "Why do AI agents pay with stablecoins like USDC?"
description: Why AI agents pay with stablecoins instead of cards, what a per-request payment of a few cents needs, what x402, MPP, Stripe and Circle say, and which stablecoins agents use to pay you through Peaje.
date: 2026-11-13
slug: why-do-ai-agents-pay-with-stablecoins-like-usdc
lang: en
categoria: Guide
portada: 4
portada_titulo: Why stablecoins
traduccion: por-que-los-agentes-de-ia-pagan-con-stablecoins-como-usdc
---

# Why do AI agents pay with stablecoins like USDC?

AI agents pay with stablecoins because they need to pay for each request, often a few cents, without creating an account or holding a card in their name, and because the site needs to see the payment before it hands over what it sells. A stablecoin like USDC is tied to the dollar, gets sent from a wallet the agent controls and settles in seconds at any hour, so the payment fits inside the same HTTP request. That is why x402 and MPP, the two protocols agents pay with today, accept stablecoins, and x402 names them as its primary use case.

Updated: November 2026

Stripe does not let you charge less than US$0.50 per payment in dollars, a minimum it sets so its fee does not exceed the charge, according to its [currencies page](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts). In its [MPP guide](https://docs.stripe.com/payments/machine/mpp), the card minimum is the same, US$0.50, and with stablecoins it drops to 0.01 USDC.

## Why don't cards work for charging a few cents?

There are two problems: the minimum per charge and everything a card asks for before paying. If your route costs one cent, you cannot charge it on its own by card through Stripe, because each payment has to reach US$0.50. And an agent paying by card has to go through a checkout built for people: the [MPP documentation](https://mpp.dev/overview) says that what makes a payment comfortable for a person (changing forms, captchas, automating a browser) is an obstacle for a program, and that it makes the payment less reliable, slower and more expensive.

The [x402](https://www.x402.org/) site sums up the old model with the same kind of list: setting up an account takes time, identity checks delay access, there are keys to store and rotate, you pay up front, and transactions are slow, with chargebacks and fees. A person who buys once a month can live with that, and an agent making hundreds of requests a day cannot.

## What does a stablecoin offer an agent?

This is what a per-request payment needs and what the sources say about each point:

| What the agent needs | What the sources say |
| --- | --- |
| The dollar price is what gets paid | Circle says USDC is redeemable 1:1 for US dollars and backed 100% by highly liquid cash and cash-equivalent assets |
| Paying without an account or API key | x402 lets clients pay without accounts, sessions or credential management, and MPP without signups, billing accounts or API keys |
| Charging very small amounts | MPP lets you charge sub-cent amounts per query or per request, and x402 has built-in micropayment support |
| The payment confirms quickly, at any hour | Circle says USDC payments settle in seconds and work 24/7 |
| The agent can do it alone | Circle presents USDC as a programmable money layer so AI agents can pay and get paid autonomously |

What ties it together is the wallet: the agent signs the payment with its key, the site checks it and settles it on the network, and nobody has to approve anything by hand. How that signature travels in a request is in [what is x402](https://usepeaje.com/blog/what-is-x402-and-how-does-an-ai-agent-pay-with-http-402) and [what is MPP](https://usepeaje.com/blog/what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo), and how the two differ is in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use).

## Can agents only pay with stablecoins?

No, the protocols also accept other payment methods. MPP says it works with stablecoins, cards and bank transfers, and Stripe uses it with cards through Shared Payment Tokens. x402 says it aims to support all networks, crypto and fiat. From US$0.50 up a card fits within Stripe's minimum, and for charging a few cents per request, what fits today is a stablecoin.

One note: this explains how the payment works, and none of it is a recommendation to buy or hold crypto.

## Which stablecoins do agents use to pay you through Peaje?

Two, and the agent picks one:

- **USDC on Arbitrum.** It goes out in the 402 as an x402 offer and as an MPP offer. The agent pays the network cost on top, which never goes above US$0.02.
- **pathUSD on Tempo.** It goes out as an MPP offer. pathUSD is a dollar stablecoin on the Tempo network, issued by Bridge and backed 1:1 by dollar reserves, according to [Tempo's documentation](https://tempo.xyz/developers/docs/protocol/exchange/pathUSD). The agent pays the gas in its own transaction.

In both, 98% reaches your business wallet in the same transaction the agent pays in, and Peaje keeps 2%, which on Arbitrum is fixed in a [public contract](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020). The payment stays in your wallet in the same stablecoin the agent paid with: Peaje holds no balances and does not move it to a bank account. How each payment gets split is in [how much does Peaje keep](https://usepeaje.com/blog/how-much-does-peaje-keep-from-each-ai-agent-payment), and how you put a price on a route is in [how does an AI agent pay my website](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go).

Peaje does not charge agent requests by card: every 402 carries offers only in those two stablecoins. Payments come turned off, and you turn them on in Revenue with "Turn on payments". If you are not sure what to charge for yet, see [which API routes should I charge for](https://usepeaje.com/blog/which-api-routes-should-i-charge-for-and-which-should-i-leave-free), and the [free radar](https://usepeaje.com/radar) tells you whether your site already answers x402 and MPP.

## Sources

- [Stripe: minimum charge amount](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts)
- [Stripe: accept agent payments with MPP](https://docs.stripe.com/payments/machine/mpp)
- [mpp.dev: protocol overview](https://mpp.dev/overview)
- [x402.org](https://www.x402.org/)
- [x402 documentation](https://docs.x402.org/)
- [x402 on GitHub](https://github.com/x402-foundation/x402)
- [Circle: USDC](https://www.circle.com/usdc)
- [Tempo: pathUSD](https://tempo.xyz/developers/docs/protocol/exchange/pathUSD)
- [Peaje contract on Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Peaje pricing](https://usepeaje.com/precios)
