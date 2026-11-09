---
title: "How does an AI shopping agent choose which business to buy from?"
description: What an AI agent looks at when it decides where to buy (description, price and availability in text, third-party signals and a way to pay) and how to check whether it would pick you.
date: 2026-11-07
slug: how-does-an-ai-shopping-agent-choose-which-business-to-buy-from
lang: en
categoria: Guide
portada: 3
portada_titulo: How an agent chooses
traduccion: como-elige-un-agente-de-ia-comprador-a-que-negocio-comprarle
---

# How does an AI shopping agent choose which business to buy from?

A shopping agent chooses by reading text: it looks for businesses whose description matches what it was asked for, compares the price and availability it can read without guessing, checks the signals others leave behind (reviews, usage, reputation) and drops anyone it cannot pay. If your description is vague or your price cannot be read, the agent never gets to compare you, and if the payment step fails, it picks someone else even when you were the best option.

Updated: November 2026

On November 7, 2026, the x402 Bazaar, Coinbase's catalog of services that charge per request, listed 34,115 services, according to its [public discovery API](https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources). An agent buying data or services chooses among all of them in seconds, and the only thing it has to decide with is what each service says about itself.

## What does the agent need to be able to read?

There are two kinds of shopping agent today: assistants that buy products for a person, like shopping inside ChatGPT, and agents with a wallet that buy data or services per request. Both read the same things, in different formats:

| What it checks | Assistant buying products | Agent buying data or services |
| --- | --- | --- |
| What you sell | Product name and description | The description of each route: what it returns, with what data and in what format |
| Price | The price in your product feed and on the page (JSON-LD with Offer) | The per-request price in your agent files and in the 402 response |
| Availability | In stock, pre-order or out of stock | That the route answers when called |
| Third-party signals | Review count and star rating | Recent usage and reputation in public registries |
| Payment | A checkout the agent knows how to complete (ACP or UCP) | A 402 with x402 or MPP |

For products, [OpenAI's product feed specification](https://developers.openai.com/commerce/specs/feed) makes price and availability required fields, rejects the row when availability is missing or unrecognized, and says that meeting the requirements does not guarantee your product will be shown. For services, Coinbase says that search in the [Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) takes into account how complete the description, the output schema and the service metadata are.

If your price only shows up after a script loads or behind a login, many agents never see it. The full list of what a store needs is in [what does my store need so an AI agent can buy from it](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it).

## What matters more, price or description?

Every agent decides differently and almost none publish their criteria, so the most concrete example we can give you is Peaje's own buying agent, whose code we know. This is how it decides:

1. **Relevance first.** Each word of the request that shows up in the service's name, description or tags adds more than any price difference.
2. **Price second.** Anything above the per-request budget is out, and among the rest, the cheaper one adds a little more.
3. **One option per provider.** Three routes from the same business count as one on the short list.
4. **A final veto.** Before paying, a model checks whether buying that service delivers the data the request asks for, and it drops documentation, demos and informational pages even when they cover the topic.

In practice, a description like "Forecast endpoint" leaves you out before your price matters, while "Hourly rain forecast for the next 30 days for a city in Colombia, in JSON" gives the agent the words it is going to search for.

## Do reviews and what others say about you count?

Yes, and each kind of agent reads them in a different place:

- **Products:** OpenAI's feed accepts review count and star rating as optional fields.
- **Per-request services:** the Bazaar shows how many times each service was called and how many unique payers it had over the last 30 days.
- **Agents and services with their own identity:** [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), a proposed Ethereum standard that is still a draft, defines an identity registry and a reputation registry where those who used you leave their rating. Peaje's agent adds that reputation when the service is registered.

You do not fully control any of these signals. What is in your hands is that your data is true and says the same thing on your page, in your feed and in your agent files, because a different price in each place makes any agent hesitate ([why AI sometimes gets your business wrong](https://usepeaje.com/blog/why-does-chatgpt-get-my-business-wrong-and-how-do-i-fix-it)).

## What happens if the agent cannot pay you?

It picks someone else, even if it found you first. If you sell physical products, payment almost always comes through your store platform's commerce protocols (ACP in ChatGPT, UCP at Google). If you sell data, API access or content per use, the agent expects a `402 Payment Required` response that tells it how much it costs and how to pay, and since each agent speaks x402 or MPP, it makes sense to answer with both in the same 402 ([what the 402 carries](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying)). A 402 without the payment headers, or with an amount that differs from the price you published, makes a strict client stop right there.

## How do I know if an agent would pick me?

Peaje's mystery shopper (Pro plan, 30 credits per test) checks it with the same buying agent described above, and it never pays:

1. A model writes three realistic requests your business should win with what you sell, without your name or your domain.
2. For each request, the agent searches Peaje's directory, the x402 Bazaar and the ERC-8004 registry, and notes whether it found you, in what position, whether it would buy from you and, if not, whom it picked (with its domain and price) and why: your price is above the US$0.10 per-request cap the test uses, your description lacks the words it searched for, the other one is cheaper or its description fits better.
3. Then it requests your priced URL without paying, on your domain and on Peaje's gateway, and checks what a strict client checks: that it answers 402, that it carries the x402 version 2 `PAYMENT-REQUIRED` header and the MPP `WWW-Authenticate: Payment` challenge, that each payment option has an amount, token, recipient and network, that the amount matches your price, that the payment names your domain and that the description says more than the route path.

Whatever you can fix is left as a task, and the task closes on its own when the next test no longer sees the problem. You can repeat it every 6 hours. To test anything, you need at least one priced route or link, and if you have none, the mystery shopper tells you so and does not search.

It has one limit worth knowing: it simulates agents that buy APIs and links per request, and it does not simulate ChatGPT buying a physical product in your store. For that, the [free radar](https://usepeaje.com/radar) tells you whether your prices can be read without JavaScript, whether you have JSON-LD and whether you accept any commerce protocol. What goes wrong on the agents' own side when they shop is covered in [why do AI shopping agents fail almost half the time](https://usepeaje.com/blog/why-do-ai-shopping-agents-fail-almost-half-the-time).

## Sources

- [OpenAI: product feed specification](https://developers.openai.com/commerce/specs/feed)
- [Coinbase Developer Platform: x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
- [x402 Bazaar discovery API](https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources)
- [ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [Peaje: what the 500 monthly credits include](https://usepeaje.com/blog/how-much-does-peaje-cost-and-what-do-the-500-monthly-credits-include)
- [Peaje free radar](https://usepeaje.com/radar)
