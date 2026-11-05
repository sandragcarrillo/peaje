---
title: "How do I charge AI bots that read my content?"
description: The two ways to charge AI bots and agents today (Cloudflare's pay per crawl and HTTP 402 payments with x402 and MPP), how they differ and what is better left free.
date: 2026-11-03
slug: how-do-i-charge-ai-bots-that-read-my-content
lang: en
categoria: Guide
portada: 4
portada_titulo: Charging the bots
traduccion: como-les-cobro-a-los-bots-de-ia-que-leen-mi-contenido
---

# How do I charge AI bots that read my content?

There are two ways today, and both use the `402 Payment Required` response. With Cloudflare's pay per crawl you set one price per request for your whole site and Cloudflare charges the bots that registered with it. With x402 and MPP you put a price on a link or a route and the agent pays you directly, in digital dollars, with no account or registration. Before charging, keep open the pages you want AI to cite, because a bot that does not pay does not cite you either.

Updated: November 2026

With Peaje, putting a price on a link is free and you keep 98% of each payment, which reaches your wallet in the same transaction, according to the [pricing page](https://usepeaje.com/precios).

## How do the two ways differ?

| | Cloudflare's pay per crawl | x402 and MPP with Peaje |
| --- | --- | --- |
| Who offers it | Cloudflare, announced in July 2025 as a private beta | Peaje, with priced links and routes |
| What you charge | One price per request across your whole site | A price for each link or route you choose |
| Who can pay | Bots that registered with Cloudflare and sign their requests | Any agent with a wallet that speaks x402 or MPP |
| How the money reaches you | Cloudflare charges them and pays out what it collected | USDC on Arbitrum or pathUSD on Tempo, straight to your wallet, minus 2% |
| What you need | Your site on Cloudflare | A free Peaje account |

With pay per crawl, besides charging, you can let a bot in for free or block it, one by one ([Cloudflare's announcement](https://blog.cloudflare.com/introducing-pay-per-crawl/)). Since July 2025, Cloudflare also asks new domains whether they want to let AI crawlers in, so if your site is there, check what you chose.

## What is better left free?

It is better not to charge for the pages you want to be recommended for. A search bot that gets a 402 and does not pay leaves without reading anything, the same as if you blocked it, and a page it does not read is a page it cannot cite. That is why the order we recommend is: your public pages open to the bots that cite ([which ones they are](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)), and a price only on what you actually sell, like a report, a PDF, a dataset or a call to your API.

If what bothers you is models being trained on your content, you can solve that without charging: you can block training bots in your robots.txt and let search bots in. Peaje's kit has that option, which blocks GPTBot, ClaudeBot, Google-Extended, Applebot-Extended and CCBot without touching the ones that cite.

## How do I put a price on a link with Peaje?

1. Register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo).
2. In your dashboard, go to Routes, paste the public URL of what you want to charge for and set a price in dollars. You can also import your sitemap and pick which pages to charge for.
3. The link lives at `api.usepeaje.com/your-business/r/the-link`, and with the kit installed, on your own domain. It shows up in your llms.txt, your openapi.json and your MCP server so agents can find it.
4. Go to Revenue and tap "Turn on payments". While they are off, agents use your priced links for free.

Your original page stays as it is: the priced link is a separate door for agents that want what you sell.

## What does an agent see when it reaches a priced link?

It gets a 402 with an offer for each network where it can pay, in both formats, x402 and MPP. It pays from its wallet, repeats the request with the payment and gets the content along with a receipt. If it does not pay, it gets nothing. We go step by step in [how does an AI agent pay my website](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go), and through the difference between the two formats in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use).

## How much should I charge?

It depends on what you sell and how much it saves the agent. To start, put a low price on a single thing, watch in "Agent visits" who asks for it and in Revenue how many pay, and adjust. If you set the price to 0, the link stays free, which works for a sample.

## Sources

- [Cloudflare: Introducing pay per crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- [Cloudflare: AI crawlers blocked by default](https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/)
- [x402](https://www.x402.org/)
- [Peaje pricing](https://usepeaje.com/precios)
