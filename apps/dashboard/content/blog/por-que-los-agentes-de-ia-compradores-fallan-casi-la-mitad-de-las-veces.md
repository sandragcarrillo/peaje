---
title: "¿Por qué los agentes de IA compradores fallan casi la mitad de las veces y qué puede hacer tu sitio?"
description: Qué midió el primer benchmark de Visa para agentes de IA que compran, por qué parte de las fallas empiezan en el sitio del comercio, qué controlas tú y qué puedes revisar esta semana.
date: 2026-11-08
slug: por-que-los-agentes-de-ia-compradores-fallan-casi-la-mitad-de-las-veces
lang: es
categoria: Noticia
portada: 2
portada_titulo: El benchmark de Visa
traduccion: why-do-ai-shopping-agents-fail-almost-half-the-time
---

# ¿Por qué los agentes de IA compradores fallan casi la mitad de las veces y qué puede hacer tu sitio?

Visa publicó el 5 de noviembre de 2026 el primer benchmark de la industria para agentes de IA que compran: puso a 22 modelos de 12 laboratorios en 15 escenarios de compra, con tres intentos cada uno, y el 57,2% de las pruebas pasaron. El benchmark califica al comprador, el modelo que habla con el cliente, elige un producto y decide si paga. Parte de lo que cuenta como falla empieza del otro lado, en el sitio que el comprador lee, y esa parte te toca a ti.

Actualizado: noviembre de 2026

