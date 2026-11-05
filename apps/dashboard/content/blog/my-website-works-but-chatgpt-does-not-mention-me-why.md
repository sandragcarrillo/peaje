---
title: "My website works but ChatGPT does not mention me, why?"
description: Why a site that loads fine and sells can still be missing from ChatGPT and Claude answers, what an agent checks when it arrives and how to find out what you are missing.
date: 2026-11-05
slug: my-website-works-but-chatgpt-does-not-mention-me-why
lang: en
categoria: Guide
portada: 3
portada_titulo: It works, but AI skips you
traduccion: mi-web-funciona-pero-chatgpt-no-me-nombra-por-que
---

# My website works but ChatGPT does not mention me, why?

A site that loads fine for a person is not necessarily a site an AI agent understands. ChatGPT and Claude read your site differently: if their search bot cannot get in, if what you sell and at what price sits inside images or behind JavaScript, or if nothing on the web talks about you, they have nowhere to get your name from to recommend you. You fix it by checking what an agent sees when it arrives, and that can be measured.

Updated: November 2026

In the example on [Peaje's free radar](https://usepeaje.com/radar), a site that works normally scores 46 out of 100 (grade D), and agents understand 14 of the 29 things they look for on it. With the fixes the free kit covers, it could reach about 74 (grade B).

## What does an agent see that a person does not?

A person looks at the design, the photos and the buttons. An agent reads the HTML, follows the rules in your robots.txt and looks for files made for it. These are the most common differences:

| What a person sees | What an agent can see |
| --- | --- |
| Your price in an image or a banner | Nothing, if the price is not written as text |
| A page built with JavaScript | An almost empty page, if the bot does not run JavaScript |
| Your brand and your logo | A loose name, if there is no structured data saying who you are |
| Your site, open | A block, if your robots.txt or your firewall stop AI search bots |

## What does the radar check on my site?

The score is calculated by Ora, an independent scanner, and the radar groups it into three questions: whether agents can find you, use you and buy from you. Among other things, it checks your robots.txt, your `llms.txt`, your sitemap, your structured data (JSON-LD), whether your prices can be read and whether your pages work without JavaScript. Each failing item comes with the points fixing it adds. We explain it in detail in [what the radar measures and what your score means](https://usepeaje.com/blog/what-does-peajes-radar-measure-and-what-does-my-score-mean).

## If I fix all of that, will ChatGPT mention me?

There is no guarantee. A site the agent can read is the base, but being recommended also depends on what you publish and on what other sites say about you, and answers change from one day to the next. That is why it pays to measure the two things separately: whether agents can read you, with the radar, and whether they cite you, by asking ChatGPT and Claude what a customer would ask, without naming your brand ([how to do it](https://usepeaje.com/blog/how-do-i-know-if-chatgpt-claude-or-perplexity-cite-my-business)).

## What if ChatGPT mentions me but gets something wrong?

That is a different problem with a different cause: old data on your site or on your profiles elsewhere, or a business with a similar name. We cover it in [why ChatGPT gets my business wrong](https://usepeaje.com/blog/why-does-chatgpt-get-my-business-wrong-and-how-do-i-fix-it).

## Where do I start?

1. Measure your site on the [radar](https://usepeaje.com/radar). It only asks for your email and your domain, and it takes less than a minute.
2. Fix first what the radar puts at the top of "What is missing", which are the easiest fixes and the ones that raise your score the most.
3. Install the free kit, which generates `llms.txt`, `openapi.json`, an MCP server, agent cards and JSON-LD for your site. You get it by registering your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), with no card.
4. Measure again and ask ChatGPT and Claude the same questions every week.

## Sources

- [Peaje free radar](https://usepeaje.com/radar)
- [Ora methodology](https://ora.ai/methodology?view=full)
- [OpenAI: overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- [Peaje pricing](https://usepeaje.com/precios)
