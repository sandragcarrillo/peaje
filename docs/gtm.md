# GTM de Peaje (1 oct 2026)

Sin infraestructura nueva. Se trata de empaquetar y contar lo que ya existe en tres pasos, y de construir solo lo mínimo para que cada promesa sea cierta.

## Posicionamiento
**Peaje deja tu sitio o tu API listo para agentes de IA: que te encuentren, te lean y, si quieres, te paguen.**

- Para quién, en orden: (1) APIs de datos que otros negocios y agentes consumen, en todo el mundo; (2) gente que construye su sitio con Claude Code, Cursor, Lovable o v0 y quiere que los asistentes la recomienden.
- Contra qué se compara: Otterly, Peec y RadarKit miden citas pero no instalan nada en tu sitio ni te dejan cobrar; Stripe MPP y Cloudflare cobran pero no te hacen encontrable y piden cuenta de Stripe o estar en Cloudflare. Peaje hace las dos cosas en cualquier hosting.
- Lo que no se dice: "sin tocar tu código", "retira cuando quieras" (mientras sea testnet), "los agentes te van a pagar" como promesa. El cobro es opcional y se presenta así.

## Los tres pasos

| Paso | Promesa | Ya existe | Falta para que sea cierto |
|---|---|---|---|
| 1. Radar (gratis, sin cuenta) | Pon tu dominio y mira tu puntaje de preparación para agentes hoy y hasta dónde llega con Peaje | Hecho (1 oct): página pública `/radar` con el score de Ora y la previsión del kit, el mismo del dashboard. No cuesta nada de correr | Sin preguntas a asistentes: se descartó porque costaba US$0,30 a 0,40 por dominio y nadie paga por eso |
| 2. Instala Peaje (gratis, 2% si cobras) | Un comando deja tu sitio legible para agentes; cada ruta con precio opcional, incluido 0 | CLI, `@peaje/next`, `@peaje/proxy`, llms.txt, openapi, MCP por negocio, agent card, directorio de Peaje, rutas a precio 0, 402 probado | Publicar npm; Kit reducido a un comando; decir "directorios" solo cuando haya registro real en MPPScan y en el registro de MCP |
| 3. AEO Bot (Pro, con tarjeta) | El agente que te hace encontrable para asistentes y para agentes que pagan: páginas, descripciones, verificación en vivo, remedición, prueba de pago en tu dominio | Plan, borradores, tareas por MCP y CLI, verificación, seguimiento a 2 y 6 semanas, Telegram, comprador misterioso | Pago con tarjeta (Paddle); plan con costo sano |

## Precio
- Radar: gratis.
- Instalar: gratis. 2% solo de lo que cobres a agentes.
- AEO Bot: US$29 al mes con tarjeta, 14 días de prueba. Para que deje margen: 10 preguntas medidas cada dos semanas con modelo barato (costo cerca de US$11, margen cerca de 60%). Más preguntas o medición semanal: plan de US$79 más adelante.
- Founder US$19: quitarlo o dejarlo solo como cupón de lanzamiento por 3 meses. A ese precio y con la configuración actual pierde plata.

## Landing (propuesta de texto)

**ES**
- Eyebrow: LISTO PARA AGENTES DE IA
- Titular: Tu sitio ya existe. / Los agentes no lo encuentran. / Peaje lo arregla.
- Texto: Peaje deja tu sitio o tu API listo para agentes de IA: que te encuentren, te lean y, si quieres, te paguen por cada pedido. Empieza gratis mirando cómo te ven hoy.
- Botón principal: MIRA CÓMO TE VEN LOS AGENTES (va al radar)
- Botón secundario: INSTALAR PEAJE
- Tres pasos:
  1. **Mira tu radar.** Pon tu dominio. En un minuto ves si ChatGPT, Perplexity y Claude te citan y si los bots pueden leerte. Gratis, sin cuenta.
  2. **Instala Peaje.** Un comando. Tu sitio queda legible para agentes y cada ruta puede tener precio, incluido cero. Cobrar es opcional.
  3. **Activa el AEO Bot.** Te dice qué publicar, lo escribe, se lo pasa a tu herramienta de IA y mide si funcionó. US$29 al mes.
- Línea de precio: Instalar es gratis. Si cobras a agentes, Peaje se queda con el 2%. Hoy los pagos corren en redes de prueba.

**EN**
- Eyebrow: READY FOR AI AGENTS
- Headline: Your site already exists. / Agents cannot find it. / Peaje fixes that.
- Text: Peaje gets your site or API ready for AI agents: they find you, read you and, if you want, pay you per request. Start free by seeing how they see you today.
- Primary button: SEE HOW AGENTS SEE YOU
- Secondary button: INSTALL PEAJE
- Steps:
  1. **Check your radar.** Enter your domain. In a minute you see whether ChatGPT, Perplexity and Claude cite you and whether bots can read you. Free, no account.
  2. **Install Peaje.** One command. Your site becomes readable by agents and every route can have a price, including zero. Charging is optional.
  3. **Turn on the AEO Bot.** It tells you what to publish, writes it, hands it to your AI coding tool and measures whether it worked. US$29 a month.
- Price line: Installing is free. If you charge agents, Peaje keeps 2%. Payments run on test networks today.

## Embudo
Radar (dominio) → resultado con 3 problemas concretos y un botón → registro con email → un comando de instalación → verificación en verde → oferta de AEO Bot con prueba de 14 días → pago con tarjeta.

Métricas, primeros 30 días: 100 radares, 20 registros, 10 instalaciones verificadas, 3 pagos. Si los radares no convierten a registro, el problema es el resultado del radar, no el tráfico.

## Canales
1. **El radar como gancho compartible.** Cada resultado con URL pública e imagen para redes. Correr el radar por adelantado para listas conocidas (los 43 servicios de mpp.dev, vendedores del Bazaar, APIs de RapidAPI, lanzamientos de Product Hunt) y escribirles con su resultado.
2. **Un texto con los datos de la revisión:** el comercio x402 mediano gana US$0,06 al mes porque nadie lo encuentra. Sin hype, con fuentes. En inglés para X y en español para LinkedIn y Substack de San.
3. **Donde ya están los que construyen:** Discords de x402, MPP, Tempo y Coinbase; foros de Cursor, Lovable y v0; Indie Hackers.
4. **Distribución por instalación:** README de npm con enlace al radar; un prompt listo para pegar en Claude Code o Cursor ("deja mi sitio listo para agentes con Peaje").
5. **Hackathons** como fechas de lanzamiento: Arbitrum (3 oct) y Colosseum (12 oct).
6. **Diez conversaciones** con dueños de APIs de datos y builders antes de invertir más (preguntas en `revision-producto-2026-10-01.md`).

## Qué construir, en orden
1. Landing y textos con los tres pasos; quitar promesas falsas; aviso de red de prueba; precio visible. Medio día. Antes del 3 de octubre.
2. Página pública de radar. Hecho el 1 oct, con el score y la previsión; sin medición de citas.
3. Kit en un comando y registro que lleva directo a instalar. 1 día.
4. AEO Bot con tarjeta (Paddle) y plan de 10 preguntas quincenales. 2 días más la revisión de Paddle.
5. Registro automático en MPPScan y en el registro de MCP, y recién ahí decir "directorios". 2 días.
