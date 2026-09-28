# El agente Pro: diseño (27 sep 2026)

## Decisiones (San, 27 sep)

- **El plan lo define el objetivo del negocio, no Peaje.** Al activar Pro el agente conversa con el dueño y saca tres cosas: objetivo principal (que ChatGPT, Claude y Perplexity lo recomienden para X; vender a agentes; ambos), qué puede hacer (publicar contenido, tocar código, solo config) y con qué cadencia quiere noticias (alertas diarias, resumen semanal o quincenal, o solo al preguntar). Con eso propone un plan de 3 a 6 pasos con entregable y métrica. Los reportes son avance sobre ese plan, en su cadencia. Nada de "las seis secciones cada semana" para todos.
- **El 402 tiene que salir en el dominio del negocio también para rutas de API.** Anunciar la URL del gateway era esconder que no cobraba en el dominio. Resuelto en el milestone 1 con proxy en tiempo de ejecución (Next) y patrones en los archivos de los demás hosts.
- **Bazaar de Coinbase fuera del plan.** 70% de los listados con un solo pagador; listar exige un riel de CDP más un pago. Se sigue leyendo para comparables y para que el comprador misterioso busque ahí.
- **Cobro mensual, no único.** El agente gasta API cada ciclo y el valor está en repetir. Founder US$9 (10 prompts, 3 motores, 1 corrida semanal, costo API ≈ US$2,5), Pro US$19 (20 prompts, 5 motores, 1 corrida semanal, costo ≈ US$4,5). Tres corridas semanales costaban US$10 por tenant y se descartaron; la varianza se lee comparando semanas. Prompts extra a US$0,50 al mes cada uno.
- **El paquete npm sirve para cualquier framework.** El reenvío vive donde se sirve el sitio (Vercel, Cloudflare, nginx, Caddy) y el kit ya genera esas configs. El núcleo del proxy (`crearProxyRuntime` en `@peaje/shared`) no depende de Next; `@peaje/next/proxy` lo envuelve y un `@peaje/proxy` para Express, Hono, Astro y SvelteKit sale de ahí.

Qué debe hacer el agente de Peaje Pro, apoyado en tres investigaciones hechas el 27 sep 2026: mercado y evidencia de AEO, descubrimiento y precios en comercio agéntico, y lo que ya existe en este repo. Las fuentes están al final. Sustituye la idea de "reporte semanal": el agente mide, propone una acción con el borrador listo, ejecuta cambios con aprobación y la semana siguiente dice si funcionó.

## 1. Lo que dice la evidencia

### AEO (que te citen ChatGPT, Perplexity, Google AI, Claude, Gemini)

Lo que la gente pregunta, en orden de frecuencia: cómo hacer que ChatGPT recomiende mi negocio; si `llms.txt` sirve; por qué AI Overviews bajó mi tráfico; cómo saber si me citan sin pagar US$99 al mes; si bloqueo GPTBot pierdo tráfico; si AEO es humo; si el tráfico de IA vale algo; si necesito schema; por qué el tráfico de IA sale como "Direct" en analytics.

Lo que mueve la citación, con datos:

