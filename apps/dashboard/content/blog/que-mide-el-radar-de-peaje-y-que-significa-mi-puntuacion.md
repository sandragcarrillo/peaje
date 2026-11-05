---
title: "¿Qué mide el radar de Peaje y qué significa mi puntuación?"
description: De dónde sale el puntaje del radar de Peaje, qué pesa cada parte, qué significa cada nota de A+ a F, cómo se calcula el número "con Peaje" y cómo leer el resto del resultado.
date: 2026-11-03
slug: que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion
lang: es
categoria: Guía
portada: 3
portada_titulo: Tu puntaje en el radar
traduccion: what-does-peajes-radar-measure-and-what-does-my-score-mean
---

# ¿Qué mide el radar de Peaje y qué significa mi puntuación?

Tu puntaje, de 0 a 100, dice qué tan listo está tu sitio para que un agente de IA te encuentre, te use y te pague. Lo calcula Ora, un medidor independiente que revisa tu sitio en cuatro capas, y de ahí sale también tu nota, de A+ a F. El número "con Peaje" es una estimación de cuánto subirías si arreglas lo que cubre el kit, sin ser una promesa.

Actualizado: noviembre de 2026

Según la [metodología de Ora](https://ora.ai/methodology?view=full), los 100 puntos se reparten así: 20 para que te encuentren, 30 para que puedan entrar, 40 para que puedan usar tu sitio y 10 para que puedan pagarte.

## ¿Qué revisa cada parte?

El radar agrupa las cuatro capas de Ora en tres preguntas:

| En el radar | Capas de Ora | Puntos | Qué revisa, por ejemplo |
| --- | --- | --- | --- |
| ¿Te encuentran? | Discovery | 20 | Qué les dice tu robots.txt a los bots de IA, si sales arriba cuando buscan tu marca y si tu servidor MCP está en los directorios |
| ¿Te pueden usar? | Access y Usability | 70 | llms.txt, sitemap, datos estructurados, precios legibles, páginas que se leen sin JavaScript y un servidor MCP que funcione bien |
| ¿Te pueden comprar? | Payments | 10 | Si aceptas alguno de los protocolos con que pagan los agentes: ACP, UCP, AP2, x402 o MPP |

Poder usar tu sitio pesa 70 de los 100 puntos, así que los arreglos de esa parte suelen mover más tu nota.

## ¿Qué significa mi nota?

Es la escala de Ora:

| Nota | Puntaje | Qué quiere decir |
| --- | --- | --- |
| A+ | 95 a 100 | Vas adelante |
| A | 86 a 94 | Listo para agentes |
| B | 70 a 85 | Competitivo |
| C | 48 a 69 | Le falta trabajo |
| D | 28 a 47 | En riesgo |
| F | 0 a 27 | Los agentes casi no lo pueden usar |

En el ejemplo de la [página del radar](https://usepeaje.com/radar), un sitio con 46 (D) podría llegar a unos 74 (B) con el kit.

## ¿Qué es "los agentes entienden 14 de 29 cosas"?

Es la frase que abre tu resultado. El primer número son los chequeos que tu sitio pasa, y el segundo, los que aplican a tu sitio y se pudieron medir. Por eso el total cambia de un sitio a otro, y lo que no se pudo medir ese día queda en "No se pudo medir" y no cuenta ni a favor ni en contra.

## ¿Cómo se calcula el número "con Peaje"?

Suma a tu puntaje de hoy los puntos de cada chequeo que falla y que el kit de Peaje puede arreglar, como el llms.txt, el JSON-LD o el servidor MCP, sin pasar de 100. Lo que el kit no cubre, como el texto de tus páginas o tu checkout, no entra en esa cuenta. Si tu sitio ya pasa todo lo que cubre el kit, el radar te lo dice.

## ¿Cómo leo el resto del resultado?

- **Lo que falta:** cada arreglo con los puntos que suma (+6, por ejemplo), ordenado primero por lo más fácil y, dentro de eso, por lo que más sube tu puntaje.
- **Lo que responde la IA:** el radar les hace a ChatGPT y a Claude hasta 3 preguntas de alguien que busca lo que ofreces, sin nombrar tu marca, y te muestra si te citan, si te nombran sin enlace o si no apareces, y a quién citan en tu lugar. Esa parte se guarda 7 días.
- **Lo que ya haces bien:** los chequeos que pasas.

Puedes compartir el resultado con un enlace, por ejemplo con quien maneja tu web. Si la medición tiene más de 7 días, el radar te avisa que tu sitio puede haber cambiado.

## ¿Mi puntaje dice si ChatGPT me recomienda?

No del todo. El puntaje mide si un agente puede leer y usar tu sitio, que es la base, y las preguntas a ChatGPT y a Claude son una foto de ese día. Que te citen depende además de tu contenido y de lo que dicen de ti otros sitios, y las respuestas cambian de un día a otro. Eso lo sigue el agente Pro, con 20 preguntas cada semana ([cómo sé si me citan](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio)).

## ¿Cómo subo mi puntaje?

Empieza por lo que el radar pone arriba en "Lo que falta". El kit de Peaje es gratis y resuelve buena parte: lo sacas registrando tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y lo instalas desde tu panel, con un texto para tu herramienta de IA o con un comando. Después vuelves a medir en el [radar](https://usepeaje.com/radar), que no tiene límite de mediciones más allá de 6 por hora.

## Fuentes

- [Metodología de Ora](https://ora.ai/methodology?view=full)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
