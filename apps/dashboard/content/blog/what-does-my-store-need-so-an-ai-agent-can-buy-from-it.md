---
title: "What does my store need so an AI agent can buy from it?"
description: The four things an agent checks before buying from you (finding you, understanding you, using you and paying you), with a checklist for each step and the buying protocols that exist today.
date: 2026-10-29
slug: what-does-my-store-need-so-an-ai-agent-can-buy-from-it
lang: en
categoria: Guide
portada: 4
portada_titulo: Store ready for agents
traduccion: que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle
---

# What does my store need so an AI agent can buy from it?

It needs four things, in this order: the agent has to find you, understand what you sell and at what price, use your site without getting stuck and have a way to pay you. If either of the first two fails, the agent never reaches payment, so that is where to start. Peaje's [free radar](https://usepeaje.com/radar) checks all four in under a minute.

Updated: October 2026

Peaje's radar groups its checks into those four layers, it is free and it only asks for your email and your domain, according to the [radar page](https://usepeaje.com/radar).

## What does an agent check before buying from you?

| Step | What the agent needs | What fails most often |
| --- | --- | --- |
| Find you | Permission to read your site and a map of your pages | A robots.txt or a firewall that blocks the search bots |
| Understand you | Your products, prices and details in a format it reads without guessing | Prices that only show up with JavaScript or behind a login |
| Use you | Buttons, forms and a connection that work without a person | Bot protection that cuts the agent off at the cart |
| Pay you | A buying or payment protocol the agent knows | A checkout that only works with a person typing in a card |

## What does it need to find you?

- A `robots.txt` that lets in the search bots from OpenAI, Anthropic and Perplexity, and also the ones that come in when a customer asks their assistant for something. [This guide](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in) explains which is which.
- A `sitemap.xml` with the date each page changed.
- No `noindex` on your homepage, and your site at the top when someone searches your brand.

## What does it need to understand what you sell and at what price?

- **Structured data (JSON-LD):** your business card (Organization) and, on each product, its name, price, currency and availability (Product and Offer). Many store platforms already generate the product data, so check that it is there and that the price matches the page.
- **Content without JavaScript:** if the price or the description only shows up after a script loads, many agents do not see it.
- **No login to browse:** the catalog and prices have to be readable without signing in.
- **A guide for agents (llms.txt):** what you sell, where everything is and how to buy from you.
- **Trust pages:** about, contact and privacy, which the agent uses to decide whether you are a real business.

## What does it need to use your store without getting stuck?

- **Bot protection that tells them apart:** the kind that blocks everything automated also cuts off the agent buying for a customer.
- **Well-built buttons and forms:** buttons that are real buttons, with a name, and fields with their label. An agent browsing your store reads them the same way a screen reader does.
- **Retries without duplicate orders:** if your store has an API, it should accept an idempotency key (Idempotency-Key), so an agent can retry without charging twice.
- **A direct connection (MCP or OpenAPI):** it lets the agent look up products or place an order without going through the screens.

## How does an agent pay you?

Several protocols coexist today, and each assistant uses its own:

| Protocol | Who created it | What it is for |
| --- | --- | --- |
| ACP (Agentic Commerce Protocol) | OpenAI and Stripe, September 2025 | Letting the agent complete the purchase in your checkout. It powers buying inside ChatGPT, which started with Etsy sellers in the United States |
| UCP (Universal Commerce Protocol) | Google with Shopify, Walmart and other companies, January 2026 | Finding products, buying and post-purchase support, in Google's AI Mode and in Gemini |
| AP2 (Agent Payments Protocol) | Google with more than 60 companies, September 2025 | Proving with a signature that the customer authorized that purchase. It takes cards, bank transfers and stablecoins |
| x402 and MPP | Coinbase, and Stripe with Tempo | Charging per use with an HTTP 402 response. They fit APIs and digital content better than a cart. We compare the two in [this guide](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use) |

If you sell physical products on Shopify or Etsy, ACP and UCP will most likely reach you through your platform, so check its settings before you build anything. If you sell access to an API or content per use, the route is the 402. Peaje answers with x402 and MPP in the same 402, on test networks today, so it moves no real money yet.

## Where do I start?

With the [free radar](https://usepeaje.com/radar), which tells you in under a minute at which of the four steps you fall. Then Peaje's free kit covers a good part of the first two: your robots.txt, your business card in JSON-LD, llms.txt, an MCP server and agent cards. You get it by registering your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo) and you install it from your dashboard, with a text for your AI coding tool or with a command. The details of each product and the checkout stay with your store platform.

If you want someone to go over all this with you every week, the Pro agent costs US$30 a month (the founder price for the first 50 businesses, then US$69), with 500 credits a month and 20 tracked questions in AI assistants.

## Sources

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [OpenAI: buying inside ChatGPT](https://openai.com/index/buy-it-in-chatgpt/)
- [Universal Commerce Protocol](https://ucp.dev)
- [Shopify: NRF 2026 recap and Google's UCP](https://www.shopify.com/enterprise/blog/nrf-2026-recap)
- [Google Cloud: AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