| Factor | Evidencia | Consecuencia para el agente |
|---|---|---|
| Menciones de la marca en otros sitios | Ahrefs, 75k marcas: correlación 0,66 con visibilidad en IA, contra 0,22 de los backlinks. 84% de las citas son a terceros (Reddit, YouTube, listicles); 5 a 10% al sitio propio. | El gap que hay que cerrar es de fuentes: en qué hilo, video o lista tenés que aparecer. |
| Estadísticas, citas textuales y referencias a fuentes primarias en la página | Princeton GEO (KDD 2024): hasta 30 a 40% más visibilidad. Keyword stuffing no ayuda. | El borrador que entrega el agente lleva un dato propio, una cita atribuible y referencias. |
| Indexación en Bing | 87% de las citas de ChatGPT Search coinciden con el top 10 de Bing (n=500). | Verificar indexación en Bing es un chequeo de primer orden. |
| Frescura | Las URLs citadas son 25,7% más nuevas que el top 10 orgánico; sin fecha visible, 56% menos probabilidad. | Páginas clave sin actualizar en 12 meses o sin fecha, a la lista de arreglos. |
| Título y slug parecidos a la pregunta | Ahrefs, 1,4M prompts: slug natural 89,8% vs 81,1%. | El título de la página es la pregunta literal. |
| Sub-preguntas (fan-out) | Google confirma que AI Mode descompone la consulta. | Cada borrador cubre 3 a 5 sub-preguntas con párrafos autocontenidos. |
| Acceso real de los bots de respuesta | Bloquear GPTBot no toca el tráfico; bloquear OAI-SearchBot sí. El toggle "Block AI bots" de Cloudflare bloquea ambos. | Fetch con los UAs de OAI-SearchBot, PerplexityBot, Claude-SearchBot y Googlebot cada semana. |
| `llms.txt` | Mueller: "no AI system currently uses llms.txt". Ahrefs, 137k dominios: 97% nunca leídos. | Peaje lo sigue sirviendo (cuesta cero), pero el agente no lo vende como palanca. |
| JSON-LD / schema | Ahrefs, 1.885 páginas con JSON-LD vs 4.000 control: AIO -4,6%, AI Mode +2,4%, ChatGPT +2,2%. Ruido. | Igual que arriba. Sirve para la parte de pagos (WebAPI, ofertas), no para citación. |

Medir la citación cuesta poco: 20 prompts por 5 motores por 3 corridas a la semana cuesta entre US$2,6 y US$6,8 (Perplexity Sonar, OpenAI Responses con `web_search`, Gemini grounding, Claude `web_search`, DataForSEO para AI Overviews). Las herramientas que cobran US$29 a US$99 al mes (Otterly, Peec, Semrush AI Toolkit, Profound básico) hacen eso y nada más: ninguna genera el contenido que falta, ninguna verifica el acceso de los bots, ninguna vuelve a medir después del cambio.

### Comercio agéntico (que los agentes te encuentren, te elijan y te paguen)

- **La fuga es técnica antes que de precio.** Un vendedor sirvió 1.671 respuestas 402 en dos meses con cero pagos; bajó a US$0,001 durante 48 h y no cambió nada. De 97 servicios que declaran x402 en sus agent cards, 8 responden un 402 válido. Clientes que leen `accepts` del body cuando en v2 vive en el header. Consecuencia: primero el embudo 402 servido, 402 entendido (reintento con `PAYMENT-SIGNATURE`), pagado. El experimento de precio va al final.
- **Bazaar de Coinbase.** 15.874 recursos (17 sep 2026); 70,8% con un solo pagador; 8,7% con 10 o más llamadas en 30 días. Indexa solo tras un pago real por el facilitador de CDP con `extensions.bazaar` dentro del payload; deslista a los 30 días sin settlement. El ranking mezcla relevancia con `quality` (llamadas y pagadores únicos a 30 días). **Los negocios de Peaje no están listados**: Peaje liquida por su contrato y por Circle, no por el facilitador de CDP.
- **Precios.** Mediana del Bazaar US$0,01 por request, p10 US$0,001, p90 US$0,15. Los agentes compradores son más sensibles al precio que las personas (13 de 17 modelos prefieren lo más barato, ABxLab), pero eso es retail simulado; no hay ningún A/B publicado de precios para APIs máquina a máquina.
- **Descripciones.** 97% de las descripciones de tools MCP tienen algún defecto; mejorarlas sube el éxito 5,9 puntos mediana, pero más texto también puede empeorar. Descripción en inglés, parámetros con enums en inglés, cobertura LATAM dicha adentro del texto. Bazaar exige ASCII en `serviceName` y `tags`.
- **Comprador misterioso.** Nadie ejecuta una compra 402 real como test. Lo más cercano: Agent Checker (£19, navega un sitio retail), Jellyfish Agent Shopper (retail), Cloudflare Agent Readiness (chequeos estáticos). Un test creíble corre varias intenciones en 2 o 3 idiomas, con 2 o 3 modelos, y reporta rank, elección, y si pudo pagar.

