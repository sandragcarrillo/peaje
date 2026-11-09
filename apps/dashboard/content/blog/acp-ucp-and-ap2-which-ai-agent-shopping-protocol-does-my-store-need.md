---
title: "ACP, UCP and AP2: which AI agent shopping protocol does my store need?"
description: What ACP from OpenAI and Stripe, UCP from Google and AP2 from Google are, who created them, what each one solves, how they differ from x402 and MPP and what Peaje does with each one today.
date: 2026-11-07
slug: acp-ucp-and-ap2-which-ai-agent-shopping-protocol-does-my-store-need
lang: en
categoria: Guide
portada: 3
portada_titulo: ACP, UCP and AP2
traduccion: acp-ucp-y-ap2-que-protocolo-de-compra-con-agentes-de-ia-necesita-mi-tienda
---

# ACP, UCP and AP2: which AI agent shopping protocol does my store need?

It depends on where your customers shop: ACP is what ChatGPT uses to buy from a store, and UCP is what Google uses for checkout in AI Mode in Search and in Gemini. AP2 handles a different part of the purchase, the signed proof that a person approved it, and it works together with UCP. If you sell products on a large platform like Shopify or Etsy, ACP and UCP will most likely reach you through it, along with your payment processor.

Updated: November 2026

Google launched UCP on January 11, 2026 with Shopify, Etsy, Wayfair, Target and Walmart, and with the backing of more than 20 other companies, including Visa and Mastercard, according to [Google's announcement](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/).

## What is ACP and what does it solve?

ACP (Agentic Commerce Protocol) is the open standard OpenAI and Stripe published on September 29, 2025, the day Instant Checkout in ChatGPT launched for users in the United States, starting with Etsy sellers. Both companies maintain it, it is licensed under Apache 2.0, it is still in beta and it ships dated versions. It solves two things:

- **Checkout.** Your store exposes `/checkout_sessions` to create, update, complete and cancel a purchase, and the agent builds the buyer's cart there.
- **Delegated payment.** Your store's payment processor exposes `/agentic_commerce/delegate_payment`, which turns the buyer's card into a single-use token with a maximum amount, an expiration date and validity for a single merchant. Stripe was the first compatible processor, with its Shared Payment Token.

The agent does not become the merchant of record: the sale stays yours and you charge it with your own processor. OpenAI's documentation starts the integration by asking for your product catalog in a structured format.

## What is UCP and what does it solve?

UCP (Universal Commerce Protocol) is Google's open standard for the whole shopping journey: searching the catalog, building the cart, linking the buyer's account, paying and tracking the order. Your store publishes a JSON file at `/.well-known/ucp` that says which services it has, which capabilities it supports (checkout, discounts, fulfillment) and which payment methods it accepts, and the agent reads it to learn how to buy from you without a hand-built integration.

It runs over REST, MCP or A2A, it is licensed under Apache 2.0 and it separates the instrument (what the buyer pays with) from the payment handler (who processes the charge), so each store declares its own rails. Google uses it for checkout in AI Mode in Search and in the Gemini app, with Google Pay and the details saved in Google Wallet, for now with eligible U.S. retailers.

## What is AP2 and what is it for?

Google announced AP2 (Agent Payments Protocol) on September 16, 2025 with more than 60 organizations, including Adyen, American Express, Coinbase, Mastercard and PayPal. Its job is to prove that a person approved what the agent buys. Each purchase carries mandates, which are digital contracts signed with verifiable credentials: at launch there was one with the buyer's intent and another with the exact cart and its price, and in version 0.2 they are called the checkout mandate and the payment mandate.

It accepts cards, real-time bank transfers and stablecoins, and Google released the A2A x402 extension for crypto payments together with Coinbase and other companies. It works as an extension of A2A and MCP, and also with UCP. On April 28, 2026 Google donated AP2 to the FIDO Alliance, and version 0.2 came out the same day, adding payments without the person present, approved in advance.

## How are they different from x402 and MPP?

| | What it solves | Who is behind it | What it pays with |
| --- | --- | --- | --- |
| ACP | Checkout inside ChatGPT | OpenAI and Stripe | A card turned into a token by the store's processor |
| UCP | The shopping journey, discovered at `/.well-known/ucp` | Google with Shopify, Etsy, Wayfair, Target and Walmart | Whatever payment handler the store declares, like Google Pay |
| AP2 | Signed proof that the person approved | Google, now at the FIDO Alliance | Card, bank transfer or stablecoin |
| x402 and MPP | Charging per HTTP request with a 402 | Coinbase and the x402 Foundation, Stripe and Tempo | Stablecoins, and with MPP also cards |

ACP, UCP and AP2 are designed for purchases with a cart, shipping and a person making the decision, while x402 and MPP charge per use for an API or digital content, without a cart. The two 402 protocols have their own guides: [what is x402](https://usepeaje.com/blog/what-is-x402-and-how-does-an-ai-agent-pay-with-http-402) and [what is MPP](https://usepeaje.com/blog/what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo).

## Which one does my store need and what does Peaje do with each?

- **You sell products on Shopify, Etsy or another platform:** check your platform's settings before building anything, because ACP and UCP depend on your catalog, your checkout and your processor.
- **You run your own store and charge with Stripe:** [Stripe's agentic commerce guide](https://docs.stripe.com/agentic-commerce) is the starting point, with ACP's Shared Payment Token and a section on UCP.
- **You sell access to an API, data or content per use:** the path is the 402, and we explain it in [how do I charge AI agents for using my API](https://usepeaje.com/blog/how-do-i-charge-ai-agents-for-using-my-api).

Peaje's free kit serves the UCP and ACP routes on your domain, connected to stablecoin payment over 402 and without cards:

- **`/.well-known/ucp`:** a UCP profile with the REST service at `/checkout_sessions` and the MCP server, the checkout capability, the AP2 mandates extension and a payment handler whose instruments are USDC on Arbitrum and pathUSD on Tempo, plus the public key to verify signatures.
- **`POST /checkout_sessions`:** builds a cart with your priced links and returns it ready to pay (`ready_for_payment`) and signed, with one payment URL per line that answers 402. The session expires after 15 minutes, and Peaje does not implement completing or canceling the session, because payment happens at each URL.
- **`POST /agentic_commerce/delegate_payment`:** answers with the ACP error `unsupported_payment_method`, does not receive or store card data and tells the agent to pay over the 402.

Peaje does not process ACP card purchases, does not enroll you in ChatGPT's Instant Checkout or Google's checkout, and today it does not verify AP2 mandates an agent brings. What it does is let an agent that speaks ACP or UCP find your priced links and reach a payment that works, instead of a 404. The [free radar](https://usepeaje.com/radar) checks in its payments layer whether your site answers ACP, UCP, AP2, x402 and MPP, and the full list of what an agent looks at before buying from you is in [what does my store need so an AI agent can buy from it](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it).

## Sources

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [ACP on GitHub: checkout and delegated payment specs](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe: Instant Checkout in ChatGPT and the Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- [OpenAI: commerce documentation](https://developers.openai.com/commerce/)
- [Google: Universal Commerce Protocol announcement](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
- [Google Developers: under the hood of UCP](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [Universal Commerce Protocol](https://ucp.dev)
- [Google Cloud: AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Agent Payments Protocol](https://ap2-protocol.org/)
- [Google: donating AP2 to the FIDO Alliance](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/)
- [Peaje free radar](https://usepeaje.com/radar)
