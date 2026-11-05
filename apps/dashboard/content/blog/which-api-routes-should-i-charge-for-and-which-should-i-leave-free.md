---
title: "Which API routes should I charge for and which should I leave free?"
description: How to decide which endpoints of your API to charge AI agents for and which to leave open, with a simple rule, examples by type of route and how to adjust the price later.
date: 2026-11-05
slug: which-api-routes-should-i-charge-for-and-which-should-i-leave-free
lang: en
categoria: Guide
portada: 4
portada_titulo: Which routes to charge
traduccion: que-rutas-de-mi-api-conviene-cobrar-y-cuales-dejar-gratis
---

# Which API routes should I charge for and which should I leave free?

Charge for the routes that save the agent work with something only you have, like your own data, a calculation or a report, and leave free the ones that help it find you and decide, like your catalog, your prices and your documentation. If you charge at the front door, the agent leaves before it knows what you sell, and if you give away what is valuable, you have nothing to charge for. A short rule: free for what makes you visible, priced for what costs you to produce or nobody else has.

Updated: November 2026

With Peaje you can test this without risk: putting a price on a route is free, a route priced at 0 stays open and Peaje only keeps 2% of each payment you receive, according to the [pricing page](https://usepeaje.com/precios).

## What do I leave free?

What an agent needs to understand what you offer and whether it is useful:

- **Your catalog and your prices.** If the agent cannot see them, it cannot recommend you or compare you.
- **Documentation and examples.** That is what it reads to decide whether to pay and how to call you.
- **A sample.** An example result, trimmed or with old data, so the agent knows what it gets before paying.
- **The pages you want to be cited for.** A search bot that gets a 402 does not pay, leaves without reading and cannot cite you ([more on this](https://usepeaje.com/blog/how-do-i-charge-ai-bots-that-read-my-content)).

## What do I charge for?

What has value on its own and saves work for whoever asks for it:

- **Your own data, or data that is hard to gather,** like current prices in a market, live inventory or a history.
- **Calculations or processes,** like a quote, a conversion, an analysis or a validation.
- **Full reports and files,** like a PDF, a dataset or a report you sell to people today.
- **Routes that cost you money,** because they call another paid service or use a lot of server.

## What does it look like with an example?

A weather API for farmers could look like this:

| Route | What it returns | Price |
| --- | --- | --- |
| `GET /api/cities` | The cities with data | Free |
| `GET /api/forecast/:city/today` | Today's forecast | Free, as a sample |
| `GET /api/forecast/:city/30-days` | The 30-day forecast with hourly rain | Priced |
| `GET /api/report/:farm` | A risk report for a farm | Priced, higher |

The first two let the agent find you and try you, and the last two are what you sell.

## How much do I charge?

There is no standard price yet, so start low on a single route and watch what happens. As a reference for the math: with Peaje, a US$0.05 route leaves you US$0.049 per payment, and on Arbitrum the agent pays the network cost separately, which today is around one cent. Check in "Agent visits" who asks for the route and in Revenue how many pay, and raise the price if almost everyone pays or lower it if almost nobody does.

Write each route's description for an agent that does not know your business: what it returns, in what format and an example. That is what it reads to decide whether to pay.

## Can I change my mind later?

Yes, in Peaje you change a route's price, set it to 0 or remove it whenever you want, and the change goes into your `openapi.json`, your `llms.txt` and your MCP server. Payments also start turned off: until you tap "Turn on payments" in Revenue, agents use your priced routes for free, which helps you see which ones they ask for before charging. How to create a priced route, step by step, is in [how do I charge AI agents for using my API](https://usepeaje.com/blog/how-do-i-charge-ai-agents-for-using-my-api).

## Sources

- [Peaje pricing](https://usepeaje.com/precios)
- [How does an AI agent pay my website and where does the money go?](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go)
- [x402](https://www.x402.org/)
- [mpp.dev](https://mpp.dev/overview)