## 2. Lo que hay en el repo y lo que falta

| Necesidad | Estado | Falta |
|---|---|---|
| Cambiar precio de una ruta | No existe `updateRoute`; borrar es soft delete y el índice único impide recrear. | `updateRoute` en el store y endpoint interno `/_internal/:slug/routes`. |
| Crear una ruta | `store.createRoute` y la server action `crearRuta` sin UI. | Endpoint interno + UI mínima en el dashboard. |
| Ruta de API en el dominio del negocio | El proxy del kit tiene paths fijos; una ruta `/api/x` solo cobra en `{gateway}/{slug}/api/x`, pero llms.txt, openapi y Bazaar la anuncian en el dominio del negocio. | Decidir: anunciar la URL del gateway para rutas de API (inmediato, sin redeploy del cliente) o hacer dinámicos los rewrites (redeploy del cliente en cada ruta nueva). |
| Embudo 402 → pago | `agent_visits` guarda path, UA, tipo, pagado, status. No guarda precio mostrado, `route_id` ni un id de challenge. | Columnas `route_id`, `price_usd`, `challenge_id` (nonce del 402) y detección de reintento con firma. |
| Comprador con misión | `POST /_internal/:slug/agents/:id/run { mission, url? }` existe. Descubre por directorio propio, Bazaar y ERC-8004. | Modo "misterioso": correr sin pagar (ask), registrar rank y elección, y opcionalmente pagar US$0,001. |
| Listado en Bazaar | Solo lectura del Bazaar. | Un riel `cdp` (facilitador de Coinbase, Base Sepolia) y un pago semanal del propio comprador con `extensions.bazaar`. |
| Medición de citación | Nada. | Tabla `prompts` y `citaciones`; clientes de Sonar, OpenAI, Gemini, Claude, DataForSEO. |
| Acceso de bots | El verificador ya detecta WAF/challenge con un UA genérico. | Fetch con cada UA de bot de respuesta; chequeo de indexación en Bing. |
| Canal de comandos | Formulario Ask del comprador en el dashboard. Sin Telegram. | Router de intenciones (Opus con tools) detrás de un chat en el dashboard; Telegram encima (M7). |

## 3. Qué hace el agente en cada ciclo

Reemplazado por la decisión de arriba: el contenido de cada ciclo depende del plan del negocio. Las piezas que el agente sabe producir son estas; el plan elige cuáles y en qué orden:

1. **Resultado de la semana pasada.** Qué se publicó o cambió, y si movió la citación o el embudo (se re-mide a 2 y 6 semanas). Sin esto es un newsletter.
2. **Una acción, con el borrador listo.** La página o sección completa en markdown: título igual a la pregunta, un dato propio, una cita atribuible, referencias, 3 a 5 sub-preguntas, fecha visible, slug natural. O una respuesta para un hilo concreto de Reddit o una petición de inclusión en un listicle concreto, si el gap es de fuentes.
3. **Cuota de citación.** Por prompt: quién aparece (vos, competidores, Reddit, YouTube, listicles), en qué motores, con varianza entre corridas. Solo los prompts donde cambió algo.
4. **Acceso y frescura.** Bots bloqueados, Bing sin indexar, páginas sin fecha o sin actualizar en 12 meses. Cada uno con el arreglo.
5. **Comercio agéntico.** Embudo 402 servido, entendido, pagado, por tipo de agente. Demanda no atendida: paths pedidos que no existen o que se vieron y no se pagaron 3 o más veces. Estado en Bazaar y días para el deslistado. Comparables de precio por categoría. Resultado del comprador misterioso: te encontró, te eligió, pudo pagar, y si no, por qué (descripción, precio, error del 402).
6. **Botones.** Cada propuesta ejecutable es un botón o un comando: aplicar precio, publicar ruta, cambiar descripción, agregar prompt, publicar página (vía CLI o PR).

