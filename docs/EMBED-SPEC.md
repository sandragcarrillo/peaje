# Spec técnica · embed del widget (iframe)

> **Fuera del alcance del MVP.** El iframe no aplica al caso base: los agentes hablan HTTP puro y el
> dueño del negocio ya tiene el dashboard. Queda como roadmap para el caso plataforma (clientes con
> usuarios finales propios, modelo Stripe Connect). El contrato de acá sigue válido tal cual.

Define el contrato del JWT, las rutas
del embed y el snippet exacto que se le entrega al cliente. Modelo de referencia: embed de Secret.

## 1. Modelo de seguridad

Dos capas independientes, las dos obligatorias:

1. **`frame-ancestors` (CSP)**: el navegador solo renderiza el iframe si el dominio padre está
   en los `allowed_origins` del tenant. Bloquea embedding no autorizado.
2. **JWT de embed**: firmado por el **backend del cliente** con su `embed_secret`. Prueba que el
   request viene de una sesión legítima de su admin. Sin token válido, el widget no muestra datos
   ni permite retiros.

Principio clave: el `embed_secret` es distinto del API key privado. El API key nunca sale del
servidor del cliente ni aparece en HTML. Si el `embed_secret` se filtra, se rota sin tocar el gateway.

## 2. Contrato del JWT

Algoritmo: HS256, firmado con el `embed_secret` del tenant.

```json
{
  "iss": "datalatam",        // slug del tenant (obligatorio)
  "aud": "peaje-embed",      // fijo, rechaza tokens de otros usos (obligatorio)
  "iat": 1756000000,         // emitido en (obligatorio)
  "exp": 1756000300,         // expiración, máx iat + 300s (obligatorio)
  "sub": "user_42",          // id del usuario en el sistema del cliente (opcional)
  "scope": "read"            // "read" o "read:withdraw" (opcional, default "read")
}
```

Reglas de validación en el servidor del embed:

- `aud === "peaje-embed"`, `exp - iat <= 300`, tolerancia de reloj de 30 s.
- `iss` resuelve a un tenant existente; la firma se verifica con **su** `embed_secret`.
- El botón de retirar solo se renderiza si `scope === "read:withdraw"`. Así el cliente decide qué
  usuarios de su admin pueden retirar.
- Token inválido o ausente → widget en estado "sesión inválida" con instrucciones, nunca un error crudo.

El token viaja en query string (`?token=`), aceptable porque expira en 5 minutos y el endpoint
responde `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. No loggear la URL completa con token.

## 3. Rutas

### `GET /embed/widget?token=<jwt>`

Sirve el HTML del widget (página Next.js).

Headers de respuesta:

- `Content-Security-Policy: frame-ancestors <origins del tenant separados por espacio>`
- `Cache-Control: no-store`
- `Referrer-Policy: no-referrer`

Si el tenant no tiene origins configurados: `frame-ancestors 'none'` (fail-closed).

### `GET /api/embed/summary`

La llama el widget internamente.

- Auth: `Authorization: Bearer <mismo jwt>`. El widget lo toma de la URL y lo pasa en header; nunca
  cookies, para no depender de third-party cookies dentro del iframe.

```json
{
  "tenant": "datalatam",
  "balance": "12.4500",
  "paid_requests_30d": 318,
  "revenue_30d": "15.9000",
  "last_payments": [
    { "at": "2026-08-21T21:14:02Z", "route": "/api/data", "amount": "0.0500", "agent_wallet": "0x9f…c21" }
  ]
}
```

### `POST /api/embed/withdraw`

- Auth: mismo Bearer, exige `scope = read:withdraw`.
- Body: `{ "to_wallet": "0x…", "amount": "12.45" }` o `{ "all": true }`.
- Valida `amount <= balance`, crea el `withdrawal` en `pending`, dispara la transferencia testnet.
- Respuesta: `{ "withdrawal_id": "…", "status": "pending", "explorer_url": "https://explore.testnet.tempo.xyz/tx/…" }`.
- Idempotencia: header `Idempotency-Key` obligatorio (el widget genera un UUID por click) para no
  duplicar retiros por doble click o retry.

### `GET /api/embed/withdrawals/:id`

Polling del estado: `pending | confirmed | failed`. El widget consulta cada 3 s hasta confirmar.

## 4. Protocolo postMessage (widget → padre)

Un solo tipo de mensaje en el MVP:

```json
{ "type": "peaje:resize", "height": 420 }
```

- El widget lo emite en load y en cada cambio de contenido (`ResizeObserver` sobre `document.body`).
- `targetOrigin`: el origin del referrer si está disponible; `"*"` es aceptable en MVP porque el
  mensaje solo lleva la altura.
- Reservados para después (documentar, no implementar): `peaje:withdraw_completed`, `peaje:error`.

## 5. Snippet que se le entrega al cliente

### 5.1 Backend del cliente (genera el token por sesión)

```ts
// Node/TS. PEAJE_EMBED_SECRET viene del dashboard (Ajustes > Desarrollo)
import jwt from 'jsonwebtoken'

