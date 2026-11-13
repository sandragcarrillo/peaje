---
title: "How do I test that an AI agent can pay my API before launch?"
description: Three tests in order to know whether an AI agent can pay your API before you open it, checking the 402 with curl, running Peaje's mystery shopper and making a real payment of a few cents with your own wallet.
date: 2026-11-13
slug: how-do-i-test-that-an-ai-agent-can-pay-my-api-before-launch
lang: en
categoria: Guide
portada: 1
portada_titulo: Test your payments
traduccion: como-pruebo-que-un-agente-de-ia-puede-pagarle-a-mi-api-antes-de-lanzarla
---

# How do I test that an AI agent can pay my API before launch?

You test it in three steps, from cheapest to most complete: you request your route with `curl` to see that it answers 402 with the payment offers, you run Peaje's mystery shopper to see whether an agent finds you and whether your payment step passes a strict client, and you make a small real payment from a wallet of your own. Peaje has no test network in production, so that last step moves real money, even if it is only cents.

Updated: November 2026

With a US$0.01 route on Arbitrum, the test costs you at most US$0.0202: you pay the price plus a network cost that never goes above US$0.02, and 98% of the price comes back to your payout wallet. Both limits are set in [Peaje's contract on Arbitrum](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020), which fixes the fee at 200 basis points (2%) and the maximum network cost at 0.02 USDC per payment.

## How do I check the 402 by hand?

Before the first test, get three things ready:

- **Your payout wallet,** chosen in Revenue. Without it your routes answer 503 instead of 402, because the 98% has nowhere to go.
- **Payments turned on.** They start turned off, and while they are off, your priced routes answer for free and there is no 402 to test. You turn them on in Revenue with "Turn on payments", and they apply to all your priced routes and links at once, so from that moment any agent that arrives pays too.
- **The kit on your domain,** with `PEAJE_ORIGIN_SECRET` in your hosting's environment variables, as we explain in [how do I charge AI agents for using my API](https://usepeaje.com/blog/how-do-i-charge-ai-agents-for-using-my-api).

If you want the whole thing to stay cheap, publish a route priced at US$0.01 just for the test. Then request the route twice without paying, on your domain and on Peaje's gateway, which is where the charge goes through even though the agent does not see it:

```bash
curl -i https://yourdomain.com/api/forecast/bogota
curl -i https://api.usepeaje.com/<your-slug>/api/forecast/bogota
```

Both should show the same thing:

| What you look at | What it should say |
| --- | --- |
| Status | `402` |
| `content-type` | `application/problem+json`, with a body that explains what is missing |
| `cache-control` | `no-store` |
| `www-authenticate` | One `Payment` offer per network, in MPP format |
| `payment-required` | The offer in x402 format, as base64-encoded JSON |

If the gateway answers 402 and your domain does not, the problem is on your site: the proxy is not passing that route to Peaje, or a CDN or middleware is stripping the payment headers. When you decode `payment-required`, check two things strict x402 clients compare: that `x402Version` is 2 and that `resource.url` names your domain and not Peaje's. What each header carries is in [what is 402 Payment Required](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying).

## What does the mystery shopper add?

It tells you what `curl` cannot: whether an agent would find you and whether it would pick you. It is part of the Pro plan, costs 30 credits, and you run it from My agent with "Test now" or by asking the agent in the chat. It gets three jobs your business should win, searches the Peaje directory, the x402 Bazaar and the ERC-8004 registries, and notes whether it found you, in what position, whom it picked and why. Then it requests your first priced GET route (or your first link, if you have no routes) without paying, on your domain and on the gateway, and checks it the way a strict client does. It needs at least one priced route or link, and how it decides is in [how does an AI shopping agent choose which business to buy from](https://usepeaje.com/blog/how-does-an-ai-shopping-agent-choose-which-business-to-buy-from).

Before launch it helps for three reasons:

- It separates your side from Peaje's. What you can fix on your site is left as a task, which closes on its own when the next test no longer sees the problem, and what belongs to the gateway is marked "On Peaje's side, nothing for you to do".
- Its requests do not count in Agent visits, so they do not inflate your payment funnel.
- If the test fails, or you ask for it before 6 hours have passed since the last one, you get the credits back.

It has one limit worth knowing: it never pays, so it does not prove the money reaches your wallet. That is what the next step is for.

## How do I make a real test payment?

You pay, the way an agent would, from a wallet other than your payout wallet. Peaje's gateway runs on mainnet, as its [public status](https://api.usepeaje.com/health) shows, so you need USDC on Arbitrum One or pathUSD on Tempo. On Arbitrum you do not need ETH for gas, because you sign an authorization for the price plus the network cost and Peaje sends the transaction. On Tempo you pay the gas in your own transaction.

To pay, use an official client instead of building the headers by hand:

- **MPP:** `mppx`, the library from [mpp.dev](https://mpp.dev/quickstart/client), with payment methods for Tempo and for EVM networks. It is the one Peaje uses in its own buying scripts.
- **x402:** `@x402/fetch` (or `@x402/axios`) together with `@x402/evm`, the packages in the [x402 buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers), which pay the `payment-required` offer.

With the client set up, you request the route as you would with any `fetch`: the client gets the 402, pays and repeats the request. If it works, you get a 200 with your API's response and a receipt with the network and the transaction. Each agent speaks one of the two protocols, so test with the client the agent you expect will use, or with both if you do not know.

Then check your dashboard:

- **Agent visits:** your payment shows up as "MPP client" or "x402 client", depending on the client you used, and the "Payment funnel" shows your request under "402 served", "came back to pay" and "paid". Your `curl` calls also count as 402s served, and the mystery shopper's tests do not.
- **Revenue:** the payment with the date, the route, the network, the net amount and the "view tx" link to the transaction. The net is 98% of the price, and the network cost does not come out of it ([how much Peaje keeps](https://usepeaje.com/blog/how-much-does-peaje-keep-from-each-ai-agent-payment)).

## What do the errors I might see mean?

The body of each error has a `code` field that tells you what happened:

| What you get | What happened | What you do |
| --- | --- | --- |
| Your normal response, no 402 | Payments are off, or your domain is not passing the route to Peaje | Turn on payments in Revenue, or compare with the gateway's answer |
| 503 with `no-payout-address` | The business has no payout wallet | Choose the wallet in Revenue |
| 503 with `origin-paused` | Your server failed 3 times in 10 minutes and Peaje stopped charging for 15 | Check your server, Peaje lets you know by email or Telegram |
| 503 with `settlement-pending` | The payment was sent and is still confirming | Do not pay again: repeat the same request with the same credential in a minute |
| A 5xx with the `x-peaje-payment: not-charged` header | Your server failed, or the payment could not be settled, and nothing was charged | Fix the origin and test with a new payment |
| 409 with `authorization-used` | The payment authorization had already been used | Pay with a new authorization |
| Another 402 after paying | The credential did not pass verification, and the body says why | Request the 402 again, because each offer expires after 5 minutes |

If your server fails after a payment on Tempo, Peaje refunds the agent, as we explain in [what is 402 Payment Required](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying).

## Sources

- [Peaje's contract on Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Peaje gateway status](https://api.usepeaje.com/health)
- [x402: quickstart for buyers](https://docs.x402.org/getting-started/quickstart-for-buyers)
- [mpp.dev: client quickstart](https://mpp.dev/quickstart/client)
- [mpp.dev: EVM payment method](https://mpp.dev/payment-methods/evm)
- [Peaje pricing](https://usepeaje.com/precios)
