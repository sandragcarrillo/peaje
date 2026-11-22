---
title: "ACP vs UCP vs AP2: which AI agent shopping protocol does my store need?"
description: ACP vs UCP vs AP2 in November 2026, compared in one table. Who maintains each one, what it solves, where it is used today, which payment providers support ACP and UCP, and which one your store needs.
date: 2026-11-07
updated: 2026-11-22
slug: acp-ucp-and-ap2-which-ai-agent-shopping-protocol-does-my-store-need
lang: en
categoria: Guide
portada: 3
portada_titulo: ACP, UCP and AP2
traduccion: acp-ucp-y-ap2-que-protocolo-de-compra-con-agentes-de-ia-necesita-mi-tienda
---

# ACP vs UCP vs AP2: which AI agent shopping protocol does my store need?

ACP and UCP do the same job for different companies: both let an AI agent build a cart and check out at your store. ACP comes from OpenAI and Stripe, and UCP from Google with Shopify, Etsy, Wayfair, Target and Walmart. AP2 works at another layer, the signed proof that a person approved the purchase, and UCP supports it. If you sell on Shopify, Etsy or with a large payment processor, you will most likely get ACP and UCP through them instead of building them yourself.

Updated: November 22, 2026

The three are open standards under the Apache 2.0 license, so using them costs nothing. What you pay is your payment processor's fees, as with any sale.

## ACP vs UCP vs AP2 in one table

| | ACP | UCP | AP2 |
| --- | --- | --- | --- |
| What it solves | Checkout and handing over the payment method | The whole purchase: catalog, cart, buyer account, checkout and order | Proof that a person approved what the agent buys |
| Who maintains it | OpenAI and Stripe | A Tech Council founded by Google, Shopify, Etsy, Target and Wayfair | The FIDO Alliance, since April 2026 |
| Latest version | 2026-04-17, still in beta | Dated versions, and the current specification uses 2026-08-25 | 0.2, from April 28, 2026 |
| How the agent finds you | Your store's checkout endpoints | A JSON profile at `/.well-known/ucp` | It travels inside the purchase, as signed mandates |
| How it travels | REST or MCP | REST, MCP or A2A | Extension of A2A and MCP, and of UCP for mandates |
| What the buyer pays with | A card turned into a single-use token by your processor | Whatever payment handler your store declares, like Google Pay | Cards today, with bank transfers on the roadmap |

## What is ACP and what does it solve?

ACP (Agentic Commerce Protocol) is the open standard OpenAI and Stripe published on September 29, 2025, the day Instant Checkout in ChatGPT launched. It solves two things:

- **Checkout.** Your store exposes `/checkout_sessions` to create, update, complete and cancel a purchase, and the agent builds the buyer's cart there.
- **Delegated payment.** Your payment processor exposes `/agentic_commerce/delegate_payment`, which turns the buyer's card into a single-use token with a maximum amount, an expiration date and validity for one merchant only. Stripe was the first compatible processor, with its Shared Payment Token.

The agent does not become the merchant of record: the sale stays yours and you charge it with your own processor. The specification ships dated versions. The latest, from April 17, 2026, added cart, product feed, orders, authentication and MCP.

### Does ChatGPT still use ACP to buy?

Not by that name. OpenAI's commerce documentation, read on November 22, 2026, does not mention ACP or Instant Checkout. It describes four paths: a product feed for ChatGPT to find your products, its cloud browser buying through your current checkout, ChatGPT Wallet to pay on your site, and a plugin, which is an MCP server plus skills ([what MCP is](https://usepeaje.com/blog/what-is-mcp-and-how-is-it-different-from-an-api)), for ChatGPT to call your cart and your checkout directly. The ACP specification is still maintained on GitHub, but if your goal is selling in ChatGPT, OpenAI's guide is the place to start today.

## What is UCP and what does it solve?

UCP (Universal Commerce Protocol) is the open standard Google launched on January 11, 2026 for the whole shopping journey: searching the catalog, building the cart, linking the buyer's account, paying and tracking the order. Your store publishes a JSON file at `/.well-known/ucp` that says which services it has, which capabilities it supports and which payment methods it accepts, and the agent reads it to learn how to buy from you without a hand-built integration.

It runs over REST, MCP or A2A, and it separates the instrument (what the buyer pays with) from the payment handler (who processes the charge), so each store declares its own rails. Google uses it for checkout in AI Mode in Search, with Google Pay and for eligible U.S. retailers, and its merchant page lists the Gemini app as coming soon and a waitlist to join. On April 24, 2026 Amazon, Meta, Microsoft, Salesforce and Stripe joined its Tech Council, the body that votes on changes to the specification.