## 4. Comandos y lenguaje natural

Un solo router: Opus con herramientas tipadas. Cada comando es una herramienta; el texto libre se mapea a la misma herramienta. Toda mutación se propone y espera confirmación ("sí", botón, `/ok`).

| Comando | Qué hace | Muta |
|---|---|---|
| `/status` | Score, chequeos, pagos 7d, embudo, Bazaar | no |
| `/report` | El reporte semanal ahora | no |
| `/prompts`, `/prompts add <texto>`, `/prompts rm <n>` | Los prompts que se miden | sí (sin confirmación, es config) |
| `/check <prompt>` | Corre ese prompt en los 5 motores ahora | no (cuesta ~US$0,10) |
| `/draft <pregunta>` | Borrador completo de la página | no |
| `/routes` | Rutas, precios, pagos 30d, conversión | no |
| `/price <path> <usd>` | Cambia el precio | sí |
| `/route add <method> <path> <usd> "<desc>"` | Publica una ruta que ya existe en el origen | sí |
| `/describe <path> "<texto>"` | Cambia la descripción | sí |
| `/shopper "<misión>"` | Comprador misterioso ahora | pagar US$0,001 sí, con confirmación |
| `/bots` | Acceso por UA y visitas por bot | no |
| `/bazaar` | Estado del listado | no |
| `/undo` | Revierte el último cambio (precio, descripción, ruta) | sí |

Ejemplos en lenguaje natural: "¿por qué nadie paga el forecast?" (embudo + comparables + descripción); "ponle 0,01 al forecast" (propone, confirma, aplica, agenda la re-medición); "¿qué escribo esta semana?" (acción 2 del reporte); "¿me está leyendo Perplexity?" (visitas por UA + citación en Sonar).

Canal inicial: chat en el dashboard reutilizando el patrón Ask del comprador. Telegram (M7) y responder al correo del reporte usan el mismo router.

## 5. Publicar rutas: cómo funciona desde cero

El kit no descubre ni crea rutas de API. El proxy reenvía paths fijos (llms.txt, openapi.json, developers, well-known, `/r/:slug`). Las rutas con precio viven en la tabla `routes` y hoy solo cobran en el dominio del gateway.

Tres casos:

1. **La ruta ya existe en el origen** (por ejemplo `/api/forecast`). El agente la agrega a `routes` con precio y descripción; los catálogos (openapi, llms.txt, developers, discovery, MCP) se regeneran en vivo, sin re-correr el kit. Para que cobre en el dominio del negocio hace falta que el proxy la reenvíe: con `withPeaje()` en Next.js se puede leer el manifiesto del gateway en `rewrites()` al build, lo que exige un redeploy del cliente por cada ruta nueva. Alternativa sin redeploy: anunciar la URL del gateway para rutas de API. Propuesta: anunciar la URL del gateway ahora y agregar los rewrites dinámicos después.
2. **Los agentes piden algo que no existe** (6 agentes pidieron `/v1/historical`). El agente no puede crear código en el origen. Entrega el handler listo (Next.js route handler o Express) con la firma que los agentes pidieron, y la ruta queda en `routes` como "pendiente" hasta que el verificador la vea responder.
3. **El negocio no tiene API.** Los `resources` (links con precio, `/r/:slug`) ya funcionan en el dominio del negocio vía el proxy, tienen upsert por slug, y se importan desde el sitemap. El agente propone qué páginas cobrar y a cuánto.

## 6. Orden de construcción

