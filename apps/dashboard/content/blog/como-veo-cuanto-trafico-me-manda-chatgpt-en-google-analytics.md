---
title: "¿Cómo veo cuánto tráfico me manda ChatGPT en Google Analytics?"
description: Dónde ver en Google Analytics 4 las visitas que llegan desde ChatGPT, Gemini, Claude y Perplexity, cómo juntarlas en un canal propio y por qué los bots de IA no salen ahí.
date: 2026-11-07
slug: como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics
lang: es
categoria: Guía
portada: 3
portada_titulo: ChatGPT en Google Analytics
traduccion: how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics
---

# ¿Cómo veo cuánto tráfico me manda ChatGPT en Google Analytics?

En Google Analytics 4 entra a Informes, Adquisición, Adquisición de tráfico, cambia la dimensión a "Fuente / medio de la sesión" y escribe chatgpt en la búsqueda de la tabla. Además, GA4 tiene un canal llamado AI Assistant que junta las visitas que llegan desde asistentes como ChatGPT, Gemini y Claude. Eso cuenta a las personas que hacen clic en un enlace, y los bots de IA que leen tu sitio quedan fuera de GA.

Actualizado: noviembre de 2026

El 13 de mayo de 2026 Google Analytics agregó el canal AI Assistant, según su [página de novedades](https://support.google.com/analytics/answer/9164320?hl=es-419): cuando el sitio que manda la visita coincide con un asistente de IA reconocido, GA le asigna el medio `ai-assistant`, la campaña `(ai-assistant)` y el canal AI Assistant.

## ¿Dónde veo las visitas que llegan desde ChatGPT?

En el informe de adquisición de tráfico, en tres pasos:

1. Ve a **Informes > Adquisición > Adquisición de tráfico**. La tabla sale agrupada por "Grupo de canales predeterminado de la sesión", y ahí aparece la fila AI Assistant si tuviste visitas desde asistentes.
2. Para saber de cuál vino cada visita, cambia la dimensión a **Fuente / medio de la sesión**, o agrégala como dimensión secundaria con el botón +.
3. Escribe `chatgpt` en la barra de búsqueda de la tabla y presiona Enter. Haz lo mismo con `gemini`, `claude` o `perplexity`.

Buscar la palabra te sirve aunque cambie cómo llega marcada la visita.

Ten en cuenta que el canal AI Assistant deja fuera los AI Overviews y el AI Mode de Google, que GA cuenta dentro de "Organic Search". Si te interesa ese tráfico, revisa [cómo aparezco en los AI Overviews de Google](https://usepeaje.com/blog/como-aparezco-en-los-ai-overviews-de-google).

## ¿Qué asistentes reconoce Google Analytics?

Google no publica la lista completa, y lo que nombra en su ayuda cambia según la página:

| Asistente | Dónde lo nombra Google |
| --- | --- |
| ChatGPT | En la definición del canal AI Assistant y en el anuncio |
| Gemini | En la definición del canal y en el anuncio |
| Claude | En el anuncio del canal |
| Copilot, Deepseek y Grok | En la definición del canal |
| Perplexity | En ninguna de las dos, solo en su ejemplo de grupo de canales personalizado |

Si Perplexity te importa, o quieres controlar tú qué cuenta como IA, arma un grupo de canales propio.

## ¿Cómo junto ChatGPT, Perplexity, Claude y Gemini en un solo canal?

Con un grupo de canales personalizado, que se aplica también a tus datos anteriores:

1. En **Administrar**, en Visualización de datos, haz clic en **Grupos de canales** y luego en **Crear grupo de canales**. Arranca como copia del grupo predeterminado.
2. Haz clic en **Agregar nuevo canal**, llámalo "Asistentes de IA" y ponle la condición Fuente coincide con RegEx, con algo como `chatgpt|openai|perplexity|claude|gemini|copilot`.
3. Con **Reorganizar**, pon tu canal arriba de "Referral" y de "Organic Search". Cada visita cae en el primer canal que coincide, y si tu canal queda abajo, las visitas de IA se quedan en el de arriba.
4. Guarda con **Guardar grupo** y elige ese grupo como dimensión en Adquisición de tráfico.

Necesitas rol de editor o superior en la propiedad. Una propiedad estándar admite 2 grupos personalizados, con hasta 50 canales cada uno, y las condiciones no distinguen mayúsculas de minúsculas. Si un asistente cambia de dominio, actualiza la expresión.

Si prefieres no tocar la configuración, en **Explorar** crea una exploración de **Formato libre**, pon "Fuente / medio de la sesión" y "Página de destino + cadena de consulta" como filas, "Sesiones" como métrica y filtra por fuente de la sesión que contenga chatgpt. Así ves a qué páginas llega la gente que viene de ChatGPT.

## ¿Por qué no veo a los bots de ChatGPT en Google Analytics?

Porque GA deja fuera el tráfico de bots conocidos de forma automática, según su [ayuda sobre exclusión de bots](https://support.google.com/analytics/answer/9888366?hl=es-419), y no te deja apagar esa exclusión ni ver cuánto tráfico sacó. OAI-SearchBot, que indexa para la búsqueda de ChatGPT, y ChatGPT-User, que abre tu página cuando una persona se lo pide a ChatGPT, son bots, y GA no tiene un informe para ver qué leyeron.

Para eso está el registro de visitas de agentes de Peaje, que viene en el plan gratis. Cuenta los pedidos a los archivos del kit y, con el proxy del kit instalado, también las páginas de tu sitio que leen OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot y GPTBot, cada uno por nombre, y el resto sale en "Otros". Las visitas desde un navegador no las cuenta como visitas de agentes, así que para las personas que llegan desde ChatGPT sigues necesitando GA. En usepeaje.com, el registro contó 1108 visitas de bots en 30 días: 225 de Googlebot, 197 de ClaudeBot y 133 de GPTBot.

Las dos cifras te dicen cosas distintas. Que un bot te lea quiere decir que puedes aparecer en las respuestas, y que una persona llegue desde ChatGPT quiere decir que ya apareciste y alguien hizo clic. Si quieres saber si te citan aunque nadie haga clic, mira [cómo sé si ChatGPT, Claude o Perplexity citan mi negocio](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio), y para dejar pasar a los bots, [qué bots de IA visitan mi web](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar).

## Fuentes

- [Google Analytics: novedades (canal AI Assistant, 13 de mayo de 2026)](https://support.google.com/analytics/answer/9164320?hl=es-419)
- [Google Analytics: grupo de canales predeterminado](https://support.google.com/analytics/answer/9756891?hl=es-419)
- [Google Analytics: grupos de canales personalizados](https://support.google.com/analytics/answer/13051316?hl=es-419)
- [Google Analytics: informe de adquisición de tráfico](https://support.google.com/analytics/answer/12923437?hl=es-419)
- [Google Analytics: exploración de formato libre](https://support.google.com/analytics/answer/9327972?hl=es-419)
- [Google Analytics: exclusión de bots conocidos](https://support.google.com/analytics/answer/9888366?hl=es-419)
- [OpenAI: bots y user-agents](https://developers.openai.com/api/docs/bots)
- [Precios de Peaje](https://usepeaje.com/precios)
