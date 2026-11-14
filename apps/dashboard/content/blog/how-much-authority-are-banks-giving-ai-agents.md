---
title: "How much authority are banks giving AI agents?"
description: Why JPMorgan, Citi, Bank of America, Schwab and Wells Fargo limited outside AI agents, how Lead Bank, Cross River and Increase gave agents their own money instead, and what it means for sites that agents pay.
date: 2026-11-13
slug: how-much-authority-are-banks-giving-ai-agents
lang: en
categoria: News
portada: 4
portada_titulo: Banks and AI agents
traduccion: cuanta-autoridad-les-dan-los-bancos-a-los-agentes-de-ia
---

# How much authority are banks giving AI agents?

In less than a month, US banks split over one question: when a customer's AI agent shows up at the account, how much is it allowed to do? The biggest banks said outside agents can't move money from inside the customer's account, and a group of smaller banks gave agents an account or a card of their own, with limits the bank enforces.

Updated: November 2026

Between October 13 and 16, 2026, JPMorgan, Bank of America, Citi and Charles Schwab said they limit outside agents, according to [PYMNTS](https://www.pymnts.com/?p=4326961). Schwab's CEO said the firm blocks unauthorized agents, Meta's Muse among them, "in the tens and 20s" every week.

## What did the big banks decide?

Each one said it differently, and all four stop an outside agent from moving the customer's money on its own:

| Bank | What it said | What an agent can still do |
| --- | --- | --- |
| JPMorgan | Agents can't send money or pay bills (Jamie Dimon, October 13 earnings call) | See balances if the customer authorizes a connector like Plaid |
| Bank of America | It limits agent access to deposits and requires a human to approve money leaving an account (Brian Moynihan, October 14) | The bank says it is working on rules for how agents can interact with accounts |
| Citi | Third-party agents can't log into a customer's account | Authorized open banking providers can read account data, read-only |
| Charles Schwab | It blocks unauthorized agents and wants clients to use its own assistant, Charley, instead of handing their password to another one | It will build MCP servers so the client's chosen model can check balances and do research under Schwab's rules |

Wells Fargo went a step further with its contract. Starting November 24, a customer stays liable for what their AI agent does, even after telling it to stop, unless they can prove they revoked its access, [American Banker reported](https://www.americanbanker.com/news/wells-fargo-wants-customers-to-prove-theyve-revoked-ai-agents) on November 2.

## How did the smaller banks give agents their own money?

The banks that said yes didn't open the customer's account to agents. They gave each agent or each task a separate account or card, so the most an agent can spend is what was put there.

| Bank | What the agent gets | Where the limit lives |
| --- | --- | --- |
| [Lead Bank](https://www.lead.bank/blog/moving-money-with-agents) | Its own account number for each task, paying only approved counterparties | Daily and monthly program limits and the balance, checked by the bank in real time; the account number is cancelled when the task ends |
| [Cross River](https://www.crossriver.com/newsroom/cross-river-expands-stripe-issuing-partnership-to-help-power-agentic-commerce) | Through Stripe's Link agent wallet, a single-use virtual card for each purchase | The card is scoped to one transaction, and the agent never sees the customer's payment details |
| [Increase](https://www.thespl.it/p/why-stripes-1st-employee-just-bought) | Founder Darragh Buckley says his agents have their own bank account | The balance: agents spend what's in the account and ask him for more |

Fintechs are moving too. On November 5, [American Banker](https://www.americanbanker.com/payments/news/chime-puts-out-the-welcome-mat-for-external-ai-agents) reported that Chime is getting ready to let customers bring their own agent, alongside Jade, its in-house assistant.

The three banks share a thread: all of them connect back to Stripe. Cross River powers Stripe's card issuing for agents, Lead Bank [issues the Link prepaid debit card](https://stripe.com/legal/consumer/cardholder-agreements), and Increase was founded in 2020 by Buckley, Stripe's first employee, who then bought a small Washington State bank and renamed it Increase Bank. For now, the layer that gives agents money in the US is being built mostly around one company and the banks that serve it.

## What do both camps agree on?

Read side by side, the two camps are converging on the same rule: an agent can touch money only with authority that has a limit, can be revoked and leaves a trace.

- **With a limit:** a budget, a list of counterparties or a single-use card caps what can go wrong, and the bank enforces it, outside the agent's prompt.
- **Revocable:** the account or card can be shut off when the task ends, without changing the customer's password.
- **Traceable:** every payment comes from a credential tied to one agent, so the record shows which agent did what.

The big banks still let an agent read balances with the customer's permission. What they stopped is an agent getting into the account with the customer's credentials and moving money from there, and the smaller banks shipped the alternative first.

## What does this mean for sites that agents pay?

An agent with its own budget is the kind of buyer that can [pay a website per request](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go). A shared password could never do that safely, and a card can't do it cheaply: Stripe's [minimum charge](https://docs.stripe.com/currencies) in US dollars is US$0.50, more than most single requests are worth. An account that holds [stablecoins like USDC](https://usepeaje.com/blog/why-do-ai-agents-pay-with-stablecoins-like-usdc) can pay a few cents per request.

That is the side Peaje builds for. Before an agent can pay a site, it has to find it and read it, and Peaje sets up a site so agents can do both. If the business turns on charging, a priced route on its own domain answers `402 Payment Required` with an offer in [x402](https://usepeaje.com/blog/what-is-x402-and-how-does-an-ai-agent-pay-with-http-402) and in [MPP](https://usepeaje.com/blog/what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo). The agent pays in USDC on Arbitrum or pathUSD on Tempo and gets what it asked for.

- 98% of each payment reaches the business's wallet in the same transaction, and [Peaje keeps 2%](https://usepeaje.com/blog/how-much-does-peaje-keep-from-each-ai-agent-payment). Peaje holds no balances.
- On Arbitrum, if the business's site fails, the agent doesn't pay, because Peaje asks the site for the response before charging.
- On Tempo the agent has already paid, so if the site fails Peaje refunds it from its own account, within limits.

It's early. Agent payments on the open web are still small, and today what mostly decides whether an agent uses a site is [whether it can find and read it](https://usepeaje.com/blog/is-there-a-free-tool-to-check-if-ai-can-read-my-website). That's why Peaje starts with discovery and leaves charging as a choice each business makes. You can see what an agent finds on your site with the [free radar](https://usepeaje.com/radar): it only asks for your email and your domain, and it takes less than a minute.

## Sources

- [PYMNTS: big banks won't let outside AI agents move money](https://www.pymnts.com/?p=4326961), October 19, 2026
- [American Banker: Wells Fargo wants customers to prove they've revoked AI agents](https://www.americanbanker.com/news/wells-fargo-wants-customers-to-prove-theyve-revoked-ai-agents), November 2, 2026
- [Lead Bank: moving money with agents](https://www.lead.bank/blog/moving-money-with-agents), September 29, 2026
- [Cross River expands Stripe Issuing partnership to help power agentic commerce](https://www.crossriver.com/newsroom/cross-river-expands-stripe-issuing-partnership-to-help-power-agentic-commerce), July 1, 2026
- [The Split: why Stripe's first employee just bought a bank](https://www.thespl.it/p/why-stripes-1st-employee-just-bought), interview with Darragh Buckley, October 15, 2026
- [American Banker: Chime puts out the welcome mat for external AI agents](https://www.americanbanker.com/payments/news/chime-puts-out-the-welcome-mat-for-external-ai-agents), November 5, 2026
- [Stripe: cardholder agreements (Link prepaid debit card, Lead Bank)](https://stripe.com/legal/consumer/cardholder-agreements)
- [Stripe: minimum charge amounts by currency](https://docs.stripe.com/currencies)
- [Peaje free radar](https://usepeaje.com/radar)
