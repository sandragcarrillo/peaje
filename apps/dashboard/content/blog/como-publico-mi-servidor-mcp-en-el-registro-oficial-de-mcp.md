---
title: "¿Cómo publico mi servidor MCP en el registro oficial de MCP?"
description: Paso a paso para publicar tu servidor MCP en registry.modelcontextprotocol.io con mcp-publisher, qué va en el server.json y cómo pruebas que el nombre es tuyo con GitHub o con tu dominio.
date: 2026-11-07
slug: como-publico-mi-servidor-mcp-en-el-registro-oficial-de-mcp
lang: es
categoria: Guía
portada: 1
portada_titulo: Tu MCP en el registro
traduccion: how-do-i-publish-my-mcp-server-to-the-official-mcp-registry
---

# ¿Cómo publico mi servidor MCP en el registro oficial de MCP?

Con la herramienta oficial `mcp-publisher`: describes tu servidor en un archivo `server.json`, pruebas que el nombre es tuyo (con tu cuenta de GitHub o con tu dominio, por DNS o con un archivo en tu sitio) y corres `mcp-publisher publish`. El registro, en [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/), guarda solo la ficha de tu servidor (nombre, descripción, versión y dónde encontrarlo), y tu código sigue viviendo donde ya está.

Actualizado: noviembre de 2026

El registro abrió en versión preliminar el 8 de septiembre de 2025, según el [anuncio del proyecto MCP](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/), y su documentación todavía avisa que puede tener cambios incompatibles o borrar datos antes de la versión estable. La descripción de tu ficha admite hasta 100 caracteres, según el [esquema oficial de server.json](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json).

## ¿Para qué sirve el registro oficial?

