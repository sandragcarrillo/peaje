---
title: "How do I show up in Perplexity answers?"
description: What Perplexity asks for in its own documentation so your site shows up in its answers, how to let PerplexityBot through your firewall, what it does not publish about how it picks its sources and what Peaje does and does not do.
date: 2026-11-13
slug: how-do-i-show-up-in-perplexity-answers
lang: en
categoria: Guide
portada: 3
portada_titulo: Cited in Perplexity
traduccion: como-aparezco-en-las-respuestas-de-perplexity
---

# How do I show up in Perplexity answers?

Perplexity asks for little in its documentation: that you allow PerplexityBot in your robots.txt and, if you have a firewall, that you allow its user-agent together with its IP addresses. Every Perplexity answer carries numbered citations to the original sources, but Perplexity does not publish how it picks those sources, so what is in your hands is that its bot can read your site and that you have a page that answers your customer's question well.

Updated: November 2026

On November 13, 2026, the [official PerplexityBot IP list](https://www.perplexity.ai/perplexitybot.json) had 13 ranges, dated October 28, 2026, and the [Perplexity-User](https://www.perplexity.ai/perplexity-user.json) list had 10. Those lists change, which is why [Perplexity's bots guide](https://docs.perplexity.ai/guides/bots) recommends always taking them from its official files and updating your firewall rules automatically, instead of copying them by hand once.

## Which Perplexity bot needs to get in?

Perplexity has two, and each one is controlled separately:

| Bot | What it comes in for | robots.txt |
| --- | --- | --- |
| PerplexityBot | Surfaces and links websites in Perplexity's results. Perplexity says it does not use it to crawl content for training AI models | It follows it, and Perplexity recommends allowing it so your site shows up in its results |
| Perplexity-User | Opens a page when a person asks a question, and may link to it in the answer | It generally ignores it, because the request comes from a person |

The one that decides whether your site gets into its results is PerplexityBot. Perplexity explains that each robots.txt rule works on its own, so blocking one does not block the other, and that its systems can take up to 24 hours to reflect a change. The robots.txt ready to copy, with PerplexityBot and the other companies' search bots, is in [which AI bots visit my website and how do I let them in](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in).

## How do I let it through if I have a firewall?

Perplexity covers two cases in its guide, and both combine the user-agent with the IP address:

- **Cloudflare:** a custom rule that matches each bot's user-agent together with its own IP ranges, with the Skip action for the security features you want to bypass, placed above any rule that blocks or challenges. On paid plans you can store each bot's ranges in an IP list, and Perplexity warns that the free plan allows only one custom list, which is not enough for both bots.
- **Cloudflare Bot Fight Mode:** custom rules cannot skip it, so if you have it on, it can keep challenging PerplexityBot even when your rule is set up correctly.
- **AWS WAF:** one IP set per bot and an Allow rule that requires both that IP address and the user-agent, with a lower priority number than your blocking rules.

After any change, Perplexity recommends checking your logs, because firewall rules take time to propagate. A quick test is requesting your home page with PerplexityBot's user-agent (`curl -I -A "PerplexityBot/1.0" https://yoursite.com/`) and seeing a 200, although that only rules out blocks by user-agent and leaves out the ones that look at the IP address.

## What makes Perplexity cite me instead of someone else?

Perplexity does not publish that. Its [help center](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work) says it searches the internet in real time, gathers information from sources like articles, websites and journals, and that every answer carries numbered citations to the original sources. It does not say which index it uses, which provider its results come from or what weighs most when it picks a source, so the lists of "Perplexity ranking factors" going around on blogs do not come from Perplexity.

What you can do without guessing is have one page for each important question your customers ask, with the answer at the top and in text that sits in the HTML. Perplexity does not document whether its bot runs JavaScript, so the safe option is that your content does not depend on it. Which kind of page won when we measured our own site in ChatGPT and Claude is in [which page format do ChatGPT and Claude cite most](https://usepeaje.com/blog/which-page-format-do-chatgpt-and-claude-cite-most-guide-documentation-or-comparison), and it is a sample from a single business, without Perplexity.

## What does Peaje do with Perplexity and what does it not do?

Peaje does not measure whether Perplexity cites you. The Pro plan measures 20 of your customers' questions every week in ChatGPT and Claude only, and the [free radar](https://usepeaje.com/radar) asks ChatGPT and Claude 3 questions, so for Perplexity you have to run your own searches and check its sources, as we explain in [how do I know if ChatGPT, Claude or Perplexity cite my business](https://usepeaje.com/blog/how-do-i-know-if-chatgpt-claude-or-perplexity-cite-my-business).

What Peaje does is make sure PerplexityBot can get in:

- **The kit** allows PerplexityBot by name in your robots.txt, together with Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot and Applebot, and its check opens your home page and /developers with PerplexityBot's real user-agent to make sure a 403 or a firewall challenge is not stopping it and that your home page has a title or a heading in the HTML.
- **The radar** warns you if your robots.txt blocks PerplexityBot or Perplexity-User.
- **The fix tasks** Peaje looks for when you ask it open your home page with PerplexityBot's user-agent, and if your robots.txt or your firewall stops it, you get a task with the fix.
- **The visit log**, free with the kit, counts PerplexityBot by name, also when it reads pages your site serves on its own.

If you want the same guide for Claude, it is in [how do I get Claude to cite my website](https://usepeaje.com/blog/how-do-i-get-claude-to-cite-my-website), and the overview of the five AI search engines is in [how do I show up in AI search results](https://usepeaje.com/blog/how-do-i-show-up-in-ai-search-results).

## Sources

- [Perplexity: its bots and how to set up your firewall](https://docs.perplexity.ai/guides/bots)
- [Perplexity: PerplexityBot IP list](https://www.perplexity.ai/perplexitybot.json)
- [Perplexity: Perplexity-User IP list](https://www.perplexity.ai/perplexity-user.json)
- [Perplexity: how does Perplexity work](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
