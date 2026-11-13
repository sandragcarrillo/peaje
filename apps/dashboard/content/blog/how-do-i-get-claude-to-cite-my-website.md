---
title: "How do I get Claude to cite my website?"
description: Which of Anthropic's three bots decides whether Claude can cite you, when Claude searches the web according to its documentation, what your page needs so Claude can read it and what Peaje measures and does not.
date: 2026-11-13
slug: how-do-i-get-claude-to-cite-my-website
lang: en
categoria: Guide
portada: 1
portada_titulo: Cited by Claude
traduccion: como-hago-que-claude-cite-mi-sitio-web
---

# How do I get Claude to cite my website?

Claude cites your site when it searches the web to answer and your page shows up among the results, so the first step is not blocking Claude-SearchBot, the bot Anthropic uses to index for Claude's searches. ClaudeBot crawls to train models and blocking it does not take you out of those searches, and Claude-User opens your page when a person asks Claude to. Anthropic does not publish which index it searches or how it picks one source over another, so the rest depends on having a readable page that answers your customer's question.

Updated: November 2026

When Claude searches the web through its API, each citation carries the URL, the title and up to 150 characters of the text it cites from your page, according to the [documentation for its search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), and in that tool citations are always on. If the answer to your customer's question sits in a complete sentence at the top of your page, that sentence fits in a citation.

## Which of Anthropic's bots needs to be able to read your site?

Anthropic has three, and it explains what happens if you block each one on its [page about how it crawls the web](https://support.claude.com/en/articles/8896518):

| Bot | What it comes in for | If you block it |
| --- | --- | --- |
| Claude-SearchBot | Navigates the web to improve search result quality | Claude does not index your content for search, and you can lose visibility and accuracy in its results |
| Claude-User | Opens your page when a person asks Claude something | Claude cannot retrieve your content to answer that question, and you can lose visibility in searches a person asks for |
| ClaudeBot | Helps improve the usefulness and safety of its AI models | Your future content stays out of its training data |

All three respect robots.txt, including the non-standard Crawl-delay extension. Anthropic warns that blocking its IP addresses may not work well as a way to opt out, because it keeps them from reading your robots.txt, and it publishes its [IP list](https://claude.com/crawling/bots.json): if a visit comes from an IP address on that list, it comes from Anthropic, which helps you let it through your firewall without opening the door to anyone who copies the user-agent. The robots.txt ready to copy is in [which AI bots visit my website and how do I let them in](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in).

## When does Claude search the web?

Claude searches when the question depends on something current, and the API documentation spells it out: it searches when the question is about today's prices, figures or news, about organizations, people or products that may have changed, or when someone asks it to look something up, and it answers without searching when what it already knows is enough, like established facts, concepts or creative writing. A question like "which invoicing software works for me and how much does it cost" is more likely to bring sources than "what is an electronic invoice", which Claude can answer without citing anyone.

In the app, according to [Claude's help center](https://support.claude.com/en/articles/10684626-enabling-and-using-web-search), search is turned on from the "+" menu in the chat, and in the new experience there is no toggle. On Team and Enterprise plans, whoever manages the account has to enable it first. Every answer with search carries citations, and Claude can use the location it infers from the person's IP address when the question asks for local results.

## What does your page need so Claude can read it?

The Claude API documentation gives several hints about its tool for reading pages (web fetch):

- **Text in the HTML:** it does not read sites that build their content with JavaScript, so whatever you want cited has to be in the HTML your server sends.
- **Formats:** it only reads text, HTML and PDF.
- **robots.txt:** if your robots.txt does not let it in, the read fails.
- **Cached copies:** it caches the pages it reads, and what it gets may not be the latest version of your page.

Each search result also carries the date the site was last updated. Beyond that, Anthropic does not publish what makes Claude pick a source: it does not say which index its text results come from, and the only provider it names is Bing, for the images it shows in the chat. There are also cases where your page cannot show up even when it is well made, because a company that uses Claude can limit which domains it searches. In our measurement of usepeaje.com, technical documentation and guides won, as we explain in [which page format do ChatGPT and Claude cite most](https://usepeaje.com/blog/which-page-format-do-chatgpt-and-claude-cite-most-guide-documentation-or-comparison).

## What does Peaje do and what does it not do?

Peaje measures whether Claude cites you by asking it your customers' questions, and it makes sure its bots can get in:

- **Free radar:** at [usepeaje.com/radar](https://usepeaje.com/radar), with your email and your domain, it asks ChatGPT and Claude 3 buying questions, shows you whether they cite you and who they cite instead, and warns you if your robots.txt blocks ClaudeBot, Claude-SearchBot or Claude-User.
- **Pro:** your agent measures 20 of your customers' questions in ChatGPT and Claude every week and measures each verified page again at 2 and 6 weeks. It asks Claude through its API with search turned on and reads the sources it cites, which approximates what a person sees in the app, with a different model and without their history or location. It costs US$30 a month for the first 50 businesses and US$69 after that, according to the [pricing page](https://usepeaje.com/precios).
- **Kit:** it allows Claude-SearchBot by name in your robots.txt, and if you choose to block training bots, it blocks ClaudeBot and leaves Claude-SearchBot alone. The kit's check tests your home page with the user-agents of Googlebot, OAI-SearchBot and PerplexityBot, without Claude-SearchBot, which is included in the access review behind the fix tasks: if your robots.txt or your firewall stops it, you get a task.
- **Visit log:** it counts ClaudeBot by name, and since it trains, we do not take it as a sign that Claude will cite you. Claude-SearchBot shows up under "Other" with its name when it reads the kit files, like /llms.txt, and its reads of your other pages are not counted yet.

Peaje cannot promise that Claude will cite you: on November 7, 2026, usepeaje.com had 0% citations in the 20 questions we measured in ChatGPT and Claude. How often it makes sense to measure again is in [how often should I check whether ChatGPT and Claude cite my business](https://usepeaje.com/blog/how-often-should-i-check-whether-chatgpt-and-claude-cite-my-business), and the same guide for Perplexity is in [how do I show up in Perplexity answers](https://usepeaje.com/blog/how-do-i-show-up-in-perplexity-answers).

## Sources

- [Anthropic: how it crawls the web and how to block its bots](https://support.claude.com/en/articles/8896518)
- [Anthropic: IP list for its bots](https://claude.com/crawling/bots.json)
- [Claude: enable and use web search](https://support.claude.com/en/articles/10684626-enabling-and-using-web-search)
- [Claude API: web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Claude API: web fetch tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
