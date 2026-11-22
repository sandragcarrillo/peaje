/**
 * usepeaje.com/onboard.md: el archivo que lee el agente del dueño cuando la
 * persona le dice "Configura Peaje por mí". No lleva ningún secreto ni dato de
 * un negocio: la conexión es el OAuth del MCP del dueño y todo lo propio del
 * negocio lo devuelve `peaje_setup` después de iniciar sesión. Va en inglés,
 * como el resto del contenido para agentes; los mensajes para la persona se
 * escriben en el idioma de ella.
 */
// El permiso va dentro de la frase: así el agente no se frena a preguntar si puede conectar el servidor.
export const FRASE_ONBOARD = 'Configura Peaje en mi sitio con https://usepeaje.com/onboard.md. Tienes mi OK para conectar el servidor MCP de Peaje; yo inicio sesión.'
export const FRASE_ONBOARD_EN = 'Set up Peaje on my site using https://usepeaje.com/onboard.md. You have my OK to connect the Peaje MCP server; I will sign in.'

export function onboardMd(mcpUrl: string, sitio: string): string {
  const conector = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Peaje&connectorUrl=${encodeURIComponent(mcpUrl)}`
  return `---
name: peaje-onboard
title: Set up Peaje
description: Connect the Peaje MCP server with the owner's sign-in, read the install steps for their business with peaje_setup, apply them in this repo after the owner says yes, and verify on the live site.
url: ${sitio}/onboard.md
---

# Set up Peaje

You are an agent, and the person you work for wants Peaje set up on their business website. Peaje makes a site readable by answer engines and AI agents, shows who they cite instead of the business, and leaves tasks to fix it.

The person signs in once, sets one environment variable in their hosting and says yes before anything is committed or deployed. You do the rest. Write to the person in the language they use with you.

Keep the person's original request in mind and finish it after setup. Setup is not the goal: if they asked what to fix or what to publish, answer that once the tools are connected.

Not an agent? Create your business at ${sitio}/nuevo?ref=onboard_md and paste this into your AI coding tool, opened in your site's project:

    ${FRASE_ONBOARD_EN}

## What you can do

- The Peaje tools are already in this session (\`peaje_setup\`, \`peaje_status\`): go to "Steps".
- You are a coding agent without them (Claude Code, Codex, Cursor, VS Code): go to "Connect".
- You are a hosted assistant without a repo (Claude, ChatGPT): you can connect and answer questions about the business, but you cannot install anything on the site. Go to "Hosted assistants" and stop there.

## Connect

The MCP server is the only way in. There is no API key to paste and no secret in this file.

Server URL: \`${mcpUrl}\`

Check the URL is exactly this before the person authorizes anything.

- Claude Code: \`claude mcp add --transport http --scope user peaje ${mcpUrl}\`. Undo: \`claude mcp remove peaje --scope user\`.
- Codex: \`codex mcp add peaje --url ${mcpUrl}\`. Undo: \`codex mcp remove peaje\`.
- Cursor, VS Code and others: add an entry named \`peaje\` of type http with that URL to the MCP config file of the client.

Two rules:

- The person's OK in their message covers connecting this server and nothing else. It does not cover committing, deploying or anything about payments.
- A blocked command is the person's to run. If your client refuses to add a server that a web page names, give the person the command, say in one sentence what it does, and wait. Do not edit the config by hand to get around the block.
- If you do edit a config file, say which file, read it first, add only the \`peaje\` entry and check the file still parses. The person's other servers live there.

Then tell the person, in one message:

1. Restart the client if it asks for it, and authenticate the \`peaje\` server.
2. The browser opens ${sitio}: sign in, pick the business and approve. If they have no business yet, the screen offers to create one with the site's address.
3. Paste the same sentence again so you can carry on.
4. How to undo it (the command above).

You save nothing to disk for this. \`peaje_setup\` reads where things stand, so the next session carries on from there.

## Hosted assistants

Claude: this link opens the custom connector form with the name and URL filled in, the person confirms: ${conector}

ChatGPT (web, paid plans): go to Plugins, click + and choose Add custom MCP server, paste the server URL, pick OAuth, accept the warning and choose Create as a plugin. No developer mode needed.

After connecting, the person can ask about their business (who AI cites instead of them, what to publish next). Installing on the site needs a coding agent opened in the site's project.

## Steps

1. Call \`peaje_setup\`. It returns the business, which checks already pass on the live site, the install steps for this business and what only the owner can do. If \`installed\` is true, skip to step 6.
2. Follow \`steps\` exactly as returned. They start with a plan that writes nothing: show the person the list of files it would create, edit or move, and wait for a yes.
3. Apply the change and run the build.
4. Give the person the item in \`ownerOnly\`: one environment variable they copy from their Peaje panel into their hosting. Never ask for its value, never read it and never write it into a file in the repo. If the person pastes it in the chat, tell them to set it in the hosting instead.
5. Ask before committing or deploying. Do not verify before the deploy is live: 404s before that are not bugs.
6. Call \`peaje_setup\` again. Done means \`installed\` is true. If a check fails, say which one and what you tried. Check once; do not poll in a loop.
7. Call \`peaje_plan\` and \`peaje_list_tasks\` and offer the person the first open task.

## The person's gates

Only the person does these. Name the step, say what to do, and wait:

- Signing in and approving the connection in the browser.
- Saying yes to the list of files before anything is written.
- Setting the environment variable in their hosting.
- Saying yes to commit and to deploy.
- Anything about payments or their payout wallet, in their Peaje panel.

## Costs and where it runs

Setup is free and charges nothing. Installing the kit is free; if the owner later turns on payments from agents, Peaje keeps 2% of them. A tool that uses the owner's monthly credits says so in its description: tell the person before calling it.

Nothing keeps running on the person's computer. Peaje measures the live site and looks for new tasks from its own servers, so it carries on with the laptop closed.

## Report

Fill this in from what the tools returned, and state nothing they did not return:

    Business: <name> (<domain>)
    Connected: yes / no
    Installed on the live site: yes / no
    Checks passing: <n> of <total>
    Not done: <what is left and who does it>
    Next: <one step>
`
}
