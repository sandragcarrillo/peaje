---
title: "Why does ChatGPT get my business wrong and how do I fix it?"
description: Where ChatGPT gets what it says about your business, why it sometimes gets prices, hours or who you are wrong, and what to fix on your site and off it so it gets it right.
date: 2026-11-03
slug: why-does-chatgpt-get-my-business-wrong-and-how-do-i-fix-it
lang: en
categoria: Guide
portada: 2
portada_titulo: What AI says about you
traduccion: por-que-chatgpt-da-informacion-equivocada-de-mi-negocio-y-como-la-corrijo
---

# Why does ChatGPT get my business wrong and how do I fix it?

ChatGPT builds what it says about your business from what it learned when it was trained and from what it finds on the web when it searches. If your site does not say something clearly in text, if your profiles on other sites say something different or if its search bot cannot get into your site, it fills the gap with whatever it has, which can be outdated or about another business. To fix it, fix those sources: your site first, then your profiles elsewhere, and let the search bots read them again.

Updated: November 2026

Peaje's free kit has a section for this, with your business card in JSON-LD and a list of 4 profiles to review outside your site: Google Business Profile, Bing Places, LinkedIn and Yelp. You get it by registering your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo).

## Why does it get it wrong?

| What happens | Why | What fixes it |
| --- | --- | --- |
| It gives an old price or old hours | It learned them before they changed and did not search, or it found an old page | Having the current data in text on your site and removing or redirecting old pages |
| It does not know what you sell | Your homepage says it with images or only with JavaScript, and the bot does not see it | Saying it in text in the HTML, with a clear sentence at the top |
| It mixes you up with another business | There is another one with a similar name, and nothing links your site to your profiles | Your business card in JSON-LD with the links to your profiles |
| It gets your address or phone wrong | Your profiles on other sites do not match each other | The same name, address and phone, written the same way, everywhere |
| It says nothing new about you | Its search bot cannot get into your site | Letting in OAI-SearchBot and the other bots that cite |

## What do I fix on my site?

- **The data in text:** what you sell, to whom, at what price, where you are and how to reach you, written on the page and not inside an image. A frequently asked questions page keeps all of it in one place.
- **Your business card (JSON-LD):** the Organization block in the `<head>` of your homepage, with your name, logo, phone, address, a short description and the links to your profiles (the `sameAs` field). Those links tell AI that your site and your profiles are the same business.
- **Old pages:** if a page with prices from two years ago is still live, AI can find it. Update it, or redirect it to the new one.
- **Bot access:** check that your robots.txt and your firewall let the search bots in ([which ones they are](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)). OpenAI says sites that block OAI-SearchBot are not shown in ChatGPT's search answers.

## And outside my site?

Assistants also read what other sites say about you. Review your profiles on directories and social networks, and write the name, address and phone exactly the same way on all of them, with the same abbreviations. If a directory has outdated data you do not control, ask them to fix it. Then add those profiles to your business card, so everything is linked.

## How do I do it with Peaje?

In your dashboard, open "Kit" and scroll to "Answer engines":

- **Your entity:** you fill in the logo, phone, address, a description of up to 300 characters and your profiles, one per line. Peaje puts them in your homepage's JSON-LD, and it only includes what you fill in.
- **Off your site:** a list with Google Business Profile, Bing Places, LinkedIn and Yelp, with your name and address ready to copy, so they are written the same way everywhere.
- **Training bots:** an option to block them in your robots.txt without touching the search bots that cite you.

The [free radar](https://usepeaje.com/radar) also checks whether you show up on top when someone searches your brand. Peaje does not check today whether what AI says about your business is correct, so you confirm that by asking ChatGPT and Claude.

## How long does the fix take?

There is no fixed date. When ChatGPT searches the web, new information shows up when its bot reads your site and your profiles again, and what it learned in training only changes with a new model. Ask the same questions every week, in a new conversation and with search turned on ([how often to measure](https://usepeaje.com/blog/how-often-should-i-check-whether-chatgpt-and-claude-cite-my-business)).

## Sources

- [OpenAI: overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- [schema.org: Organization](https://schema.org/Organization)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
