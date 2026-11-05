---
title: "What is 402 Payment Required and what happens when an agent asks without paying?"
description: What the HTTP 402 response means, why it sat reserved for almost 30 years, how x402 and MPP use it today to charge AI agents and what an agent gets when it arrives without paying.
date: 2026-11-05
slug: what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying
lang: en
categoria: Guide
portada: 4
portada_titulo: The 402 code
traduccion: que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar
---

# What is 402 Payment Required and what happens when an agent asks without paying?

402 Payment Required is the HTTP response that says "this costs money, pay first". It sat reserved with no defined use since the early web standards, and today x402 and MPP use it so an AI agent can pay for a resource with no account or API key. If an agent asks for something priced without paying, it gets the 402 with the price and the payment options, and nothing else: the content only goes out when it repeats the request with a valid payment.

Updated: November 2026

According to [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402), 402 is still a nonstandard code "reserved for future use", and browsers display it as a generic 4xx error. That is why a 402 is useful to an agent and not to a person browsing.

## Why did it go unused for so many years?

The authors of HTTP reserved it with digital cash and micropayments in mind, but never defined how payment would work. With no common format, each site charged through its own checkout and its own sign-up, and the 402 stayed empty. AI agents changed that, because an agent cannot fill in a card form, but it can read a price in a header and sign a payment with a wallet.

## How do x402 and MPP use it today?

Both follow the same cycle:

1. The agent requests the resource.
2. The site answers 402 with the price, the currency and where the payment goes.
3. The agent pays and repeats the request with proof of payment.
4. The site verifies the payment and delivers the resource with a receipt.

The difference is in the headers. MPP puts each offer in `WWW-Authenticate: Payment` and the agent comes back with `Authorization: Payment`, while x402 uses `PAYMENT-REQUIRED` and the agent comes back with `PAYMENT-SIGNATURE`. We compare them in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use), and MPP has its own guide in [what is MPP](https://usepeaje.com/blog/what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo).

## What does an agent get when it arrives without paying?

With Peaje, a priced route or link answers like this (values trimmed):

```
HTTP/2 402
content-type: application/problem+json
cache-control: no-store
www-authenticate: Payment id="…", realm="…", method="evm", intent="charge", request="…", expires="…"
www-authenticate: Payment id="…", realm="…", method="tempo", intent="charge", request="…", expires="…"
payment-required: …

{"type":"https://paymentauth.org/problems/payment-required","title":"Payment Required","status":402,"detail":"Payment is required (Report 2026).", …}
```

- There is one `WWW-Authenticate` offer per network: USDC on Arbitrum and pathUSD on Tempo.
- `payment-required` carries the Arbitrum offer in x402 format.
- Each offer expires after 5 minutes, and `cache-control: no-store` keeps intermediaries from storing the response.
- The body explains in text what is missing, for an agent that cannot read payment headers.

The content never goes out: without a payment, the agent is left with the 402.

## What if the payment fails or my site goes down?

There are cases where the answer is not a 402:

| Case | What the agent gets |
| --- | --- |
| Payments are turned off | The content for free, with no 402 |
| Your site fails three times in ten minutes | A 503 for fifteen minutes, and we let you know |
| Your site fails after a payment on Arbitrum | Nothing to refund, because Peaje asks your site for the response before charging |
| Your site fails after a payment on Tempo | A refund of the payment, with its transaction in the `Payment-Refund` header |

When the payment goes through, the agent gets a 200 with the content and a receipt in the `Payment-Receipt` header, with the network and the transaction.

## How do I know whether agents pay after the 402?

In Peaje, the "Agent visits" page has a "Payment funnel" with three numbers: the 402s served, how many agents came back with a payment and how many paid. If almost none come back, the agent most likely did not understand the offer, because of a confusing description or a header it cannot read. If they come back with a payment that does not complete, check the network and the currency you offer, since the agent already understood the price. Priced routes are free on every plan, and Peaje keeps 2% of each payment, according to the [pricing page](https://usepeaje.com/precios).

## Sources

- [MDN: 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402)
- [RFC 9110: HTTP Semantics, 402](https://httpwg.org/specs/rfc9110.html#status.402)
- [x402](https://www.x402.org/)
- [mpp.dev: protocol overview](https://mpp.dev/overview)
- [Peaje pricing](https://usepeaje.com/precios)
