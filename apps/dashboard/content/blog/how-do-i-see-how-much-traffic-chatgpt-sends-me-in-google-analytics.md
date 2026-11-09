---
title: "How do I see how much traffic ChatGPT sends me in Google Analytics?"
description: Where to see the visits that come from ChatGPT, Gemini, Claude and Perplexity in Google Analytics 4, how to group them in your own channel and why AI bots do not show up there.
date: 2026-11-07
slug: how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics
lang: en
categoria: Guide
portada: 3
portada_titulo: ChatGPT in Google Analytics
traduccion: como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics
---

# How do I see how much traffic ChatGPT sends me in Google Analytics?

In Google Analytics 4, go to Reports, Acquisition, Traffic acquisition, switch the dimension to "Session source / medium" and type chatgpt in the table search. GA4 also has a channel called AI Assistant that groups the visits coming from assistants like ChatGPT, Gemini and Claude. That counts the people who click a link, and the AI bots that read your site stay out of GA.

Updated: November 2026

On May 13, 2026, Google Analytics added the AI Assistant channel, according to its [what's new page](https://support.google.com/analytics/answer/9164320?hl=en): when the site that sends the visit matches a recognized AI assistant, GA assigns it the medium `ai-assistant`, the campaign `(ai-assistant)` and the AI Assistant channel.

## Where do I see the visits that come from ChatGPT?

In the traffic acquisition report, in three steps:

1. Go to **Reports > Acquisition > Traffic acquisition**. The table is grouped by "Session default channel group", and the AI Assistant row shows up there if you had visits from assistants.
2. To see which one each visit came from, switch the dimension to **Session source / medium**, or add it as a secondary dimension with the + button.
3. Type `chatgpt` in the table's search bar and press Enter. Do the same with `gemini`, `claude` or `perplexity`.

Searching for the word works even if the way the visit is tagged changes.

Keep in mind that the AI Assistant channel leaves out Google's AI Overviews and AI Mode, which GA counts under "Organic Search". If you care about that traffic, see [how do I show up in Google AI Overviews](https://usepeaje.com/blog/how-do-i-show-up-in-google-ai-overviews).

## Which assistants does Google Analytics recognize?

Google does not publish the full list, and what it names in its help changes from page to page:

| Assistant | Where Google names it |
| --- | --- |
| ChatGPT | In the AI Assistant channel definition and in the announcement |
| Gemini | In the channel definition and in the announcement |
| Claude | In the channel announcement |
| Copilot, Deepseek and Grok | In the channel definition |
| Perplexity | In neither, only in its custom channel group example |

If Perplexity matters to you, or you want to decide yourself what counts as AI, build your own channel group.

## How do I group ChatGPT, Perplexity, Claude and Gemini into one channel?

With a custom channel group, which also applies to your past data:

1. In **Admin**, under Data display, click **Channel groups** and then **Create new channel group**. It starts as a copy of the default group.
2. Click **Add new channel**, name it "AI assistants" and give it the condition Source matches regex, with something like `chatgpt|openai|perplexity|claude|gemini|copilot`.
3. With **Reorder**, place your channel above "Referral" and "Organic Search". Each visit lands in the first channel it matches, and if your channel sits lower, AI visits stay in the one above it.
4. Click **Save group** and pick that group as the dimension in Traffic acquisition.

You need the Editor role or higher on the property. A standard property allows 2 custom groups, with up to 50 channels each, and conditions are not case sensitive. If an assistant changes its domain, update the expression.

If you would rather not touch the settings, in **Explore** create a **Free form** exploration, add "Session source / medium" and "Landing page + query string" as rows, "Sessions" as the metric and filter by session source containing chatgpt. That shows you which pages the people coming from ChatGPT land on.

## Why don't I see ChatGPT's bots in Google Analytics?

Because GA excludes traffic from known bots automatically, according to its [help on bot exclusion](https://support.google.com/analytics/answer/9888366?hl=en), and it does not let you turn that exclusion off or see how much traffic it removed. OAI-SearchBot, which indexes for ChatGPT search, and ChatGPT-User, which opens your page when a person asks ChatGPT to, are bots, and GA has no report to see what they read.

That is what Peaje's agent visit log is for, and it comes with the free plan. It counts requests to the kit files and, with the kit proxy installed, also the pages of your site that OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot and GPTBot read, each one by name, and the rest goes under "Other". It does not count visits from a browser as agent visits, so for the people who arrive from ChatGPT you still need GA. On usepeaje.com, the log counted 1108 bot visits in 30 days: 225 from Googlebot, 197 from ClaudeBot and 133 from GPTBot.

The two numbers tell you different things. A bot reading you means you can appear in answers, and a person arriving from ChatGPT means you already appeared and someone clicked. If you want to know whether you get cited even when nobody clicks, see [how do I know if ChatGPT, Claude or Perplexity cite my business](https://usepeaje.com/blog/how-do-i-know-if-chatgpt-claude-or-perplexity-cite-my-business), and to let the bots in, [which AI bots visit my website](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in).

## Sources

- [Google Analytics: what's new (AI Assistant channel, May 13, 2026)](https://support.google.com/analytics/answer/9164320?hl=en)
- [Google Analytics: default channel group](https://support.google.com/analytics/answer/9756891?hl=en)
- [Google Analytics: custom channel groups](https://support.google.com/analytics/answer/13051316?hl=en)
- [Google Analytics: traffic acquisition report](https://support.google.com/analytics/answer/12923437?hl=en)
- [Google Analytics: free form exploration](https://support.google.com/analytics/answer/9327972?hl=en)
- [Google Analytics: known bot traffic exclusion](https://support.google.com/analytics/answer/9888366?hl=en)
- [OpenAI: bots and user agents](https://developers.openai.com/api/docs/bots)
- [Peaje pricing](https://usepeaje.com/precios)
