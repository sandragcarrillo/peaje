---
title: "How do I charge AI agents for using my API?"
description: The steps to charge AI agents for each call to your API, with no keys or sign-up, using the 402 response, x402 and MPP, from publishing the route to seeing the first payment.
date: 2026-11-05
slug: how-do-i-charge-ai-agents-for-using-my-api
lang: en
categoria: Guide
portada: 4
portada_titulo: Charging for your API
traduccion: como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api
---

# How do I charge AI agents for using my API?

You put a price on each route of your API, and your server answers `402 Payment Required` to an agent that arrives without paying, with the price and the payment options. The agent pays from its wallet, repeats the call with the payment and gets the response, with no API key or sign-up. With Peaje you do it from your dashboard: you publish the route, install the kit on your site and turn on payments.

Updated: November 2026

Publishing priced routes is free on every plan, and Peaje keeps 2% of each payment, which reaches your business wallet in the same transaction, according to the [pricing page](https://usepeaje.com/precios).

## What do I need before starting?

- **An API that already responds.** Peaje does not replace it: it sits in front, charges and passes the call to your server.
- **Your site registered on Peaje,** at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), with no card. When you register, Peaje creates the wallet where payments land.
- **The kit installed,** so the 402 goes out on your own domain ([how to install it](https://usepeaje.com/blog/how-do-i-install-the-peaje-kit-in-my-project-with-one-command)).

## How do I publish a priced route?

1. In your dashboard, go to Routes, under payments.
2. Enter the method and the path, for example `GET /api/forecast/:city`.
3. Write a description for an agent that does not know your business: what it returns, in what format and an example.
4. Set the price in dollars, greater than 0, with up to 6 decimals.
5. Publish the route.

The route goes straight into your `openapi.json`, your `llms.txt`, your `/developers` page and your MCP server, where it shows up as a priced tool. That is how agents find it ([how they find you](https://usepeaje.com/blog/how-do-ai-agents-find-my-api)).

## What do I change on my server?

Almost nothing: the kit adds the step that charges before the call reaches your API, and it leaves you one manual step, adding `PEAJE_ORIGIN_SECRET` to your hosting's environment variables. You copy it from the kit page. That secret proves to your server that the call comes from Peaje after the payment, and without it your priced routes are not charged on your domain.

## How do I test that it charges?

Call the route without paying and look at the response:

```bash
curl -i https://yourdomain.com/api/forecast/bogota
```

You should see a `402` with two `www-authenticate: Payment` headers (MPP, one per network) and one `payment-required` header (x402). What each one carries is in [what is 402 Payment Required](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying). If you see your API's normal response, check that payments are turned on and that `PEAJE_ORIGIN_SECRET` is set on your hosting.

## How do I turn on payments?

They start turned off, and while they are off, agents use your priced routes for free, which helps you see which ones they ask for before charging. Go to Revenue and tap "Turn on payments". From there you see each payment with the date, the route, the network, what reached you and the transaction, and in "Agent visits" you see the funnel: how many 402s you served, how many agents came back with a payment and how many paid.

Agents pay with USDC on Arbitrum or pathUSD on Tempo, and you receive 98% of the price. On Arbitrum, if your API fails, the agent does not pay, because Peaje asks your server for the response before charging.

## Which routes do I charge for?

The ones that deliver something only you have or that costs you to produce, and you leave free the ones that help agents find and try you. We go into it with examples in [which API routes should I charge for and which should I leave free](https://usepeaje.com/blog/which-api-routes-should-i-charge-for-and-which-should-i-leave-free).

## Sources

- [Peaje pricing](https://usepeaje.com/precios)
- [How does an AI agent pay my website and where does the money go?](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go)
- [x402](https://www.x402.org/)
- [mpp.dev: protocol overview](https://mpp.dev/overview)