Un milestone por vez, commit de San entre cada uno.

1. **Datos del embudo y rutas, y 402 en el dominio** (hecho 27 sep): `updateRoute`, API interna `/_internal/:slug/routes`, `agent_visits` con `route_id`, `price_usd`, `attempted`; embudo y demanda no atendida en el dashboard; panel de rutas de API; manifiesto con patrones; `@peaje/next/proxy` (runtime, 60 s de caché) y patrones en Next, Vercel, nginx, Caddy y el Worker. Verificado en prod con clima-andino.
2. **Onboarding y plan** (1 día): conversación inicial (objetivo, alcance, cadencia), tabla `planes` con pasos, entregable y métrica; el reporte pasa a ser avance del plan.
3. **Citación** (1 día): tablas `prompts` y `citaciones`, clientes de los motores según tier, generación inicial de prompts, share of voice y gap de fuentes.
4. **Acceso y frescura** (medio día): fetch por UA de bot de respuesta, Bing, fechas.
5. **Borrador y ciclo** (1 día): generador GEO completo, re-medición a 2 y 6 semanas, resultado del ciclo anterior al frente.
6. **Comprador misterioso** (1 día): modo ask del comprador con misiones generadas, registro de rank y elección, pago opcional de US$0,001. Sin listado en Bazaar.
7. **Comandos** (1 día): router Opus con tools, chat en el dashboard, confirmación y `/undo`. Telegram encima en M7.
8. **Experimentos de precio** (después, cuando el embudo tenga datos): bandas p10 a p90 del Bazaar, brazos por challenge.

## Fuentes

AEO: arxiv.org/abs/2311.09735 (Princeton GEO); ahrefs.com/blog/ai-overview-brand-correlation; ahrefs.com/blog/why-chatgpt-cites-pages; ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content; ahrefs.com/blog/schema-ai-citations; ahrefs.com/blog/llmstxt-study; seerinteractive.com/insights/87-percent-of-searchgpt-citations-match-bings-top-results; searchengineland.com/google-says-normal-seo-works-for-ranking-in-ai-overviews-and-llms-txt-wont-be-used-459422; developers.google.com/search/docs/appearance/ai-features; cresva.ai/guides/oai-searchbot-robots-txt-chatgpt-visibility; dataforaisearch.com/learn/cloudflare-gptbot-trap; blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry; docs.perplexity.ai/getting-started/pricing; developers.openai.com/api/docs/pricing; ai.google.dev/gemini-api/docs/pricing; platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool; dataforseo.com/pricing/google-serp/google-ai-mode-serp-api; peec.ai/pricing; semrush.com/pricing/ai; hubspot.com/ai-search-grader; blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview.

Comercio agéntico: docs.cdp.coinbase.com/x402/seller/get-discovered; docs.cdp.coinbase.com/x402/bazaar; github.com/nunojsferreira/x402-bazaar-explorer; dev.to/coachhype/what-it-takes-to-get-an-x402-seller-counted-by-the-coinbase-bazaar-and-a-025-usdc-thank-you-for-5cbm; dev.to/nathanielc85523/we-got-1671-agent-probes-and-zero-payments-heres-what-the-conversion-trace-showed-46lh; dev.to/ofirbaranesadagent/im-an-ai-agent-with-a-price-list-i-measured-why-nobody-could-pay-me-40ci; apievangelist.com/2026/09/21/97-agent-cards-say-x402-eight-of-them-answer-a-402; arxiv.org/html/2509.25609 (ABxLab); arxiv.org/abs/2508.02630; arxiv.org/abs/2602.14878 (MCP tool descriptions); anthropic.com/engineering/writing-tools-for-agents; blog.cloudflare.com/agent-readiness; agentchecker.ai; jellyfish.com/en-us/blog/brand-discovery-is-being-reshaped-by-ai; mpp.dev; eips.ethereum.org/EIPS/eip-8004.
