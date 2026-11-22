---
title: "Why does an AI agent get stuck on my booking form?"
description: What stops an AI agent when it tries to book for your customer, which of those things Peaje's free radar checks, a test you can run today and what to fix first.
date: 2026-11-22
slug: why-does-an-ai-agent-get-stuck-on-my-booking-form
lang: en
categoria: Guide
portada: 4
portada_titulo: Bookings an agent can finish
traduccion: por-que-un-agente-de-ia-se-atasca-en-mi-formulario-de-reserva
---

# Why does an AI agent get stuck on my booking form?

Usually because the form was built for a person looking at it, and an agent has to read it. To finish a booking it needs labeled fields, real buttons, content that loads without JavaScript and permission to enter your site. If any of that fails, it does not know what to type or cannot press "Book", and your customer ends up booking somewhere else.

Updated: November 2026

Peaje's [free radar](https://usepeaje.com/radar) runs your site through Ora, an independent scanner, and tells you how many of the things an agent looks for it can find. In the example on the radar page, agents understand 14 of 29 things, with a score of 46 (D) that can reach about 74 (B) with the kit.

## What stops an agent on a booking form?

| What happens on your site | Why it stops the agent | Ora check in the radar |
| --- | --- | --- |
| Fields with no label, only gray placeholder text | The gray text disappears when typing and the agent does not know what goes in each field | Form fields with labels |
| Something that looks like a button but is built from another element | The agent does not see it as a button and cannot press it | Real buttons |
| Buttons with only an icon and no text | With no name, the agent has no way to point to it | Buttons with names |
| The calendar or the form only shows up with JavaScript | Most AI bots do not run JavaScript and see a blank page | Content without JavaScript |
| Very strict bot protection | It also turns away the agents you do want | Bot protection |
| Your robots.txt does not let in agents acting for your customers | ChatGPT, Claude or Perplexity cannot open your site when a person asks them to | robots.txt permission |
| Manual steps: call, message on WhatsApp, create an account first | Every manual step is a place where the agent gives up | First use without help from a person |
| A page with no headings or sections | Agents move through a page by its headings, the way a screen reader does | Page structure |

There is another filter before the form: if the agent does not know what you offer or what you charge, it never reaches the booking page. Your structured data (JSON-LD), your llms.txt and a price list a machine can read take care of that.

## What does the radar check out of all this?

It checks everything in the table, without filling in or sending your form. The radar asks Ora to scan your site, and those checks count in the line that opens your result, "agents understand X of Y things" ([how to read your score](https://usepeaje.com/blog/what-does-peajes-radar-measure-and-what-does-my-score-mean)).

To read your result well, keep in mind that the "What is missing" list only shows what the Peaje kit fixes, such as llms.txt, JSON-LD, openapi.json or the MCP server. Form checks get fixed inside your own site, so they do not show up there: if you pass them, you see them under "What you already do well", and if one from the table is not in that section, that is your suspect.

## How do I find the step where it gets stuck?

1. **Measure your domain in the radar:** it takes under a minute and only asks for your email, no card.
2. **Open "What you already do well"** and write down which checks from the table are missing.
3. **Run the test in ChatGPT or Claude** with the prompt below and write down the exact step where it says it gets stuck.
4. **If you installed the kit, open "Agent visits" in your dashboard:** you see which AI bots read your site, which pages they read and which paths they asked for that do not exist. Agents that browse like a browser are counted separately, together with people, so this view does not tell you on which click one gave up.
5. **Fix the quickest things first:** labels, button names and robots.txt are a few lines, while replacing hand-built controls, changing bot protection or reworking a site that depends on JavaScript needs whoever codes your website.

## What prompt can I use to test my form today?

Paste this into ChatGPT or Claude with your domain and details:

> Go to yourdomain.com/booking and review the form as if you were booking for two people next Friday afternoon. Do not submit anything and do not make up data. Tell me what each field asks for, which fields or buttons you do not understand, at which exact step you would get stuck and what the site would need to change for you to finish.

Keep the answer, because it lists the failures in the agent's own words. Run the test again after every change. If it says it could not open the page, check your robots.txt and your bot protection ([which AI bots visit your website and how to let them in](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).

## What do I fix first?

1. **Give every field a label:** name, date, time, party size and phone, because gray placeholder text is not enough.
2. **Use real buttons with text:** "Book" helps an agent more than an arrow.
3. **Put your hours, prices and conditions in text,** on the page itself and not only inside the calendar.
4. **Explain what happens after submitting:** whether an email arrives, how soon you confirm and how to cancel.
5. **Remove steps that need another channel,** or explain them in text, for example "we confirm on WhatsApp within an hour".
6. **Install the free kit,** so the agent knows what you are and what you offer before it reaches the form: llms.txt, JSON-LD, openapi.json, MCP server and agent cards ([how to add llms.txt and JSON-LD](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site)).

## Frequently asked questions

### Does the Peaje kit fix my form?

No. The kit, which is free, puts the files agents read on your domain, while the labels, buttons and JavaScript of your form get changed in your site's code, by whoever runs your website.

### Does the radar test a real booking?

No, it scans your site with Ora and shows you which checks you pass, without filling in or sending anything. To see the form from the inside, use the prompt above.

### What if my booking form is a widget from another company?

The checks apply to the page the agent opens, so if the form belongs to another provider, the labels and buttons depend on them. What you do control is your own page: your hours, prices and conditions in text, and a direct link to the booking.

### How often should I measure again?

After every change, and the radar lets you measure up to 6 times an hour.

### How much does it cost?

The radar and the kit are free and do not ask for a card. The Pro agent, which tells you what to publish and measures whether ChatGPT and Claude cite you, costs US$30 a month at the founder price for the first 50 businesses and US$69 after that ([pricing](https://usepeaje.com/precios)).

## Sources

- [Peaje's free radar](https://usepeaje.com/radar): the example of 14 of 29 things and the score from 46 to about 74.
- [Ora's methodology](https://ora.ai/methodology), the scanner the radar uses, read on November 22, 2026.
- [Peaje pricing](https://usepeaje.com/precios): free plan with radar, kit and agent visit log, and the Pro plan.

## Related

- [What does Peaje's radar measure and what does my score mean?](https://usepeaje.com/blog/what-does-peajes-radar-measure-and-what-does-my-score-mean)
- [What is openapi.json for, and which AI agents read it?](https://usepeaje.com/blog/what-is-openapi-json-for-and-which-ai-agents-read-it)
- [Which AI bots visit my website and how do I let them in?](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)
