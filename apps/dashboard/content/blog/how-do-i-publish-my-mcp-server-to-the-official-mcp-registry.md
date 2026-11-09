---
title: "How do I publish my MCP server to the official MCP registry?"
description: Step by step to publish your MCP server to registry.modelcontextprotocol.io with mcp-publisher, what goes in server.json and how you prove the name is yours with GitHub or your domain.
date: 2026-11-07
slug: how-do-i-publish-my-mcp-server-to-the-official-mcp-registry
lang: en
categoria: Guide
portada: 1
portada_titulo: Your MCP in the registry
traduccion: como-publico-mi-servidor-mcp-en-el-registro-oficial-de-mcp
---

# How do I publish my MCP server to the official MCP registry?

With the official `mcp-publisher` tool: you describe your server in a `server.json` file, prove the name is yours (with your GitHub account or with your domain, through DNS or a file on your site) and run `mcp-publisher publish`. The registry, at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/), stores only your server's listing (name, description, version and where to find it), and your code stays where it already lives.

Updated: November 2026

The registry opened in preview on September 8, 2025, according to the [MCP project announcement](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/), and its documentation still warns that it may ship breaking changes or reset data before general availability. Your listing's description can be up to 100 characters, according to the [official server.json schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json).

## What is the official registry for?

It is the public catalog of MCP servers maintained by the MCP project itself, with an API to query it. The idea is for it to be the source other directories build on, including the server catalogs of some AI clients, which take that data and add their own. If your server is there, an agent or a directory looking for servers can find it without going through your site. What an MCP server is and how it differs from an API is in [this guide](https://usepeaje.com/blog/what-is-mcp-and-how-is-it-different-from-an-api), and the other places agents look for you are in [how do AI agents find my API](https://usepeaje.com/blog/how-do-ai-agents-find-my-api).

## What name do I use and how do I prove it is mine?

The name depends on how you prove you own it:

| How you prove it | Name format | What you need |
| --- | --- | --- |
| With GitHub | `io.github.your-username/server` | Your GitHub account and `mcp-publisher login github` |
| With DNS | `com.yourdomain/server` | A TXT record on your domain and `mcp-publisher login dns` |
| With HTTP | `com.yourdomain/server` | A file at `https://yourdomain.com/.well-known/mcp-registry-auth` and `mcp-publisher login http` |

In both domain options the name is reversed: `example.com` becomes `com.example`. For a business, a domain-based name looks more like your brand than your GitHub username does.

If you also distribute your server as a package, the registry checks that the package carries the same name: on npm, with the `mcpName` field in your `package.json`; on PyPI, with an `mcp-name: <name>` line in the README; on Docker, with the `io.modelcontextprotocol.server.name` label. If your server runs online and nobody installs it, you need no package at all.

## What goes in server.json?

Three fields are required: `name`, `description` and `version`. For a server that is already online, you add `remotes` with the connection type and the URL, which has to answer publicly. A trimmed example:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/store",
  "title": "Example Store",
  "description": "Look up products, prices and availability at Example Store",
  "version": "1.0.0",
  "websiteUrl": "https://example.com",
  "remotes": [{ "type": "streamable-http", "url": "https://example.com/mcp" }]
}
```

Use `streamable-http`, since the `sse` transport is deprecated. The version has to be different on every publish, and what you publish under a version can no longer be changed: to fix the description, you publish `1.0.1`.

## What are the steps?

1. **Have your server online** at a public URL, for example `https://example.com/mcp`.
2. **Install the tool** with `brew install mcp-publisher`, or download the binary from the [registry repository releases](https://github.com/modelcontextprotocol/registry/releases).
3. **Create your listing** with `mcp-publisher init` in your project folder and edit the `server.json` it generates.
4. **Create your key and publish the public part.** With the HTTP option:

   ```bash
   openssl genpkey -algorithm Ed25519 -out key.pem
   PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
   echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}" > mcp-registry-auth
   ```

   Upload that file to `/.well-known/mcp-registry-auth` on your domain. With DNS, the same line goes in a TXT record on your domain. The `key.pem` file is your private key, so keep it out of your repository.
5. **Log in** with your key:

   ```bash
   PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
   mcp-publisher login http --domain example.com --private-key "${PRIVATE_KEY}"
   ```

6. **Publish** with `mcp-publisher publish`.
7. **Check it is listed** with `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.example/store"`.

If you would rather publish each version from GitHub Actions, the documentation has a ready workflow that logs in with `mcp-publisher login github-oidc`, with no stored secrets, when the name is `io.github.*`.

## Does Peaje publish me to the registry?

No, you or whoever runs your website do that once, because proving the name is yours takes a key only you hold. What Peaje's free kit does is leave your MCP server answering on your domain, at `/mcp`, and publish the files that describe it at `/.well-known/mcp` and `/.well-known/mcp/server-card.json`, so an agent that reaches your site finds it ([how to install it](https://usepeaje.com/blog/how-do-i-set-up-an-mcp-server-for-my-store-without-coding)). With the kit installed, you put `https://yourdomain.com/mcp` as the URL in your `server.json`. The kit does not serve the `mcp-registry-auth` file, so upload it to your site yourself or use the DNS option.

Peaje followed these same steps: it is listed as [`com.usepeaje/peaje`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.usepeaje/peaje) since October 29, 2026, proven over HTTP. The [free radar](https://usepeaje.com/radar) checks, among other things, whether your MCP server shows up in a directory, so after publishing you can measure your site again.

## Sources

- [MCP blog: registry preview launch](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- [MCP: publish a server to the registry](https://modelcontextprotocol.io/registry/quickstart)
- [MCP: registry authentication methods](https://modelcontextprotocol.io/registry/authentication)
- [MCP: publishing remote servers](https://modelcontextprotocol.io/registry/remote-servers)
- [MCP: versioning published servers](https://modelcontextprotocol.io/registry/versioning)
- [MCP: package types and verification](https://modelcontextprotocol.io/registry/package-types)
- [Official server.json schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)
- [Peaje's listing in the official registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.usepeaje/peaje)
- [Peaje free radar](https://usepeaje.com/radar)
