# Google Search Console

El dueño conecta la cuenta de Google donde tiene su sitio en Search Console y el agente lee sus datos de la Búsqueda de Google: en qué búsquedas aparece, cuáles nadie abre, qué páginas tienen impresiones sin clics y si Google ya indexó una URL. Solo lectura (`webmasters.readonly`): Peaje no cambia nada en Search Console. Es Pro, como Telegram y Slack.

## Cómo funciona

1. En Integraciones el dueño toca **Google Search Console** → **Conectar Google**. El dashboard pide al gateway un enlace (`POST /_internal/:slug/google/link`) con un `state` firmado (HMAC con `GOOGLE_TOKEN_KEY`, vence en 30 min; no hay tabla de códigos).
2. `GET /google/install?state=…` pone una cookie con el `state` y redirige al consentimiento de Google con `access_type=offline` y `prompt=consent` (para que siempre llegue el refresh token).
3. Google vuelve a `/google/oauth/callback`. El gateway valida el `state` contra la cookie, canjea el código, revisa que el permiso de Search Console venga marcado (Google deja desmarcarlo), lista las propiedades de la cuenta y elige la del sitio: primero `sc-domain:<dominio>`, después el prefijo `https://` con y sin www, después `http://`. Un subdominio lo cubre la propiedad de dominio del padre.
4. Guarda la conexión en `google_connections` con el refresh token cifrado (AES-256-GCM con `GOOGLE_TOKEN_KEY`). Si la cuenta no tiene el sitio, queda conectada sin propiedad y el dashboard deja elegir una de la lista.
5. El agente usa dos herramientas:
   - `get_search_console` (7, 28 o 90 días; filtros opcionales por texto de la búsqueda o de la URL): totales, las 20 búsquedas y páginas con más clics, búsquedas y páginas con impresiones y sin clics, búsquedas entre el puesto 8 y el 20, y los sitemaps.
   - `inspect_url`: inspección de una URL del sitio (indexada o no, cobertura, último rastreo, robots y noindex, canónica elegida por Google contra la declarada, sitemaps que la listan).

   `get_overview` dice si está conectado. Cada lectura deja `last_used_at`; si Google la rechaza, `last_error` (`reconnect:` cuando el refresh token ya no sirve, `no-property:` cuando la cuenta perdió el acceso al sitio) y el dashboard lo muestra.
6. **Desconectar** revoca el token en Google y borra la fila. Conectar otra cuenta reemplaza la conexión y revoca la anterior (solo si es otra cuenta: revocar corta el permiso entero, también el token nuevo de la misma cuenta).

Lo que la API no da: el reporte de IA generativa de Search Console (impresiones en AI Overviews y AI Mode) solo existe en la interfaz. Los números de la API, tipo `web`, incluyen esas impresiones sin separarlas. Tampoco hay "Solicitar indexación" ni "Validar corrección" por API.

## Rutas

| Ruta | Qué |
|---|---|
| `GET /google/install?state=…` | Pone la cookie y redirige al consentimiento |
| `GET /google/oauth/callback` | Canjea el código, elige la propiedad, guarda la conexión |
| `POST /_internal/:slug/google/link` | Enlace para conectar (Pro) |
| `GET /_internal/:slug/google` | `{ configured, connection }` sin el token |
| `PUT /_internal/:slug/google/property` | Cambia la propiedad (solo una de las que ve la cuenta) |
| `DELETE /_internal/:slug/google` | Revoca y borra |

## Variables de entorno (gateway, Railway)

| Variable | Qué es |
|---|---|
| `GOOGLE_CLIENT_ID` | El Client ID del cliente OAuth (tipo Web application) |
| `GOOGLE_CLIENT_SECRET` | Su Client secret |
| `GOOGLE_TOKEN_KEY` | Clave para cifrar los refresh tokens y firmar el `state`. Texto largo y aleatorio (`openssl rand -base64 32`). Si se cambia, las conexiones guardadas dejan de servir y hay que reconectar. |
| `GOOGLE_REDIRECT_URL` | Opcional. Por defecto `${GATEWAY_PUBLIC_URL}/google/oauth/callback` = `https://api.usepeaje.com/google/oauth/callback` |

Sin las tres primeras la integración está apagada y el dashboard no muestra la tarjeta. Necesita la tabla `google_connections` (`supabase/migrations/20261111000000_google_search_console.sql`).

## Configurar Google Cloud

1. En https://console.cloud.google.com crea un proyecto (por ejemplo "Peaje") y activa **Google Search Console API** (APIs & Services → Library).
2. **Google Auth Platform** → **Branding**: nombre Peaje, correo de soporte, logo, página `https://usepeaje.com`, política de privacidad `https://usepeaje.com/privacy`, términos `https://usepeaje.com/terms`, dominio autorizado `usepeaje.com`.
3. **Audience**: tipo **External**.
4. **Data Access**: agrega los scopes `openid`, `.../auth/userinfo.email` y `https://www.googleapis.com/auth/webmasters.readonly`.
5. **Clients** → **Create client** → **Web application**. URI de redirección autorizada: `https://api.usepeaje.com/google/oauth/callback`. Copia el Client ID y el secret a Railway.
6. **Publicar la app** (Audience → **Publish app**, estado "In production"). En "Testing" Google vence los refresh tokens a los 7 días, así que la conexión se caería cada semana. Publicada y sin verificar, la pantalla de Google muestra un aviso de app no verificada y hay un tope de 100 cuentas.
7. **Verificación** (Verification Center): para quitar el aviso, Google revisa la app. Pide la política de privacidad que diga qué datos de Google se usan y para qué, un video que muestre el flujo y el uso de cada scope, y el dominio verificado. Google habla de hasta 10 días hábiles para scopes sensibles.

## Cuotas

Search Analytics: 1.200 consultas por minuto por propiedad. Inspección de URL: 2.000 por día y 600 por minuto por propiedad. Una llamada a `get_search_console` hace 4 consultas (totales, búsquedas, páginas, sitemaps).

Referencias (2026-11-11): [OAuth para web](https://developers.google.com/identity/protocols/oauth2/web-server), [scopes](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [inspección](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect), [cuotas](https://developers.google.com/webmaster-tools/limits), [vencimiento de refresh tokens](https://developers.google.com/identity/protocols/oauth2#expiration).
