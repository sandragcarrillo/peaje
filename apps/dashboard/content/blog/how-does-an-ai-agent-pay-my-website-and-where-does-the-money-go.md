---
title: "How does an AI agent pay my website and where does the money go?"
description: How an AI agent pays your site over HTTP 402, how you put a price on a route or a link in Peaje and which wallet each payment lands in.
date: 2026-11-01
slug: how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go
lang: en
categoria: Guide
portada: 2
portada_titulo: Get paid by agents
traduccion: como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago
---

# How does an AI agent pay my website and where does the money go?

When an agent asks your site for something that has a price, your site answers `402 Payment Required` with that price. The agent pays in digital dollars (USDC or pathUSD), repeats the request with the payment attached and gets what it asked for. With Peaje the payment lands in your business wallet in the same transaction, minus a 2% fee, and Peaje never holds your money.

Updated: November 2026

Putting a price on a route costs nothing: priced routes are part of the free plan, and Peaje only keeps 2% of each payment you receive, according to the [pricing page](https://usepeaje.com/precios).

## How does an agent pay a site, step by step?

1. The agent requests the route, for example `GET /api/forecast/bogota`.
2. Your site answers 402 with one offer for each network where it can pay. Each offer states the price, the currency and where the payment goes, in the two formats agents use today, MPP and x402 ([which one to pick](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use)).
3. The agent picks a network, signs the payment with its wallet and repeats the request with the payment attached.
4. Peaje checks the payment, asks your site for the response and hands it to the agent along with a receipt in the `Payment-Receipt` header.

The agent needs no account and no API key, because the payment is its credential.

## What does that request look like?

This is how a priced route answers when the agent arrives without paying (values shortened):

```
curl -i https://api.usepeaje.com/your-business/r/report-2026

HTTP/2 402
content-type: application/problem+json
www-authenticate: Payment id="…", realm="api.usepeaje.com", method="evm", intent="charge", request="…"
www-authenticate: Payment id="…", realm="api.usepeaje.com", method="tempo", intent="charge", request="…"
payment-required: …
```

Each `www-authenticate` is an MPP offer, one per network, and `payment-required` carries the same terms in x402 format. With the Peaje kit installed, that response comes from your own domain instead of `api.usepeaje.com`.

## Which networks do agents pay on?

Two today, and the agent chooses:

- **USDC on Arbitrum.** On top of the price, the agent pays the network cost, which is around one cent today and never above US$0.02. Peaje uses it to cover the transaction's gas, and you get 98% of the full price.
- **pathUSD on Tempo.** The agent pays the gas in its own transaction.

## How do I create a paid route in Peaje?

In your dashboard, open Routes, under "Getting paid" in the menu. There are two ways to put a price on something:

- **Priced links.** Any public URL works, whether it is a page, a PDF or a dataset. You paste the URL, set a price and it lives at `api.usepeaje.com/your-business/r/the-link`. You can also import your sitemap and pick which pages to charge for. You do not need an API.
- **Priced API routes.** These are endpoints your server already serves. You enter the method, the path (for example `/api/forecast/:city`), a description for agents and the price in dollars, and tap "Publish route". With the kit installed, the 402 comes from your domain and, once the agent pays, Peaje passes the request on to your server.

Both show up right away in what agents read: your `openapi.json`, your `llms.txt`, your `/developers` page and your MCP server, where each priced route appears as a paid tool. A price of 0 makes the route free, which is useful for samples or docs.

Write the description for an agent that does not know your business, with what it returns, in what format and an example, because that line is what the agent reads to decide whether to pay.

## How do I start charging?

Payments come turned off, and while they are off, agents use your priced routes and links for free. To turn them on, open Revenue and tap "Turn on payments". The notice also shows up on your Home page. You can turn them off whenever you want from the same place.

## Where do I receive the payment?

In the wallet Peaje created for your business when you signed up. It is yours: only your session can use it, and Peaje cannot move those funds. It is the same address on Arbitrum and on Tempo, and you can see it in Revenue with links to check it on each network's explorer.

Each payment arrives in the same transaction the agent pays with, 98% for you and 2% for Peaje. On Arbitrum a [public, verified contract](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020) with the 2% fixed in its code does the split, and on Tempo the agent's own transaction carries both parts. Since Peaje holds no balances, there is nothing to withdraw.

A US$0.05 route, for example, leaves you US$0.049 per payment. Revenue lists each one with the date, the route, the network, what you received and the transaction.

## What happens if the agent does not pay or my site fails?

- **If it does not pay,** it gets the 402 and nothing else, so your content stays put.
- **If your site fails on Arbitrum,** the agent does not pay, because Peaje asks your site for the response before charging.
- **If your site fails on Tempo,** the agent already paid, so Peaje refunds it from its own account, within limits. What reached you stays in your wallet.
- **If your site fails three times in ten minutes,** Peaje stops offering payment for fifteen minutes and lets you know on Telegram or by email.

To see what else your store needs to sell to agents, read [what does my store need so an AI agent can buy from it](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it).
