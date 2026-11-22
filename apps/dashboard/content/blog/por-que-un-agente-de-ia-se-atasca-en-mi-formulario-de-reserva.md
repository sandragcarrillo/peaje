---
title: "¿Por qué un agente de IA se atasca en mi formulario de reserva?"
description: Qué frena a un agente de IA cuando intenta reservar por tu cliente, qué de eso revisa el radar gratis de Peaje, una prueba que puedes hacer hoy y qué arreglar primero.
date: 2026-11-22
slug: por-que-un-agente-de-ia-se-atasca-en-mi-formulario-de-reserva
lang: es
categoria: Guía
portada: 4
portada_titulo: Reservas que un agente termina
traduccion: why-does-an-ai-agent-get-stuck-on-my-booking-form
---

# ¿Por qué un agente de IA se atasca en mi formulario de reserva?

Casi siempre porque el formulario se hizo pensando en una persona que lo mira, y un agente necesita leerlo. Para terminar una reserva le hacen falta campos con etiqueta, botones de verdad, contenido que cargue sin JavaScript y permiso para entrar a tu sitio. Si algo de eso falla, no sabe qué escribir o no puede presionar "Reservar", y tu cliente termina reservando en otro lado.

Actualizado: noviembre de 2026

El [radar gratis de Peaje](https://usepeaje.com/radar) pasa tu sitio por Ora, un medidor independiente, y te dice cuántas de las cosas que busca un agente encuentra. En el ejemplo de la página del radar, los agentes entienden 14 de 29 cosas, con una nota de 46 (D) que puede llegar a unos 74 (B) con el kit.

## ¿Qué frena a un agente en un formulario de reserva?

| Lo que pasa en tu sitio | Por qué frena al agente | Chequeo de Ora en el radar |
| --- | --- | --- |
| Campos sin etiqueta, solo con texto gris de ejemplo | El texto gris desaparece al escribir y el agente no sabe qué va en cada campo | Campos de formulario con etiqueta |
| Algo que parece botón pero está hecho con otro elemento | El agente no lo ve como botón y no lo puede presionar | Botones de verdad |
| Botones con solo un ícono, sin texto | Como no tiene nombre, el agente no tiene cómo señalarlo | Botones con nombre |
| El calendario o el formulario aparece solo con JavaScript | La mayoría de los robots de IA no ejecutan JavaScript y ven la página en blanco | Contenido sin JavaScript |
| Una protección contra robots muy estricta | También frena a los agentes que sí quieres recibir | Protección contra robots |
| Tu robots.txt no deja pasar a los agentes que actúan por tus clientes | ChatGPT, Claude o Perplexity no pueden abrir tu sitio cuando una persona se lo pide | Permiso en robots.txt |
| Pasos manuales: llamar, escribir por WhatsApp, crear una cuenta antes | Cada paso manual es un lugar donde el agente se rinde | Primer uso sin ayuda de una persona |
| Una página sin títulos ni secciones | Los agentes recorren la página por sus títulos, como un lector de pantalla | Estructura de la página |

Antes del formulario hay otro filtro: si el agente no sabe qué ofreces ni cuánto cobras, ni siquiera llega a la página de reservas. Eso lo resuelven tus datos estructurados (JSON-LD), tu llms.txt y una lista de precios que una máquina pueda leer.

## ¿Qué revisa el radar de todo esto?

Revisa todos los chequeos de la tabla, sin llenar ni enviar tu formulario. El radar le pide a Ora que revise tu sitio, y esos chequeos entran en la frase con que abre tu resultado, "los agentes entienden X de Y cosas" ([cómo leer tu puntaje](https://usepeaje.com/blog/que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion)).

Para leer bien tu resultado, ten en cuenta que la lista "Lo que falta" solo muestra lo que se arregla con el kit de Peaje, como llms.txt, JSON-LD, openapi.json o el servidor MCP. Los chequeos del formulario se arreglan dentro de tu propio sitio, así que no salen ahí: si los pasas, los ves en "Lo que ya haces bien", y si alguno de la tabla no aparece en esa sección, ese es tu sospechoso.

## ¿Cómo encuentro el paso donde se atasca?

1. **Mide tu dominio en el radar:** tarda menos de un minuto y solo pide tu correo, sin tarjeta.
2. **Abre "Lo que ya haces bien"** y anota cuáles de los chequeos de la tabla faltan.
3. **Haz la prueba con ChatGPT o Claude** con el prompt de abajo y anota el paso exacto donde dice que se queda.
4. **Si instalaste el kit, mira "Visitas de agentes" en tu panel:** ahí ves qué bots de IA leyeron tu sitio, qué páginas leyeron y qué rutas pidieron que no existen. Los agentes que navegan como un navegador se cuentan aparte, junto con las personas, así que esta vista no te dice en qué clic se rindió uno.
5. **Arregla primero lo más rápido:** etiquetas, nombres de botones y robots.txt son unas líneas, mientras que cambiar controles hechos a mano, la protección contra robots o un sitio que depende de JavaScript ya necesita a quien programa tu web.

## ¿Qué prompt uso para probar mi formulario hoy?

Pégalo en ChatGPT o Claude con tu dominio y tus datos:

> Entra en tudominio.com/reservas y revisa el formulario como si fueras a reservar para dos personas el próximo viernes en la tarde. No envíes nada y no inventes datos. Dime qué pide cada campo, qué campos o botones no entiendes, en qué paso exacto te quedarías y qué tendría que cambiar el sitio para que pudieras terminar.

Guarda la respuesta, porque ahí tienes los fallos contados por el propio agente. Repite la prueba después de cada cambio. Si te contesta que no pudo abrir la página, revisa tu robots.txt y tu protección contra robots ([qué bots de IA visitan tu web y cómo dejarlos pasar](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)).

## ¿Qué arreglo primero?

1. **Ponle etiqueta a cada campo:** nombre, fecha, hora, personas y teléfono, porque el texto gris de ejemplo no alcanza.
2. **Usa botones de verdad, con texto:** "Reservar" le sirve más a un agente que una flecha.
3. **Pon en texto tus horarios, precios y condiciones,** en la página misma y no solo dentro del calendario.
4. **Explica qué pasa después de enviar:** si llega un correo, en cuánto tiempo confirmas y cómo se cancela.
5. **Quita los pasos que piden otro canal,** o explícalos en texto, por ejemplo "confirmamos por WhatsApp en menos de una hora".
6. **Instala el kit gratis,** para que el agente sepa qué eres y qué ofreces antes de llegar al formulario: llms.txt, JSON-LD, openapi.json, servidor MCP y agent cards ([cómo se añaden llms.txt y JSON-LD](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web)).

## Preguntas frecuentes

### ¿El kit de Peaje arregla mi formulario?

No. El kit, que es gratis, pone en tu dominio los archivos que leen los agentes, mientras que las etiquetas, los botones y el JavaScript de tu formulario se cambian en el código de tu sitio, y eso lo hace quien maneja tu web.

### ¿El radar prueba una reserva de verdad?

No, revisa tu sitio con Ora y te muestra qué chequeos pasas, sin llenar ni enviar nada. Para ver el formulario por dentro usa el prompt de arriba.

### ¿Y si mi reserva es un widget de otra empresa?

Los chequeos aplican a la página que abre el agente, así que si el formulario es de otro proveedor, las etiquetas y los botones dependen de él. Lo que sí controlas es tu página: tus horarios, precios y condiciones en texto, y un enlace directo a la reserva.

### ¿Cada cuánto vuelvo a medir?

Después de cada cambio, y el radar te deja medir hasta 6 veces por hora.

### ¿Cuánto cuesta?

El radar y el kit son gratis y no piden tarjeta. El agente Pro, que te dice qué publicar y mide si ChatGPT y Claude te citan, cuesta US$30 al mes con el precio de fundador para los primeros 50 negocios y US$69 después ([precios](https://usepeaje.com/precios)).

## Fuentes

- [Radar gratis de Peaje](https://usepeaje.com/radar): el ejemplo de 14 de 29 cosas y la nota de 46 a unos 74.
- [Metodología de Ora](https://ora.ai/methodology), el medidor que usa el radar, consultada el 22 de noviembre de 2026.
- [Precios de Peaje](https://usepeaje.com/precios): plan gratis con radar, kit y registro de visitas, y el plan Pro.

## Relacionado

- [¿Qué mide el radar de Peaje y qué significa mi puntuación?](https://usepeaje.com/blog/que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion)
- [¿Para qué sirve el openapi.json y qué agentes de IA lo leen?](https://usepeaje.com/blog/para-que-sirve-el-openapi-json-y-que-agentes-de-ia-lo-leen)
- [¿Qué bots de IA visitan mi web y cómo los dejo pasar?](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)
