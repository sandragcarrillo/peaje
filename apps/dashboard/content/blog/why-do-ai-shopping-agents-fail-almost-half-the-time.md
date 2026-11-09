---
title: "Why do AI shopping agents fail almost half the time, and what can your site do about it?"
description: What Visa's first benchmark for AI shopping agents measured, why part of the failures start on the merchant's site, what you control and what you can check this week.
date: 2026-11-08
slug: why-do-ai-shopping-agents-fail-almost-half-the-time
lang: en
categoria: News
portada: 2
portada_titulo: Visa's shopping benchmark
traduccion: por-que-los-agentes-de-ia-compradores-fallan-casi-la-mitad-de-las-veces
---

# Why do AI shopping agents fail almost half the time, and what can your site do about it?

Visa published the first industry benchmark for AI shopping agents on November 5, 2026: it ran 22 models from 12 labs through 15 shopping scenarios, three attempts each, and 57.2% of the runs passed. The benchmark grades the buyer, the model that talks to the customer, picks a product and decides whether to pay. Part of what it counts as a failure starts on the other side, on the site the buyer reads, and that part is yours to fix.

Updated: November 2026

According to [Visa's release](https://investor.visa.com/news/news-details/2026/Visa-Releases-First-of-Its-Kind-Industry-Benchmark-for-AI-Shopping-Almost-Half-of-Test-Runs-Fail/default.aspx), 54% of the failed runs still ended with the agent buying something.

## What did Visa actually measure?

The Visa Agentic Commerce Benchmark puts a model in front of a simulated customer who wants to buy something like a TV, a laptop or a personal care appliance. The customer gives a few clues and keeps the rest to themselves. The model has to ask the right questions, find a product that meets every requirement, justify the choice and walk away if nothing fits.

Each model got three attempts per scenario. The numbers that matter:

- 57.2% of runs passed. The best models passed 82.2%, the worst 28.9%.
- All three attempts passed only 34.2% of the time, so a model that got it right once often got it wrong the next time.
- The five models that uncovered the most hidden requirements passed 70.2%, and the five that uncovered the fewest passed 44.4%.
- The five most expensive models passed 67.1% of runs, and the five cheapest 50.2%.
- 54% of failed runs ended in a purchase.

Visa names two causes of failure: the agent recommended a product that did not meet requirements it had already identified, or it failed to uncover all the customer's requirements. The second is a conversation problem, because the agent did not ask enough. The first one is where your site comes in.

## Why does the wrong product involve your site?

Take Visa's own example. A customer wants a TV, mentions a brand a relative recommended and a membership with a third-party supplier, and stops there. The agent has to work out the budget, the video format, HDR10+ support for family videos and what the TV can do for games.

Say the agent asks all of that and the customer answers. Now it has to check HDR10+ on a product page. If that spec lives in a comparison image, in a tab that only loads after a click, in a PDF datasheet or on a page the bot is not allowed to fetch, the agent has two options: guess, or move on to a competitor whose page says it in plain text.

Visa does not separate "the model reasoned badly" from "the model could not read the spec", and both land in the same bucket, a product that did not meet the requirements. Nobody outside Visa knows the split yet. What we do know is that a better model will not fix the second kind of failure, because next year's model still reads the same page.

The [radar](https://usepeaje.com/radar) measures exactly that: what an agent can find on your site today, with a score from [Ora](https://ora.ai) and the list of what it finds and what it misses. It only asks for your email and your domain, and it takes less than a minute.

## What does a merchant control, and what does it not?

Most of the benchmark is out of your hands, and part of it is on your side of the request:

| What went wrong in the run | Who owns it | What you can do |
| --- | --- | --- |
| The agent did not ask the customer enough questions | The model | Nothing, until the next version |
| The agent read the wrong spec, or could not find it | Your site | Put the specs that decide a purchase in text, with a visible date, and let answer bots in |
| The agent picked a variant that was out of stock or priced differently | Your site | One price and one availability per variant, on the page and also in the cart |
| The agent bought when it should have walked away | Both | Clear "does not support X" statements help an honest agent say no |
| The agent could not pay or complete checkout | Your site (Visa plans to test this) | Check today that an agent can reach and use your payment step |

None of this guarantees a sale. Being cited and chosen also depends on what other sites say about you. A readable page does change which failures are yours to fix.

## What will Visa test next, and can you check it today?

Visa says it plans to add shopping scenarios and product categories, and to extend the test to checkout, payment and order placement. That is the part of the run where the agent stops reading and starts paying.

The trust numbers explain why Visa cares. In its September 2026 Trust Index, 72% of US consumers had used an AI assistant, but only 23% trusted AI to handle payment transactions. An agent that buys the wrong TV with someone's card does not help that number.

If you sell something agents pay for per request, like an API, a report or a dataset, you can check part of this today. Peaje's mystery shopper (Pro plan, 30 credits) gives a test buying agent three requests your business should win, has it search where those agents look (Peaje's directory, the x402 Bazaar and the ERC-8004 registries) and records whether it found you, in what position, whom it chose instead and why. Then it requests your priced URL without paying and checks that the payment step answers correctly. It never pays, it needs at least one priced route or link, and whatever fails becomes a task. It does not simulate an assistant buying a physical product in your store, so for a TV checkout the test is the one in step 5 below.

## What should you do this week?

Five things, from least to most effort, and the first one is free:

1. Run the [radar](https://usepeaje.com/radar) on your domain and read the list of what agents miss, beyond the score.
2. Check which AI bots can read your site. The bots that search and cite (OAI-SearchBot, Claude-SearchBot, PerplexityBot) are different from the ones that train models (GPTBot, ClaudeBot), and many sites block all of them with one rule ([which ones they are](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).
3. Pick the three specs that decide a purchase in your category and make sure each one is plain text on the product page, with a date that shows the page is current.
4. Write the negatives too. "Does not support HDR10+" is more useful to an agent than silence, and it keeps an agent from buying the wrong thing on a customer's behalf.
5. Send an agent through your own checkout. Open Claude Code or Cursor with browser access, give it a task and a test card, and watch where it stops. What a store needs for an agent to buy from it is in [this guide](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it).

The models in Visa's table will get better. Your product page will stay as it is until you change it.

## Sources

- [Visa: first-of-its-kind industry benchmark for AI shopping, almost half of test runs fail](https://investor.visa.com/news/news-details/2026/Visa-Releases-First-of-Its-Kind-Industry-Benchmark-for-AI-Shopping-Almost-Half-of-Test-Runs-Fail/default.aspx), November 5, 2026. All benchmark figures and the Trust Index numbers come from this release.
- [Ora](https://ora.ai), the independent agent-readiness score the radar uses.
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
