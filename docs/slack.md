# Peaje en Slack

El agente de "Mi agente" (el mismo de Telegram) en los canales de un equipo. Cualquiera del canal le pregunta mencionando a `@Peaje`; solo la persona de Slack que instaló la app aprueba (o descarta) los cambios de precio o de rutas que propone el agente. Es Pro, como Telegram.

## Cómo funciona

1. En "Mi agente" el dueño toca **Agregar a Slack**. El dashboard pide al gateway un código de un solo uso (60 min) y abre `https://api.usepeaje.com/slack/install?code=…`.
2. El gateway pone una cookie con el código y redirige al OAuth v2 de Slack (`state` = código).
3. Slack vuelve a `/slack/oauth/callback`. El gateway valida `state` contra la cookie, canjea el código en `oauth.v2.access` (HTTP Basic con client id y secret), guarda la instalación con el bot token cifrado (AES-256-GCM con `SLACK_TOKEN_KEY`) y ata el código al workspace y a quien instaló (vence en 24 h).
4. Quien instaló invita a `@Peaje` a un canal (`/invite @Peaje`) y lo menciona una vez. Esa primera mención consume el código y conecta el canal a ese negocio. Un mensaje directo al bot también sirve.
5. Desde ahí, cualquiera del canal pregunta con `@Peaje …`. La respuesta va en el hilo de la mención: primero "Un momento, lo reviso…", que se va reemplazando con el estado del agente y al final con la respuesta. Opciones del agente, propuestas (Aplicar / Descartar) y tarjetas con URL salen como botones de Block Kit.

Comandos en el canal: `@Peaje ayuda` (`help`), `@Peaje negocios` (`businesses`, cambia de negocio si hay más de uno), `@Peaje desconectar` (`disconnect`, solo quien instaló).

Varios negocios en un canal: se conecta cada uno desde su "Mi agente" (Agregar a Slack de nuevo y una mención). Uno queda activo, como en Telegram. Si otra persona vuelve a instalar la app en el mismo workspace, pasa a ser ella quien aprueba.

Reportes programados y trabajos largos: Slack se registra como canal (`registrarCanal('slack')` y `registrarEntrega('slack')`). El target es `<team_id>:<channel_id>`.

## Variables de entorno (gateway, Railway)

| Variable | Qué es |
|---|---|
| `SLACK_CLIENT_ID` | Basic Information → App Credentials → Client ID |
| `SLACK_CLIENT_SECRET` | Basic Information → App Credentials → Client Secret |
| `SLACK_SIGNING_SECRET` | Basic Information → App Credentials → Signing Secret |
| `SLACK_TOKEN_KEY` | Clave para cifrar los bot tokens en la base. Cualquier texto largo y aleatorio (por ejemplo `openssl rand -base64 32`). Si se cambia, los tokens guardados dejan de servir y hay que reinstalar. |
| `SLACK_REDIRECT_URL` | Opcional. Por defecto `${GATEWAY_PUBLIC_URL}/slack/oauth/callback` = `https://api.usepeaje.com/slack/oauth/callback`. Tiene que coincidir con la del manifest. |

Sin las cuatro primeras el gateway corre en modo prueba: no llama a Slack y guarda lo que habría mandado (`GET /_internal/slack/outbox`). El dashboard ya usa `GATEWAY_INTERNAL_URL` e `INTERNAL_API_SECRET`; no necesita nada nuevo.

## Manifest

En https://api.slack.com/apps → **Create New App** → **From a manifest** → elegir el workspace de desarrollo → pegar esto (YAML):

```yaml
display_information:
  name: Peaje
  description: Pregúntale a tu agente de Peaje cómo te ven ChatGPT y los agentes que compran.
  long_description: "El agente de Peaje en el Slack de tu equipo. Cualquiera del canal le pregunta mencionando a @Peaje: cómo va el negocio, quién lo visita, qué publicar esta semana. El agente responde con los datos del negocio en el hilo de la pregunta. Si propone un cambio de precio o de rutas, solo quien instaló Peaje en el workspace lo puede aprobar. Se conecta desde Mi agente en usepeaje.com."
  background_color: "#111111"
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: Peaje
    always_online: true
oauth_config:
  redirect_urls:
    - https://api.usepeaje.com/slack/oauth/callback
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - im:history
      - files:write
settings:
  event_subscriptions:
    request_url: https://api.usepeaje.com/slack/events
    bot_events:
      - app_mention
      - message.im
      - app_uninstalled
  interactivity:
    is_enabled: true
    request_url: https://api.usepeaje.com/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Scopes: `app_mentions:read` (menciones en canales), `chat:write` (responder y actualizar el mensaje provisorio), `im:history` (mensajes directos al bot, evento `message.im`), `files:write` (subir los borradores como .md al hilo; sin él, el bot manda el link al dashboard). No pide leer canales: el bot solo ve los mensajes donde lo mencionan. Por eso, dentro de un hilo, cada pregunta nueva también lleva `@Peaje`.

## Lo que hay que hacer en Slack

1. Crear la app con el manifest de arriba. Slack verifica la Request URL de eventos al guardar: el gateway con estas rutas ya tiene que estar desplegado (responde el `url_verification` firmado). Si se crea antes del deploy, después en **Event Subscriptions** se toca "Retry".
2. Copiar Client ID, Client Secret y Signing Secret a Railway, más `SLACK_TOKEN_KEY`. Redeploy del gateway.
3. **Manage Distribution** → completar el checklist → **Activate Public Distribution**. Sin esto solo se puede instalar en el workspace de desarrollo. No hace falta publicar en el Slack Marketplace.
4. Opcional: subir el ícono en **Basic Information → Display Information**.
5. Aplicar la migración `supabase/migrations/20261024300000_slack.sql`.

## Rutas

| Ruta | Qué hace |
|---|---|
| `GET /slack/install?code=` | Valida el código del dashboard, pone la cookie y redirige al OAuth de Slack |
| `GET /slack/oauth/callback` | Canjea el código, guarda la instalación, ata el código a quien instaló |
| `POST /slack/events` | Events API: `url_verification`, `app_mention`, `message.im`, `app_uninstalled`. Firma v0 obligatoria, 200 inmediato, dedupe por `event_id` |
| `POST /slack/interactions` | Clics en botones (`block_actions`). Firma v0, 200 inmediato, se procesa en la fila del canal |
| `POST /_internal/:slug/slack/link` | Enlace de instalación de un solo uso (Pro) |
| `GET /_internal/:slug/slack` | Canales conectados |
| `DELETE /_internal/:slug/slack[?team=&channel=]` | Desconecta todos o uno |
| `GET /_internal/slack/outbox` | Lo que el bot habría mandado (solo modo prueba) |

## Prueba local

```
cd apps/gateway && npx tsx scripts/slack.test.mts
```

Store en memoria y Slack en modo prueba: firma con el ejemplo de la documentación de Slack, `url_verification`, OAuth simulado, mención en canal sin conectar, conexión por la primera mención de quien instaló, dedupe de reintentos, propuesta aprobada solo por quien instaló, canal de reportes y desinstalación.