export function peajeEmbedToken(user: { id: string; canWithdraw: boolean }) {
  return jwt.sign(
    {
      iss: 'datalatam', // tu slug
      aud: 'peaje-embed',
      sub: user.id,
      scope: user.canWithdraw ? 'read:withdraw' : 'read',
    },
    process.env.PEAJE_EMBED_SECRET!,
    { expiresIn: '5m' },
  )
}
```

### 5.2 Frontend del cliente (incrusta el widget)

```html
<iframe
  id="peaje-widget"
  src="https://peaje.dev/embed/widget?token=TOKEN_GENERADO_EN_TU_BACKEND"
  style="width:100%;border:0;min-height:380px"
  loading="lazy"
  title="Ingresos de agentes">
</iframe>

<script>
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'peaje:resize') {
      document.getElementById('peaje-widget').style.height = e.data.height + 'px'
    }
  })
</script>
```

### 5.3 Checklist de integración (va en la doc del dashboard)

1. Registrá los dominios donde va a vivir el widget en Ajustes > Embed > Orígenes permitidos
   (incluí `http://localhost:3000` para desarrollo).
2. Copiá tu `embed_secret` de Ajustes > Desarrollo (se muestra una sola vez).
3. Generá el token en tu backend en cada carga de página (5.1). Nunca en el browser.
4. Pegá el iframe y el listener (5.2).

## 6. Contenido del widget (MVP)

- Balance disponible (número grande) + botón "Retirar" (solo con scope de retiro).
- Requests pagados y revenue de los últimos 30 días.
- Últimos 5 pagos: hora, ruta, monto, wallet del agente truncada.
- Estado del retiro en curso con link al explorer.
- Footer discreto "Con Peaje" que linkea a la landing. Es el growth loop, igual que Secret.

## 7. Casos de prueba antes del demo

- [ ] Iframe en el admin de DataLatam (origin permitido) → renderiza.
- [ ] Mismo iframe en un origin no listado → el navegador lo bloquea (verificar el error de
      `frame-ancestors` en consola).
- [ ] Token expirado → estado "sesión inválida", sin datos.
- [ ] Token con `scope: read` → no aparece el botón de retirar.
- [ ] Doble click en retirar → un solo retiro (idempotencia).
- [ ] Retiro completo → el estado pasa a `confirmed` y el link al explorer abre la tx.

## Notas de implementación

- La verificación del JWT del lado nuestro usa `jose` (Web Crypto, corre en cualquier runtime de
  Next). El snippet del cliente usa `jsonwebtoken` porque es lo más común en backends Node.
- `Idempotency-Key` se guarda junto al `withdrawal` para poder devolver el mismo registro ante un retry.