## What is AP2 and what is it for?

AP2 (Agent Payments Protocol) proves that a person approved what the agent buys. Google announced it on September 16, 2025 with more than 60 organizations, and on April 28, 2026 it donated it to the FIDO Alliance, the same day version 0.2 came out.

Each purchase carries two mandates, which are digital contracts signed with verifiable credentials: the checkout mandate, which goes to the merchant, and the payment mandate, which goes to the processor and the card network. Each one has an open stage, with the limits the person sets (budget, allowed payment methods), and a closed stage, with the exact cart and amount. That covers purchases with the person present and also ones approved in advance. Today it supports cards, and its roadmap adds wallets, real-time bank transfers like PIX or UPI, and other methods.

## ACP vs UCP: which payment providers support each one?

Stripe is on both sides: it maintains ACP with OpenAI, it was the first processor with ACP's Shared Payment Token, and it sits on UCP's Tech Council, with its own [UCP guide](https://docs.stripe.com/agentic-commerce/protocols/ucp). The official ACP site names no other compatible processor yet.

UCP has more names. Its official site lists Stripe, Adyen, PayPal, Visa, Mastercard, American Express and Worldpay among its endorsers, along with Klarna, Affirm, Block and Fiserv. Endorsing a protocol does not mean a processor already offers it in your country, so ask yours before you build anything.

## Which one does my store need?

- **You sell products on Shopify, Etsy or another platform:** check your platform's settings first, because ACP and UCP depend on your catalog, your checkout and your processor, and the platform is usually the one that connects them.
- **You want to sell in ChatGPT:** start with OpenAI's commerce documentation, with your product feed and a checkout its cloud browser can complete.
- **You want to sell in AI Mode or Gemini:** start with Merchant Center and Google's UCP page. Today it is for eligible U.S. retailers.
- **You run your own store and charge with Stripe:** [Stripe's agentic commerce guide](https://docs.stripe.com/agentic-commerce) covers the Shared Payment Token and UCP.

Before any protocol, an agent has to find your prices and understand what you sell. In the "Can they buy from you?" section, Peaje's [free radar](https://usepeaje.com/radar) checks whether an agent can find your prices (in a pricing.md or in your structured data) and whether you publish a UCP profile at `/.well-known/ucp`, and its results also show whether you answer ACP and AP2. Peaje does not enroll you in ChatGPT's or Google's checkout and does not process card payments. The full list of what an agent looks at before buying from you is in [what does my store need so an AI agent can buy from it](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it).

## Frequently asked questions

### Can my store support ACP and UCP at the same time?

Yes. They are separate specifications, and Stripe, for example, offers both.

### Do I need AP2 if I already use UCP?

Not to start. UCP has an AP2 mandates extension to prove the buyer's approval. Whether you need it depends on your processor and on the agents that buy from you, so ask your processor, especially if you expect purchases without the person present.

### Is ACP still alive?

The specification is. Its latest version is from April 17, 2026 and it is still in beta. What changed is ChatGPT: its current commerce documentation no longer describes Instant Checkout.

### Are ACP, UCP and AP2 available outside the United States?

The specifications are open to anyone. The checkouts that use them today, in ChatGPT and in Google, have their own eligibility rules, and Google limits its checkout to eligible U.S. retailers for now.

## Sources

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [ACP on GitHub: versions and specifications](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe: Instant Checkout in ChatGPT and the Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- [OpenAI: commerce documentation](https://developers.openai.com/commerce/)
- [OpenAI: accept payments in ChatGPT](https://developers.openai.com/commerce/guides/accept-payments)
- [OpenAI: build a commerce plugin](https://developers.openai.com/commerce/guides/build-a-plugin)
- [Google: Universal Commerce Protocol announcement (January 11, 2026)](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
- [Google Developers: under the hood of UCP](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [Google Merchant Center: UCP](https://developers.google.com/merchant/ucp)
- [Universal Commerce Protocol](https://ucp.dev)
- [UCP Tech Council: Amazon, Meta, Microsoft, Salesforce and Stripe join (April 24, 2026)](https://www.financialcontent.com/article/newsfile-2026-4-24-amazon-meta-microsoft-salesforce-and-stripe-join-the-universal-commerce-protocol-tech-council)
- [Google Cloud: AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Agent Payments Protocol](https://ap2-protocol.org/)
- [Google: donating AP2 to the FIDO Alliance](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/)
- [Stripe: agentic commerce](https://docs.stripe.com/agentic-commerce)
- [Peaje free radar](https://usepeaje.com/radar)
