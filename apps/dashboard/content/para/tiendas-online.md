---
title: "Peaje para tiendas online: que ChatGPT y Claude encuentren tus productos y tus precios"
description: Qué le preguntan tus compradores a ChatGPT y Claude antes de elegir tienda, qué revisa Peaje en una tienda online y qué arreglos te deja listos tu agente. Con lo que todavía no hace.
date: 2026-11-22
updated: 2026-11-22
slug: tiendas-online
lang: es
corto: Tiendas online
orden: 3
traduccion: online-stores
---

# Peaje para tiendas online: que ChatGPT y Claude encuentren tus productos y tus precios

Cada vez más gente le pide a ChatGPT o a Claude que le diga dónde comprar algo. El asistente busca en la web, lee unas cuantas páginas y nombra dos o tres tiendas. Si no puede leer tus fichas o no encuentra tus precios, recomienda a otra. Peaje revisa qué ve un asistente cuando llega a tu tienda, mide si te nombra cuando alguien busca lo que vendes y te deja los arreglos listos para que los publiques.

## Lo que tus compradores le preguntan a la IA

Nadie escribe el nombre de tu tienda, escriben lo que necesitan:

- ¿Dónde compro café de especialidad en grano con envío a todo el país?
- ¿Qué tienda online vende zapatillas para correr originales en Colombia?
- Mejores tiendas de ropa sostenible para mujer con envío gratis
- ¿Dónde consigo repuestos de bicicleta con entrega en dos días?
- ¿Qué tienda vende cosmética natural sin crueldad animal a buen precio?
- Regalo para alguien que ama cocinar por menos de 50 dólares
- ¿Qué tiendas en línea aceptan devoluciones gratis dentro de 30 días?

El Radar gratis escribe tres preguntas así a partir de lo que vende tu sitio, se las hace a ChatGPT y a Claude y te muestra a qué tiendas y páginas citan en tu lugar. Si le dices dónde están tus clientes, las escribe como las escribiría alguien de ese país.

## Qué revisa Peaje en una tienda

Estos son los chequeos del Radar que más pesan en una tienda:

- **Si tus precios se ven.** Si un agente no encuentra cuánto cuesta algo, no te puede recomendar para una compra.
- **Si tus fichas se ven sin JavaScript.** Muchas tiendas arman la página en el navegador, y como la mayoría de los robots de IA no ejecutan JavaScript, ven una página en blanco.
- **Si tu protección contra robots deja pasar a los buscadores de IA.** Es común en tiendas que usan Cloudflare: la opción que bloquea bots de IA también frena a los que citan.
- **Si tu robots.txt bloquea a ChatGPT, Claude o Perplexity.** Si los bloquea, no te pueden citar con un enlace a tu tienda.
- **Si tus páginas tienen su imagen y sus datos básicos (Open Graph).** Sin ellos, la IA puede citar mal tu producto.
- **Si tu mapa del sitio dice cuándo cambió cada página.** En una tienda con precios y stock que cambian, eso les avisa qué volver a leer.
- **Si tienes páginas de quiénes somos, contacto y privacidad.** Los agentes las buscan para confirmar que eres una tienda real.

Te da tu puntaje de hoy, hasta dónde puede subir y por dónde empezar.

## Qué arreglos te prepara tu agente

Con Pro, tu agente mide {{preguntas}} preguntas de compra de tu tienda en ChatGPT y Claude y deja cada arreglo como una tarea:

- **Una página para cada pregunta donde no sales.** Si para "mejores tiendas de ropa sostenible" la IA cita listas de "las mejores", el borrador sale con esa forma: criterios claros, tu tienda entre las opciones de forma honesta y una tabla. Usa solo datos de tu sitio, con al menos un número real (un precio, un plazo de envío) y una fecha visible, y son hasta {{paginas}} borradores al mes.
- **Dejar pasar a los bots que citan.** Si tu robots.txt o tu firewall bloquea al bot de ChatGPT o de Claude, la tarea dice qué línea agregar o qué opción apagar.
- **Poner al día las páginas viejas.** Si una guía de tallas o una página de envíos no muestra fecha o tiene meses, la tarea pide revisar precios y datos y poner la fecha de actualización.
- **Que te nombren afuera.** Cuando la IA cita una lista de terceros, un blog de reseñas o un foro para una pregunta donde no sales, el agente arma un pedido corto para que te incluyan. Lo mandas tú, y el agente nunca paga por aparecer ni pide reseñas falsas.
- **Si conectas Search Console:** reescribir el título de una ficha que Google muestra y nadie abre, o mejorar una que se quedó atrás.

El kit gratis pone los datos de tu tienda en la portada (nombre, logo, teléfono, dirección, perfiles), una guía para agentes (llms.txt) y un robots.txt que deja pasar a los buscadores de IA.

## Lo que Peaje no hace

- Mide solo ChatGPT y Claude. No mide Gemini, Perplexity ni las AI Overviews de Google.
- El kit no escribe el schema Product de cada ficha: pone los datos de tu negocio en la portada, y los de cada producto quedan en manos de tu plataforma o de quien maneja tu tienda.
- El comando del kit reconoce sitios hechos con Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express y Vite. Si tu tienda está en otra plataforma, el kit queda en una carpeta con las piezas para poner a mano, y lo que puedas poner depende de lo que tu plataforma te deje editar.
- Tu agente no toca tu tienda: prepara cada cambio, tú das el sí y lo publicas tú, tu desarrollador o tu herramienta de código.
- No garantizamos que te citen, pero Peaje vuelve a medir cada arreglo a las 2 y a las 6 semanas, y ahí ves si funcionó.

## Preguntas frecuentes

### ¿Sirve Peaje si mi tienda está en una plataforma como Shopify o Wix?

El Radar sí, porque mide cualquier sitio público sin importar en qué está hecho. El kit se instala con un comando en sitios con Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express y Vite. En otras plataformas te deja las piezas para pegar a mano y tú decides qué te deja poner tu plataforma.

### ¿Peaje cambia los precios o las fichas de mi tienda?

No. Tu agente te dice qué falta y te deja el cambio escrito, y nada se publica sin tu sí: lo publicas tú, tu desarrollador o tu herramienta de código.

### ¿Cuánto cuesta?

El Radar y el kit son gratis, y el agente es Pro: US${{founder}} al mes de precio de fundador para los primeros {{cupos}} negocios, que mantienes mientras sigas suscrito, y después US${{pro}} al mes. Al crear tu cuenta tienes un paquete gratis de {{regaloInformes}} informes y {{regaloRespuestas}} respuestas para probarlo.

### ¿Cada cuánto vuelve a medir?

Cada arreglo se vuelve a medir a las 2 y a las 6 semanas, con las mismas preguntas. Las respuestas de la IA cambian de un día a otro, así que una sola medición no alcanza para sacar conclusiones.

### ¿Puedo cancelar si no me sirve?

Sí, desde tu panel y sin llamadas. Si es tu primer pago y lo pides dentro de {{dias}} días, te lo devolvemos completo.

## Guías para tu tienda

- [¿Por qué ChatGPT da información equivocada de mi negocio y cómo la corrijo?](https://usepeaje.com/blog/por-que-chatgpt-da-informacion-equivocada-de-mi-negocio-y-como-la-corrijo)
- [¿Qué bots de IA visitan mi web y cómo los dejo pasar?](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)
- [¿Cómo añado llms.txt y JSON-LD para que la IA entienda mi web?](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web)
