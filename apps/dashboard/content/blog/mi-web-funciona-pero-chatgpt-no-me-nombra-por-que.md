---
title: "Mi web funciona pero ChatGPT no me nombra, ¿por qué?"
description: Por qué un sitio que carga bien y vende puede no aparecer en las respuestas de ChatGPT y Claude, qué revisa un agente cuando llega y cómo saber qué te falta a ti.
date: 2026-11-05
slug: mi-web-funciona-pero-chatgpt-no-me-nombra-por-que
lang: es
categoria: Guía
portada: 3
portada_titulo: Funciona, pero no te nombran
traduccion: my-website-works-but-chatgpt-does-not-mention-me-why
---

# Mi web funciona pero ChatGPT no me nombra, ¿por qué?

Que tu sitio cargue bien para una persona no quiere decir que un agente de IA lo entienda. ChatGPT y Claude leen tu sitio de otra forma: si el bot que buscan no puede entrar, si lo que vendes y a qué precio está dentro de imágenes o detrás de JavaScript, o si nada en la web habla de ti, no tienen de dónde sacar tu nombre para recomendarte. Se arregla revisando qué ve un agente cuando llega, y eso se puede medir.

Actualizado: noviembre de 2026

En el ejemplo del [radar gratis de Peaje](https://usepeaje.com/radar), un sitio que funciona normal saca 46 de 100 (nota D), y los agentes entienden 14 de las 29 cosas que buscan en él. Con los arreglos que cubre el kit gratis podría llegar a cerca de 74 (nota B).

## ¿Qué ve un agente que no ve una persona?

Una persona mira el diseño, las fotos y los botones. Un agente lee el HTML, sigue las instrucciones de tu robots.txt y busca archivos hechos para él. Estas son las diferencias más comunes:

| Lo que ve una persona | Lo que puede ver un agente |
| --- | --- |
| Tu precio en una imagen o un banner | Nada, si el precio no está escrito en texto |
| Una página que se arma con JavaScript | Una página casi vacía, si el bot no ejecuta JavaScript |
| Tu marca y tu logo | Un nombre suelto, si no hay datos estructurados que digan quién eres |
| Tu sitio abierto | Un bloqueo, si tu robots.txt o tu firewall frenan a los bots de búsqueda de IA |

## ¿Qué revisa el radar en mi sitio?

El puntaje lo calcula Ora, un escáner independiente, y el radar lo agrupa en tres preguntas: si te pueden encontrar, si te pueden usar y si te pueden comprar. Revisa, entre otras cosas, tu robots.txt, tu `llms.txt`, tu sitemap, tus datos estructurados (JSON-LD), si tus precios se pueden leer y si tus páginas funcionan sin JavaScript. Cada cosa que falla sale con los puntos que suma arreglarla. Lo explicamos en detalle en [qué mide el radar y qué significa tu puntuación](https://usepeaje.com/blog/que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion).

## Si arreglo todo eso, ¿ChatGPT me va a nombrar?

No hay garantía. Un sitio que el agente puede leer es la base, pero que te recomiende también depende de lo que publicas y de lo que otros sitios dicen de ti, y las respuestas cambian de un día a otro. Por eso conviene medir las dos cosas por separado: si te pueden leer, con el radar, y si te citan, preguntándole a ChatGPT y a Claude lo que preguntaría un cliente, sin decir tu marca ([cómo hacerlo](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio)).

## ¿Y si ChatGPT me nombra pero dice algo equivocado?

Es otro problema, con otra causa: datos viejos en tu sitio o en tus perfiles fuera de él, o un negocio con un nombre parecido. Lo tratamos en [por qué ChatGPT da información equivocada de mi negocio](https://usepeaje.com/blog/por-que-chatgpt-da-informacion-equivocada-de-mi-negocio-y-como-la-corrijo).

## ¿Por dónde empiezo?

1. Mide tu sitio en el [radar](https://usepeaje.com/radar). Solo pide tu email y tu dominio, y tarda menos de un minuto.
2. Arregla primero lo que el radar pone arriba en "Lo que falta", que son los arreglos más fáciles y los que más suben tu puntaje.
3. Instala el kit gratis, que genera `llms.txt`, `openapi.json`, un servidor MCP, agent cards y JSON-LD para tu sitio. Lo sacas registrando tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo), sin tarjeta.
4. Vuelve a medir y repite las mismas preguntas en ChatGPT y Claude cada semana.

## Fuentes

- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Metodología de Ora](https://ora.ai/methodology?view=full)
- [OpenAI: los bots de OpenAI](https://developers.openai.com/api/docs/bots)
- [Precios de Peaje](https://usepeaje.com/precios)
