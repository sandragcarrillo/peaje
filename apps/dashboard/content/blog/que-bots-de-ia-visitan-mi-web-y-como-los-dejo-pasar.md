---
title: "¿Qué bots de IA visitan mi web y cómo los dejo pasar?"
description: Los bots de OpenAI, Anthropic y Perplexity, qué hace cada uno, el robots.txt para dejarlos pasar y cómo saber cuáles entran de verdad.
date: 2026-10-28
slug: que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar
lang: es
categoria: Guía
portada: 2
portada_titulo: Bots de IA en tu web
traduccion: which-ai-bots-visit-my-website-and-how-do-i-let-them-in
---

# ¿Qué bots de IA visitan mi web y cómo los dejo pasar?

Los que más importan son los de OpenAI (OAI-SearchBot, GPTBot y ChatGPT-User), los de Anthropic (Claude-SearchBot, ClaudeBot y Claude-User) y los de Perplexity (PerplexityBot y Perplexity-User). Para que te recomienden con un enlace basta con dejar pasar los de búsqueda en tu `robots.txt` y revisar que tu firewall no los frene, y los de entrenamiento los puedes bloquear sin perder citas. Para saber cuáles entran de verdad necesitas un registro de visitas, y en Peaje viene en el plan gratis.

Actualizado: octubre de 2026

El registro de visitas de agentes de Peaje cuesta US$0 y no pide tarjeta, según la [página de precios](https://usepeaje.com/precios), y viene con el resto del kit: llms.txt, openapi.json, un servidor MCP, agent cards y JSON-LD para tu sitio.

## ¿Qué bot es cada uno y para qué entra?

Cada empresa tiene uno para buscar, otro para entrenar y otro que entra cuando una persona le pide algo al asistente, y solo el primero decide si apareces en las respuestas.

| Bot (user-agent) | Empresa | Para qué entra |
| --- | --- | --- |
| OAI-SearchBot | OpenAI | Indexa para la búsqueda de ChatGPT. Si lo bloqueas, no sales en sus respuestas |
| GPTBot | OpenAI | Rastrea para entrenar modelos |
| ChatGPT-User | OpenAI | Abre tu página cuando alguien se lo pide a ChatGPT, y puede no seguir robots.txt |
| Claude-SearchBot | Anthropic | Indexa para las búsquedas de Claude |
| ClaudeBot | Anthropic | Rastrea para entrenar modelos |
| Claude-User | Anthropic | Abre tu página cuando alguien se lo pide a Claude |
| PerplexityBot | Perplexity | Indexa para las respuestas con enlaces de Perplexity, y no entrena modelos |
| Perplexity-User | Perplexity | Abre tu página cuando alguien pregunta, y por lo general no sigue robots.txt |

Google-Extended no sale en la tabla porque nunca entra a tu sitio: lo escribes en robots.txt para decidir si Google usa tu contenido en sus productos de IA.

## ¿Cómo los dejo pasar?

Pon esto al principio de `https://tusitio.com/robots.txt` (o en `app/robots.ts` si tu sitio lo genera):

```
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: https://tusitio.com/sitemap.xml
```

Si no quieres que entrenen con tu contenido, agrega `Disallow: /` para GPTBot, ClaudeBot y Google-Extended, que eso no te saca de las respuestas. Después revisa que tu sitio contesta:

```
curl -I -A "OAI-SearchBot/1.0" https://tusitio.com/
```

Lo correcto es un `HTTP/2 200` con tu página. Algunos firewalls revisan también la IP del bot, así que esta prueba encuentra los bloqueos por user-agent y no todos los demás.

## ¿Qué pasa si algo los bloquea?

Si la respuesta no es 200, el bot no lee nada, y estos son los casos más comunes:

- **403 o una página de desafío:** tu firewall o tu CDN los trata como bots malos. En Cloudflare, "Block AI bots" bloquea también a los que buscan, así que conviene apagarlo y bloquear solo los de entrenamiento.
- **429:** el límite de pedidos es muy bajo para ellos, súbelo para estos user-agents.
- **401:** lo que vendes está detrás de un login, y deja público al menos qué vendes y a qué precio.
- **200 con la página vacía:** tu sitio arma el contenido solo con JavaScript, y el bot no lo ve. Sirve el texto en el HTML.

## ¿Cómo sé cuáles me visitan de verdad?

Con el registro de visitas del kit gratis. Registras tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y en tu panel, en "Instalar el kit", tienes un texto listo para pegarle a tu herramienta de IA o el comando `npx @peaje/cli@1 init <slug>`. Cuenta por nombre a OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot y GPTBot, incluso cuando leen páginas que tu sitio sirve solo, como la portada o el blog, y el resto sale en "Otros" con el nombre de cada uno. Las visitas de personas desde un navegador no cuentan, y del bot solo guarda la ruta y su user-agent. Si activas tu agente, te manda el resumen por Telegram cada día, semana o mes, por ejemplo "Esta semana te visitaron 38 agentes: ChatGPT 21, Perplexity 9, Claude 8".

## ¿Con dejarlos pasar basta para que me recomienden?

No, que entren es lo mínimo. Después tienen que entender qué vendes y a qué precio, y para eso está el resto del kit gratis. Si quieres que alguien haga el trabajo contigo, el agente Pro cuesta US$30 al mes (precio de fundador para los primeros 50 negocios, después US$69), con 500 créditos al mes y 20 preguntas seguidas en asistentes de IA. Para empezar, el [radar gratis](https://usepeaje.com/radar) te dice en menos de un minuto qué ve un agente cuando llega a tu sitio.

## Fuentes

- [OpenAI: bots y user-agents](https://developers.openai.com/api/docs/bots)
- [Anthropic: cómo funcionan sus crawlers](https://support.claude.com/en/articles/8896518)
- [Perplexity: sus bots](https://docs.perplexity.ai/guides/bots)
- [Precios de Peaje](https://usepeaje.com/precios)
- [Radar gratis](https://usepeaje.com/radar)
