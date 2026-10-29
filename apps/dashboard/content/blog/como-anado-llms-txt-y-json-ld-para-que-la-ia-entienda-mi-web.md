---
title: "¿Cómo añado llms.txt y JSON-LD para que la IA entienda mi web?"
description: El prompt para tu herramienta de IA o el comando que genera llms.txt, JSON-LD y el resto del kit para tu sitio, qué hace cada archivo y cómo revisar que quedó bien.
date: 2026-10-28
slug: como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web
lang: es
categoria: Guía
portada: 1
portada_titulo: llms.txt y JSON-LD
traduccion: how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site
---

# ¿Cómo añado llms.txt y JSON-LD para que la IA entienda mi web?

El kit de Peaje es gratis y lo sacas registrando tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo). Desde ahí tienes dos caminos. Si usas Claude Code, Cursor u otra herramienta de IA que edita tu código, en tu panel hay un texto listo para pegarle: revisa tu proyecto, te muestra qué va a cambiar y no toca nada hasta que le digas que sí. Si prefieres la terminal, son dos comandos: `npx @peaje/cli@1 plan <slug>` te muestra qué archivos va a crear o cambiar sin escribir nada, y `npx @peaje/cli@1 init <slug> --yes` los instala cuando estás de acuerdo. Con cualquiera de los dos quedan llms.txt, JSON-LD, openapi.json, un servidor MCP y agent cards hechos para tu sitio.

Actualizado: octubre de 2026

El kit genera esos cinco archivos por US$0 y sin tarjeta, según la [página de precios](https://usepeaje.com/precios), y no vence.

## ¿Qué pasos sigo?

1. Mide tu sitio en el [radar gratis](https://usepeaje.com/radar), que tarda menos de un minuto y solo pide tu correo y tu dominio.
2. [Registra tu sitio](https://usepeaje.com/nuevo) con el mismo correo. En el inicio de tu panel, el botón "Instalar el kit" te lleva ahí; después lo encuentras en el menú, en "Kit", o en `usepeaje.com/t/<slug>/kit`. Ahí está todo listo, con el identificador de tu sitio (el slug) ya puesto.
3. Elige cómo instalarlo:
   - **Con tu herramienta de IA:** en la pestaña "Usa tu herramienta de IA", copia el texto y pégaselo a Claude Code, Cursor, Codex, Copilot o Windsurf abierto en tu proyecto. Primero te muestra la lista de archivos y el cambio en cada uno, y no edita nada hasta que le digas que sí.
   - **Tú en la terminal:** en la carpeta de tu proyecto corre `npx @peaje/cli@1 plan <slug>`, que te lista cada archivo que crearía, editaría o movería sin tocar nada. Si la lista te sirve, corre `npx @peaje/cli@1 init <slug> --yes` y revisa el cambio con `git diff`.
4. Publica y vuelve a "Kit" en tu panel, que revisa que todo responde en tu sitio (desde la terminal es `npx @peaje/cli@1 verify <slug>`). Si algo no quedó, ahí mismo Peaje mide tu dominio y te arma un prompt solo con eso, para que se lo pegues a tu herramienta otra vez.

## ¿Qué genera el kit y para qué sirve cada archivo?

- **llms.txt:** una guía de tu sitio escrita para los agentes, con qué vendes y dónde está cada cosa.
- **JSON-LD:** tus datos (nombre, qué vendes, precios) en un formato que ChatGPT y Claude leen sin adivinar.
- **openapi.json:** la descripción de tu API, si tienes una, para que un agente la pueda usar.
- **Servidor MCP:** la forma en que un agente se conecta a tu negocio para usar lo que ofreces.
- **Agent cards:** la ficha que dice quién eres y qué puede hacer un agente contigo.

## ¿Con qué sitios funciona?

El comando reconoce Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express y Vite, y en hosting reconoce Vercel, Cloudflare, nginx y Caddy. Si tu sitio usa otra cosa, deja el kit completo en una carpeta `peaje/` con lo que hay que poner a mano: el archivo del proxy para tu hosting, el bloque para el `<head>` de tu portada y el robots.txt. En un monorepo te pide que le digas con `--dir` cuál es la carpeta del sitio. El texto para tu herramienta de IA también sirve en Lovable, v0 o Bolt si tu sitio es Next.js, o Vite publicado en Vercel.

## ¿Cómo reviso que quedó bien?

Pasa el radar otra vez sobre tu dominio. Te da tu puntaje de hoy, lo que falla y hasta dónde puede llegar, y en el ejemplo de la página del radar un sitio pasa de 46 a cerca de 74 con los arreglos. Después el monitor revisa tu sitio todos los días y te avisa si algo se rompe, y el registro de visitas te dice qué agentes llegaron a leer esos archivos.

## ¿Necesito saber programar?

No. Si usas Claude Code o Cursor, le pegas el texto que está listo en tu panel y él hace el resto, y si no, se lo pasas a quien maneja tu web. Ese texto le pide a tu herramienta que no haga commit ni publique, y el kit tampoco lo hace por su cuenta: eso lo decides tú.

## ¿Cuánto cuesta y qué viene después?

El radar y el kit son gratis, sin tarjeta. Si quieres un agente que te diga qué te falta, escriba esas páginas y mida si ChatGPT y Claude te citan, eso es Pro: US$30 al mes de precio de fundador para los primeros 50 negocios, y US$69 después, con 500 créditos al mes para el trabajo del agente y 20 preguntas seguidas en asistentes de IA. Hablar con tu agente no gasta créditos.

## Fuentes

- [Precios de Peaje](https://usepeaje.com/precios)
- [Peaje: cómo funciona](https://usepeaje.com/)
- [Radar gratis](https://usepeaje.com/radar)
- [CLI de Peaje en npm](https://www.npmjs.com/package/@peaje/cli)
