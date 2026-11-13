---
title: "How long does Bing take to index my website so ChatGPT can find me?"
description: What is known about Bing and ChatGPT search, what Bing Webmaster Tools and IndexNow do, what Peaje does with IndexNow and which steps to follow so you get found.
date: 2026-11-07
slug: how-long-does-bing-take-to-index-my-website-so-chatgpt-can-find-me
lang: en
categoria: Guide
portada: 1
portada_titulo: Bing, IndexNow and ChatGPT
traduccion: cuanto-tarda-bing-en-indexar-mi-web-para-que-chatgpt-me-encuentre
---

# How long does Bing take to index my website so ChatGPT can find me?

There is no official number: neither Microsoft nor OpenAI publishes how long it takes, and Bing states that telling it about a new page does not guarantee it will crawl or index it. OpenAI does not say that ChatGPT searches Bing either, and what it does ask for, if you want to show up in its answers, is that you let its bot, OAI-SearchBot, in. What you control is telling Bing quickly through IndexNow, checking your pages in Bing Webmaster Tools and opening the door to OpenAI's bot.

Updated: November 2026

The only timing figure OpenAI publishes about its search is about 24 hours, and it refers to how long its systems take to adjust after you change your robots.txt, according to its [bots page](https://developers.openai.com/api/docs/bots). For indexing a new page it gives no timeframe.

## Does ChatGPT use Bing's index?

OpenAI does not put it that way. Its [help article on web search](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) explains that ChatGPT search sometimes works with other search providers, sending them a rewritten version of the question, and to see how they handle those queries it links to Microsoft's privacy statement and Shopify's privacy policy. It does not name Bing or say which part of the answers comes from there.

What is written down is what your site needs: let OAI-SearchBot crawl it and make sure your hosting or CDN accepts traffic from the IP addresses OpenAI publishes. If you block OAI-SearchBot, your site does not appear in ChatGPT search answers, and even with everything in order OpenAI says placement is not guaranteed. That is why it makes sense to do both: be properly indexed in Bing and let OpenAI's bot in. How to let it in is covered in [which AI bots visit my website](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in).

## What does Bing Webmaster Tools do for me?

It is Bing's free dashboard to see how it crawls and indexes you. The most useful parts:

- **Adding your site.** If you already verified it in Google Search Console, you import it and it gets verified automatically, along with its sitemaps. Otherwise you verify it with an XML file at the root, a meta tag or a CNAME record in your DNS. Bing says that after you add it, it usually takes 48 hours to generate the site's data, and that figure refers to the dashboard reports, because for indexing it gives none.
- **URL inspection.** It tells you whether a page is in the index, when it was discovered, crawled and indexed, which errors it found and what Bingbot sees when it downloads it. From there you request indexing once you fix something.
- **Submitting URLs by hand.** Up to 10,000 URLs per domain per day. Bing notes that submitting the same URL repeatedly does not speed up indexing.
- **IndexNow tab.** It shows the IndexNow notices that reach it from your site.

Bing recommends IndexNow over manual submission and its submission API, which still work but may be deprecated.

## What is IndexNow and which search engines use it?

It is an open protocol for telling search engines that a URL was added, changed or deleted, without waiting for them to come by and check. According to [indexnow.org](https://www.indexnow.org/), it is supported by Microsoft Bing, Naver, Seznam.cz, Yandex and Yep, and the search engines that adopt it share the URLs they receive with each other, so one notice reaches all of them. Google is not on that list.

It works like this: you publish a text file with a key (8 to 128 characters) at the root of your site and, whenever something changes, you send a POST to `api.indexnow.org/indexnow` with your host, the key and the list of URLs, up to 10,000 per submission. The response tells you what happened:

| Response | What it means |
| --- | --- |
| 200 | The search engine received the URLs |
| 202 | It received them and the key is still being validated |
| 403 | It did not find the key or the file does not contain it |
| 422 | The URLs do not belong to your host or the key does not match the format |
| 429 | Too many notices, it may treat them as spam |

A 200 only means the notice arrived. Bing makes this clear in its [getting started guide](https://www.bing.com/indexnow/getstarted): using IndexNow does not guarantee your pages will be crawled or indexed, and the change may take time to show. The same guide says Wix Studio, Duda, GoDaddy, XenForo, Milestone and Shopify already have it built in, and Cloudflare offers it through Crawler Hints.

## What does Peaje do with IndexNow?

Peaje does one specific thing with IndexNow: it generates an IndexNow key for your business and serves it at the root of your domain, at `/peaje-indexnow.txt`, through the kit proxy, so it covers all your URLs. Every time you create, edit or delete a priced API route, or create, import or delete priced links (from your dashboard, through the API or by approving a change the agent proposes), Peaje sends IndexNow two URLs from your domain: your developer portal (`/developers`) and your pricing table (`/pricing.md`), so they get crawled again with the new prices. It only does this if your site has a public domain, and before sending it checks that the key answers on your domain: if the kit proxy is not installed, it sends nothing and nothing breaks.

What Peaje does not do: it does not send notices for the rest of your pages (home, blog, products), it does not register you in Bing Webmaster Tools and it does not notify Google. For your pages, publish your own key at the root of your site, as the [IndexNow documentation](https://www.indexnow.org/documentation) recommends, because a key stored in a folder only covers the URLs in that folder.

## Which steps should I follow so Bing and ChatGPT find me?

1. **Open the door.** In your robots.txt, let OAI-SearchBot in, do not block Bingbot and add the address of your sitemap. Then check that your firewall or CDN does not stop them.
2. **Register your site in Bing Webmaster Tools.** Importing it from Google Search Console is the fastest way, and it brings your sitemaps along.
3. **Turn on IndexNow for your pages.** If your CMS or CDN includes it, enable it there. If not, publish your key at the root and send a notice every time you publish or change a page.
4. **Check the important pages by hand.** Use URL inspection to confirm your main pages are indexed, and the IndexNow tab to confirm the notices are arriving.
5. **See who comes in.** Peaje's free agent visit log shows whether OAI-SearchBot and the other AI bots read your pages once you have the kit proxy installed. For the people who arrive from ChatGPT, see [how to see that traffic in Google Analytics](https://usepeaje.com/blog/how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics).

Getting indexed is the first step, and then ChatGPT has to understand what you sell before it cites you. The [free radar](https://usepeaje.com/radar) tells you in less than a minute what an agent sees when it reaches your site, and if you are already indexed and still not mentioned, check [why ChatGPT does not mention you](https://usepeaje.com/blog/my-website-works-but-chatgpt-does-not-mention-me-why).

## Sources

- [OpenAI: bots and user agents](https://developers.openai.com/api/docs/bots)
- [OpenAI: searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
- [IndexNow: what it is and who supports it](https://www.indexnow.org/)
- [IndexNow: protocol documentation](https://www.indexnow.org/documentation)
- [Bing: how to add IndexNow](https://www.bing.com/indexnow/getstarted)
- [Bing Webmaster Tools: add and verify a site](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)
- [Bing Webmaster Tools: URL submission](https://www.bing.com/webmasters/help/url-submission-62f2860b)
- [Bing Webmaster Tools: URL inspection](https://www.bing.com/webmasters/help/url-inspection-55a30305)
- [Peaje free radar](https://usepeaje.com/radar)