Según el [comunicado de Visa](https://investor.visa.com/news/news-details/2026/Visa-Releases-First-of-Its-Kind-Industry-Benchmark-for-AI-Shopping-Almost-Half-of-Test-Runs-Fail/default.aspx), en el 54% de las pruebas fallidas el agente igual terminó comprando algo.

## ¿Qué midió Visa exactamente?

El Visa Agentic Commerce Benchmark pone a un modelo frente a un cliente simulado que quiere comprar algo como un televisor, un portátil o un aparato de cuidado personal. El cliente da algunas pistas y se guarda el resto. El modelo tiene que hacer las preguntas correctas, encontrar un producto que cumpla todos los requisitos, justificar la elección y no comprar si nada sirve.

Cada modelo tuvo tres intentos por escenario. Los números que importan:

- El 57,2% de las pruebas pasaron. Los mejores modelos pasaron el 82,2% y los peores el 28,9%.
- Los tres intentos pasaron solo el 34,2% de las veces, así que un modelo que acertó una vez muchas veces se equivocó en la siguiente.
- Los cinco modelos que descubrieron más requisitos ocultos pasaron el 70,2%, y los cinco que descubrieron menos, el 44,4%.
- Los cinco modelos más caros pasaron el 67,1% de las pruebas, y los cinco más baratos, el 50,2%.
- El 54% de las pruebas fallidas terminaron en una compra.

Visa nombra dos causas de falla: el agente recomendó un producto que no cumplía requisitos que ya había identificado, o no logró descubrir todos los requisitos del cliente. La segunda es un problema de conversación, porque el agente no preguntó lo suficiente. En la primera entra tu sitio.

## ¿Qué tiene que ver tu sitio con el producto equivocado?

Toma el ejemplo de Visa. Un cliente quiere un televisor, menciona una marca que le recomendó un familiar y una membresía con un proveedor externo, y no dice más. El agente tiene que averiguar el presupuesto, el formato de video, si soporta HDR10+ para los videos familiares y qué puede hacer el televisor con juegos.

Supón que el agente pregunta todo eso y el cliente contesta. Ahora tiene que confirmar el HDR10+ en una página de producto. Si ese dato está en una imagen comparativa, en una pestaña que solo carga con un clic, en una ficha técnica en PDF o en una página que el bot no tiene permiso de leer, el agente tiene dos opciones: adivinar, o irse a un competidor cuya página lo dice en texto.

Visa no separa "el modelo razonó mal" de "el modelo no pudo leer el dato", y las dos terminan en la misma categoría, un producto que no cumplía los requisitos. Nadie fuera de Visa sabe todavía cómo se reparten. Lo que sí sabemos es que un modelo mejor no arregla el segundo tipo de falla, porque el modelo del próximo año va a leer la misma página.

Eso es lo que mide el [radar](https://usepeaje.com/radar): lo que un agente puede encontrar hoy en tu sitio, con un puntaje de [Ora](https://ora.ai) y la lista de lo que encuentra y lo que no. Solo pide tu email y tu dominio, y tarda menos de un minuto.

## ¿Qué controla un comercio y qué no?

La mayor parte del benchmark no depende de ti, pero una parte está de tu lado del pedido:

| Qué salió mal en la prueba | De quién depende | Qué puedes hacer |
| --- | --- | --- |
| El agente no le hizo suficientes preguntas al cliente | Del modelo | Nada, hasta la próxima versión |
| El agente leyó mal un dato o no lo encontró | De tu sitio | Poner en texto los datos que deciden una compra, con fecha visible, y dejar pasar a los bots de búsqueda |
| El agente eligió una variante agotada o con otro precio | De tu sitio | Un precio y una disponibilidad por variante, en la página y también en el carrito |
| El agente compró cuando debía irse | De los dos | Frases claras como "no soporta X" ayudan a un agente honesto a decir que no |
| El agente no pudo pagar ni terminar la compra | De tu sitio (Visa planea probarlo) | Revisar hoy que un agente pueda llegar a tu paso de pago y usarlo |

Nada de esto garantiza una venta, porque que te citen y te elijan también depende de lo que otros sitios dicen de ti. Lo que sí cambia una página que se puede leer es cuáles fallas te toca arreglar a ti.

## ¿Qué va a probar Visa después y puedes revisarlo hoy?

Visa dice que planea agregar escenarios y categorías de producto, y extender la prueba al checkout, el pago y la confirmación del pedido. Es la parte en que el agente deja de leer y empieza a pagar.

Los números de confianza explican por qué le importa a Visa. En su Trust Index de septiembre de 2026, el 72% de los consumidores de Estados Unidos había usado un asistente de IA, pero solo el 23% confiaba en que la IA manejara sus pagos. Un agente que compra el televisor equivocado con la tarjeta de alguien no ayuda a ese número.

Si vendes algo que los agentes pagan por pedido, como una API, un reporte o un dataset, una parte la puedes revisar hoy. El comprador misterioso de Peaje (plan Pro, 30 créditos) le da a un agente comprador de prueba tres pedidos que tu negocio debería ganar, lo pone a buscar donde buscan esos agentes (el directorio de Peaje, el Bazaar de x402 y los registros de ERC-8004) y anota si te encontró, en qué puesto, a quién eligió en tu lugar y por qué. Después pide tu URL con precio sin pagar y revisa que el paso de pago responda bien. Nunca paga, necesita al menos una ruta o un link con precio, y lo que falla queda como tarea. No simula a un asistente comprando un producto físico en tu tienda, así que para el checkout de un televisor la prueba es la del paso 5 de abajo.

## ¿Qué hacer esta semana?

Cinco cosas, de menos a más trabajo, y la primera es gratis:

1. Pasa tu dominio por el [radar](https://usepeaje.com/radar) y lee la lista de lo que los agentes no encuentran, más allá del puntaje.
2. Revisa qué bots de IA pueden leer tu sitio. Los que buscan y citan (OAI-SearchBot, Claude-SearchBot, PerplexityBot) son distintos de los que entrenan modelos (GPTBot, ClaudeBot), y muchos sitios los bloquean a todos con una sola regla ([cuáles son](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)).
3. Elige los tres datos que deciden una compra en tu categoría y revisa que cada uno esté en texto en la página de producto, con una fecha que muestre que está al día.
4. Escribe también lo que no tienes. "No soporta HDR10+" le sirve más a un agente que el silencio, y evita que compre lo equivocado a nombre de un cliente.
5. Manda un agente por tu propio checkout. Abre Claude Code o Cursor con acceso al navegador, dale una tarea y una tarjeta de prueba, y mira dónde se traba. Qué necesita una tienda para que un agente le compre está en [esta guía](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle).

Los modelos de la tabla de Visa van a mejorar. Tu página de producto va a seguir igual hasta que la cambies.

## Fuentes

- [Visa: primer benchmark de la industria para compras con IA, casi la mitad de las pruebas fallan](https://investor.visa.com/news/news-details/2026/Visa-Releases-First-of-Its-Kind-Industry-Benchmark-for-AI-Shopping-Almost-Half-of-Test-Runs-Fail/default.aspx), 5 de noviembre de 2026. Todas las cifras del benchmark y del Trust Index salen de este comunicado.
- [Ora](https://ora.ai), el puntaje independiente de preparación para agentes que usa el radar.
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
