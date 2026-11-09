---
title: "¿Qué es ERC-8004 y para qué sirve el registro de agentes de IA?"
description: Qué es ERC-8004, quién lo propuso, cómo funcionan sus registros de identidad, reputación y validación, y qué le aporta a un negocio que quiere que los agentes de IA lo encuentren y le paguen.
date: 2026-11-07
slug: que-es-erc-8004-y-para-que-sirve-el-registro-de-agentes-de-ia
lang: es
categoria: Guía
portada: 1
portada_titulo: Qué es ERC-8004
traduccion: what-is-erc-8004-and-what-is-the-ai-agent-registry-for
---

# ¿Qué es ERC-8004 y para qué sirve el registro de agentes de IA?

ERC-8004 es una propuesta de estándar de Ethereum para que los agentes de IA tengan una identidad pública en la blockchain, con un historial de reseñas y verificaciones que cualquiera puede leer. Se llama "Trustless Agents", se creó el 13 de agosto de 2025 y sigue en estado de borrador. Funciona con tres registros: uno de identidad, uno de reputación y uno de validación.

Actualizado: noviembre de 2026

Según el [repositorio oficial de los contratos](https://github.com/erc-8004/erc-8004-contracts), los registros de identidad y de reputación ya están desplegados en 25 redes principales, entre ellas Ethereum, Base, Arbitrum y Polygon, con la misma dirección en todas. El registro de validación todavía no tiene dirección publicada, porque esa parte de la especificación sigue en discusión.

## ¿Quién propuso ERC-8004?

La propuesta está publicada en [eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-8004) y la firman cuatro autores: Marco De Rossi (con usuario de MetaMask), Davide Crapis (con correo de ethereum.org), Jordan Ellis (con correo de Google) y Erik Reppel (con correo de Coinbase). Es de tipo Standards Track, en la categoría ERC, y la discusión pública está en el foro Ethereum Magicians. Que sea un borrador quiere decir que todavía puede cambiar.

Parte de un hueco que la misma propuesta describe: protocolos como MCP y A2A dicen cómo hablar con un agente, pero no cómo encontrarlo ni cómo saber si confiar en él cuando no lo conoces.

## ¿Qué hace cada uno de los tres registros?

| Registro | Qué guarda | Quién escribe |
| --- | --- | --- |
| Identidad | Un número por agente (un token ERC-721) que apunta a un archivo con su nombre, su descripción y sus servicios | El dueño del agente |
| Reputación | Reseñas con un valor numérico y etiquetas opcionales | Cualquier cliente, menos el dueño del agente o quien lo administra |
| Validación | Pedidos de verificación de un trabajo y la respuesta del validador, de 0 a 100 | El dueño pide y el validador responde |

El archivo de registro es un JSON que puede listar varios servicios a la vez: una web, un servidor MCP, una agent card de A2A, un nombre ENS, un correo. También dice si el agente acepta pagos x402 (`x402Support`) y si está activo (`active`). La wallet donde el agente recibe pagos va en un dato reservado, `agentWallet`, y para cambiarla hay que firmar con la wallet nueva. Si el agente cambia de dueño, esa wallet se borra y el nuevo dueño la tiene que volver a configurar.

## ¿ERC-8004 sirve para cobrar?

No, la propuesta dice que los pagos quedan fuera de su alcance. Lo que sí hace es dejar escrito a dónde pagarte (`agentWallet`) y si aceptas x402, y muestra cómo usar los comprobantes de pago x402 para darles más contexto a las reseñas. El cobro en sí pasa por un protocolo de pago como x402 o MPP, que comparamos en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar).

## ¿Para qué le sirve a mi negocio?

Si vendes algo que consumen agentes, como una API, datos o una herramienta, registrarte te pone en una lista pública que los agentes compradores pueden recorrer y filtrar por lo que hace cada servicio, si acepta pagos y qué reseñas tiene. Las reseñas las dejan tus clientes, y como el dueño no puede reseñarse a sí mismo, dicen más que una página de testimonios. Antes de registrarte, ten en cuenta tres cosas:

- **Solo te encuentran los agentes que consultan el registro.** Los demás te siguen encontrando por tu sitio y por archivos como llms.txt, openapi.json o tu [agent card](https://usepeaje.com/blog/que-es-una-agent-card-y-para-que-sirve-en-mi-sitio), que explicamos en [cómo encuentran los agentes de IA mi API](https://usepeaje.com/blog/como-encuentran-los-agentes-de-ia-mi-api).
- **La reputación se puede inflar.** La propuesta reconoce que alguien puede crear agentes falsos para subir el puntaje de otro, así que un promedio alto dice poco si no miras quién dejó cada reseña.
- **Registrarte es una transacción.** Pagas el gas de la red que elijas y la identidad queda a nombre de una wallet, que tienes que cuidar como cualquier otra.

## ¿Peaje usa ERC-8004?

Peaje lo lee, pero no registra tu negocio en él. El comprador misterioso del plan Pro, un agente comprador de prueba que busca tu negocio como lo harían los agentes reales, recorre tres fuentes: el directorio de Peaje, el Bazaar de x402 y el registro ERC-8004, que consulta en Ethereum, Base y Polygon (más una red de prueba) a través de los índices de Agent0 en The Graph. Después anota si te encontró, en qué puesto y a quién eligió en tu lugar.

Peaje no crea tu identidad en el registro ni publica tu archivo de registro, y el kit no sirve `/.well-known/agent-registration.json`. Si quieres estar ahí, el registro lo haces tú con tu wallet, y tu archivo puede apuntar a lo que el kit ya deja en tu dominio: la agent card en `/.well-known/agent-card.json`, el servidor MCP en `/mcp` y tus rutas con precio, que responden 402 con ofertas x402 y MPP cuando tienes los cobros prendidos.

Si todavía no sabes qué ve un agente cuando llega a tu sitio, el [radar gratis](https://usepeaje.com/radar) te lo dice en menos de un minuto.

## Fuentes

- [ERC-8004: Trustless Agents, en eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-8004)
- [Contratos oficiales de ERC-8004 en GitHub](https://github.com/erc-8004/erc-8004-contracts)
- [Discusión de ERC-8004 en Ethereum Magicians](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098)
- [Precios de Peaje](https://usepeaje.com/precios)
