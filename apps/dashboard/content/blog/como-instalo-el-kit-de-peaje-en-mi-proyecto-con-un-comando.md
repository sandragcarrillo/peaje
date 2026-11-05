---
title: "¿Cómo instalo el kit de Peaje en mi proyecto con un comando?"
description: Referencia del comando del kit de Peaje, qué necesitas, qué archivos toca en cada stack, sus opciones, los códigos de salida, cómo revisarlo y cómo deshacerlo.
date: 2026-11-03
slug: como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando
lang: es
categoria: Guía
portada: 3
portada_titulo: El kit en un comando
traduccion: how-do-i-install-the-peaje-kit-in-my-project-with-one-command
---

# ¿Cómo instalo el kit de Peaje en mi proyecto con un comando?

En la carpeta de tu proyecto, corre `npx @peaje/cli@1 init <slug> --yes`, donde `<slug>` es el identificador de tu sitio en Peaje. El comando reconoce tu stack y tu hosting, conecta tu sitio con Peaje y deja respondiendo en tu dominio el llms.txt, el openapi.json, el servidor MCP, las agent cards y el JSON-LD. Antes conviene correr `npx @peaje/cli@1 plan <slug>`, que te muestra cada archivo que tocaría sin cambiar nada.

Actualizado: noviembre de 2026

El kit es gratis, sin tarjeta y no vence, según la [página de precios](https://usepeaje.com/precios), y la CLI es código abierto con licencia MIT ([en npm](https://www.npmjs.com/package/@peaje/cli)).

## ¿Qué necesito antes de correrlo?

- **Node 20 o más nuevo.** La CLI no tiene dependencias.
- **Tu slug.** Registra tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y entra a "Kit" en el menú de tu panel. La página está en `usepeaje.com/t/<slug>/kit` y trae los comandos con tu slug ya puesto.
- **Estar en la carpeta de tu sitio.** En un monorepo con varios sitios, el comando se detiene y te pide la carpeta con `--dir`.

Si prefieres que lo haga tu herramienta de IA, la misma página del kit tiene un texto para pegarle a Claude Code, Cursor o Codex, que corre estos comandos por ti y te muestra la lista antes de cambiar nada ([el paso a paso](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web)).

## ¿Qué comandos hay?

| Comando | Qué hace |
| --- | --- |
| `npx @peaje/cli@1 plan <slug>` | Lista lo que crearía, editaría o movería, sin escribir nada |
| `npx @peaje/cli@1 init <slug> --yes` | Instala el kit en tu proyecto |
| `npx @peaje/cli@1 verify <slug>` | Revisa en tu dominio publicado que todo responda |
| `npx @peaje/cli@1 clean <slug>` | Solo mueve las copias viejas que tapan al kit a `.peaje-backup/` |

El `@1` fija la versión mayor, para que una versión futura no cambie lo que hace un script que ya tienes.

## ¿Qué archivos toca?

Depende de tu stack:

- **Next.js:** envuelve tu `next.config` con `withPeaje()`, crea `proxy.ts` (Next 16) o `middleware.ts` (versiones anteriores), agrega `<PeajeHead />` en el `<head>` de tu layout raíz y suma `@peaje/next` a tu `package.json`.
- **Vite en Vercel:** crea un `middleware.ts` en la raíz y suma `@peaje/proxy`.
- **Express y Hono:** agrega una línea `app.use(...)` justo después de crear tu app, si la encuentra sin dudas. Si no, te imprime las dos líneas para que las pongas tú.
- **Astro y SvelteKit:** te imprime las líneas para tu middleware.
- **En todos:** crea `public/robots.txt` si no tienes uno, y si tienes, le agrega un bloque entre `# peaje:begin` y `# peaje:end` que deja pasar a los bots que citan, sin tocar tus reglas.

También reconoce Nuxt, Remix, React Router y sitios estáticos, y en hosting reconoce Vercel, Cloudflare, nginx y Caddy. Si no reconoce tu stack, deja el kit completo en la carpeta `peaje/` para que lo pongas a mano.

## ¿Qué no toca?

No toca nada más. La CLI no corre tu gestor de paquetes (te imprime el comando de instalación), no borra archivos, no reescribe una configuración que no entiende y no edita tu footer. Si tienes copias propias de archivos que el kit sirve, como un `public/openapi.json`, las mueve a `.peaje-backup/` con la fecha.

También te avisa antes de escribir si alguna página tuya va a quedar tapada, porque el kit responde primero en rutas como `/docs`, `/developers`, `/mcp` y `/.well-known/`. Si tienes una página propia en `/docs`, muévela antes de publicar.

## ¿Qué opciones tiene?

| Opción | Para qué |
| --- | --- |
| `--yes` o `-y` | Instala sin pedir confirmación |
| `--dir <carpeta>` | Elige la carpeta del sitio en un monorepo |
| `--host next\|vercel\|cloudflare\|nginx\|caddy` | Fuerza el hosting si no lo detecta bien |
| `--only aeo` | Instala solo el robots.txt y la ficha de tu negocio en JSON-LD, sin proxy ni cobros |
| `--json` | Devuelve el resultado en JSON, para scripts y herramientas de IA |
| `--wait <segundos>` | Con `verify`, reintenta cada 15 segundos hasta ese tiempo |

## ¿Cómo sé si funcionó?

Publica tu sitio y corre `npx @peaje/cli@1 verify <slug> --wait 600`, que revisa en tu dominio el proxy, el JSON-LD, los links del `<head>`, el robots.txt y que los bots de los asistentes puedan leer tu sitio. Si lo corres justo después de lanzar el deploy, reintenta hasta 10 minutos. También lo ves en "Kit" en tu panel.

Los códigos de salida son 0 si todo salió bien, 1 si hubo un error o la verificación falló, 2 si hacía falta confirmar y no había terminal ni `--yes`, y 3 si no reconoció tu stack.

Hay un paso que la CLI te deja como manual: agregar `PEAJE_ORIGIN_SECRET` en las variables de entorno de tu hosting. Lo copias de la página del kit, y sin él tus rutas con precio no se cobran en tu dominio, aunque lo demás funciona.

## ¿Cómo lo desinstalo?

Revierte los archivos que el comando escribió (con git, un `git checkout` de los editados y borrar los nuevos), borra el bloque entre `# peaje:begin` y `# peaje:end` de tu robots.txt, devuelve a su lugar lo que quedó en `.peaje-backup/`, desinstala `@peaje/next` o `@peaje/proxy` y borra `PEAJE_ORIGIN_SECRET` de tu hosting. Después publicas, y tu sitio queda como estaba.

## Fuentes

- [CLI de Peaje en npm](https://www.npmjs.com/package/@peaje/cli)
- [Precios de Peaje](https://usepeaje.com/precios)
- [Registrar tu sitio en Peaje](https://usepeaje.com/nuevo)