Es el catálogo público de servidores MCP que mantiene el propio proyecto MCP, con una API para consultarlo. La idea es que sea la fuente de la que se alimentan otros directorios, incluidos los catálogos de servidores de algunos clientes de IA, que toman esos datos y les suman los suyos. Si tu servidor está ahí, un agente o un directorio que busca servidores lo puede encontrar sin pasar por tu sitio. Qué es un servidor MCP y en qué se diferencia de una API lo explicamos en [esta guía](https://usepeaje.com/blog/que-es-mcp-y-en-que-se-diferencia-de-una-api), y los otros lugares donde te buscan los agentes, en [cómo encuentran los agentes de IA mi API](https://usepeaje.com/blog/como-encuentran-los-agentes-de-ia-mi-api).

## ¿Qué nombre le pongo y cómo pruebo que es mío?

El nombre depende de cómo pruebes que eres el dueño:

| Cómo lo pruebas | Formato del nombre | Qué necesitas |
| --- | --- | --- |
| Con GitHub | `io.github.tu-usuario/servidor` | Tu cuenta de GitHub y `mcp-publisher login github` |
| Con DNS | `com.tudominio/servidor` | Un registro TXT en tu dominio y `mcp-publisher login dns` |
| Con HTTP | `com.tudominio/servidor` | Un archivo en `https://tudominio.com/.well-known/mcp-registry-auth` y `mcp-publisher login http` |

En las dos formas con dominio, el nombre va al revés: `ejemplo.com` se escribe `com.ejemplo`. Para un negocio, el nombre con dominio se parece más a tu marca que tu usuario de GitHub.

Si además distribuyes tu servidor como paquete, el registro revisa que el paquete diga el mismo nombre: en npm, con el campo `mcpName` de tu `package.json`; en PyPI, con una línea `mcp-name: <nombre>` en el README; en Docker, con la etiqueta `io.modelcontextprotocol.server.name`. Si tu servidor está en línea y nadie lo instala, no hace falta ningún paquete.

## ¿Qué va en el server.json?

Tres campos son obligatorios: `name`, `description` y `version`. Para un servidor que ya está en línea, agregas `remotes` con el tipo de conexión y la URL, que tiene que responder en público. Un ejemplo recortado:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.ejemplo/tienda",
  "title": "Tienda Ejemplo",
  "description": "Consulta productos, precios y disponibilidad de Tienda Ejemplo",
  "version": "1.0.0",
  "websiteUrl": "https://ejemplo.com",
  "remotes": [{ "type": "streamable-http", "url": "https://ejemplo.com/mcp" }]
}
```

Usa `streamable-http`, porque el transporte `sse` quedó obsoleto. La versión tiene que ser distinta en cada publicación, y lo que publicas con una versión ya no se puede cambiar: si quieres corregir la descripción, publicas `1.0.1`.

## ¿Cuáles son los pasos?

1. **Ten tu servidor en línea** con una URL pública, por ejemplo `https://ejemplo.com/mcp`.
2. **Instala la herramienta** con `brew install mcp-publisher`, o baja el binario desde las versiones del [repositorio del registro](https://github.com/modelcontextprotocol/registry/releases).
3. **Crea tu ficha** con `mcp-publisher init` en la carpeta de tu proyecto y edita el `server.json` que genera.
4. **Crea tu llave y publica la parte pública.** Con la forma HTTP:

   ```bash
   openssl genpkey -algorithm Ed25519 -out key.pem
   PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
   echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}" > mcp-registry-auth
   ```

   Sube ese archivo a `/.well-known/mcp-registry-auth` en tu dominio. Con DNS, la misma línea va como registro TXT de tu dominio. El archivo `key.pem` es tu llave privada, así que guárdalo fuera del repositorio.
5. **Inicia sesión** con tu llave:

   ```bash
   PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
   mcp-publisher login http --domain ejemplo.com --private-key "${PRIVATE_KEY}"
   ```

6. **Publica** con `mcp-publisher publish`.
7. **Revisa que quedó** con `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.ejemplo/tienda"`.

Si prefieres publicar cada versión desde GitHub Actions, la documentación tiene un flujo listo que inicia sesión con `mcp-publisher login github-oidc`, sin guardar secretos, cuando el nombre es `io.github.*`.

## ¿Peaje me publica en el registro?

No, eso lo haces tú o quien lleva tu web, una sola vez, porque la prueba de que el nombre es tuyo necesita una llave que solo tú tienes. Lo que hace el kit gratis de Peaje es dejar tu servidor MCP respondiendo en tu dominio, en `/mcp`, y publicar los archivos que lo describen en `/.well-known/mcp` y `/.well-known/mcp/server-card.json`, para que un agente que llega a tu sitio lo encuentre ([cómo se instala](https://usepeaje.com/blog/como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar)). Con el kit instalado, en tu `server.json` pones `https://tudominio.com/mcp` como URL. El kit no sirve el archivo `mcp-registry-auth`, así que súbelo tú a tu sitio o usa la forma DNS.

Peaje siguió estos mismos pasos: está publicado como [`com.usepeaje/peaje`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.usepeaje/peaje) desde el 29 de octubre de 2026, con la prueba por HTTP. El [radar gratis](https://usepeaje.com/radar) revisa, entre otras cosas, si tu servidor MCP aparece en un directorio, así que después de publicar puedes medir tu sitio de nuevo.

## Fuentes

- [Blog de MCP: lanzamiento del registro en versión preliminar](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- [MCP: cómo publicar un servidor en el registro](https://modelcontextprotocol.io/registry/quickstart)
- [MCP: formas de autenticarse en el registro](https://modelcontextprotocol.io/registry/authentication)
- [MCP: publicar servidores remotos](https://modelcontextprotocol.io/registry/remote-servers)
- [MCP: versiones de un servidor publicado](https://modelcontextprotocol.io/registry/versioning)
- [MCP: tipos de paquete y su verificación](https://modelcontextprotocol.io/registry/package-types)
- [Esquema oficial de server.json](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)
- [Ficha de Peaje en el registro oficial](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.usepeaje/peaje)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
