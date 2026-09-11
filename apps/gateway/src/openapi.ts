import type { Tenant } from '@peaje/db'

/**
 * mppx genera el esqueleto del OpenAPI con las ofertas de pago. Acá le
 * agregamos lo que un agente necesita para llamarlo sin prueba y error:
 * operationId estables, esquemas de respuesta tipados, un modelo de error
 * RFC 9457, política de versionado, idempotencia en las escrituras y la forma
 * de la paginación. Sin esto el spec dice qué cobra pero no qué devuelve.
 */

type Doc = {
  openapi: string
  info: Record<string, unknown>
  servers?: unknown[]
  paths: Record<string, Record<string, Record<string, unknown>>>
  components?: Record<string, unknown>
  tags?: unknown[]
  [extension: string]: unknown
}

/** `/r/mi-articulo` + GET → `getRMiArticulo` */
function operationId(method: string, path: string): string {
  const partes = path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[^a-zA-Z0-9]+/g, ' ').trim())
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join('')
  return `${method.toLowerCase()}${partes || 'Root'}`
}

const PROBLEM = { $ref: '#/components/schemas/Problem' }

function respuestaError(descripcion: string) {
  return { description: descripcion, content: { 'application/problem+json': { schema: PROBLEM } } }
}

export function enriquecer(doc: Doc, tenant: Tenant, base: string): Doc {
  doc.info = {
    ...doc.info,
    version: '1.0.0',
    description: [
      `Pay-per-request API from ${tenant.name}. No API keys and no signup: call an endpoint, get HTTP 402 with the terms, settle in stablecoin, get the resource.`,
      '',
      `Auth walkthrough: ${base}/auth.md · Priced catalog: ${base}/discovery/resources · MCP: ${base}/mcp`,
    ].join('\n'),
    contact: { name: `${tenant.name} via Peaje`, url: `${base}/llms.txt` },
    license: { name: 'Per-request commercial terms', url: `${base}/auth.md` },
  }

  // Versionado: la versión viaja en la cabecera `API-Version`, y los cambios
  // que rompen se anuncian con Sunset/Deprecation antes de aplicarse.
  doc['x-api-versioning'] = {
    strategy: 'header',
    header: 'API-Version',
    current: '2026-09-01',
    supported: ['2026-09-01'],
    deprecationPolicy:
      'Breaking changes ship under a new API-Version date. The previous version keeps answering for at least 90 days and its responses carry the RFC 9745 Deprecation and RFC 8594 Sunset headers for the whole window.',
    deprecationHeaders: ['Deprecation', 'Sunset', 'Link'],
  }

  doc.tags = [
    { name: 'paid-resources', description: 'Everything behind HTTP 402' },
    { name: 'discovery', description: 'Catalogs an agent reads before paying' },
    { name: 'commerce', description: 'UCP, ACP and AP2 surfaces' },
  ]

  doc.components = {
    ...(doc.components ?? {}),
    schemas: {
      ...((doc.components?.schemas as object) ?? {}),
      Problem: {
        type: 'object',
        description: 'RFC 9457 problem details. Every error from this API has this shape.',
        required: ['type', 'title', 'status'],
        properties: {
          type: { type: 'string', format: 'uri', description: 'Stable URI identifying the problem kind' },
          title: { type: 'string', description: 'Short human-readable summary' },
          status: { type: 'integer', description: 'HTTP status code' },
          detail: { type: 'string', description: 'What went wrong on this specific request' },
          instance: { type: 'string', description: 'Path that produced the error' },
          hint: { type: 'string', description: 'What to do next' },
        },
      },
      PaymentOffer: {
        type: 'object',
        description: 'One way to pay this request. The 402 carries one per supported network.',
        required: ['scheme', 'network', 'maxAmountRequired', 'payTo', 'asset'],
        properties: {
          scheme: { type: 'string', enum: ['exact'] },
          network: { type: 'string', description: 'CAIP-2 chain id, e.g. eip155:5042002' },
          maxAmountRequired: { type: 'string', description: 'Amount in the token smallest unit' },
          resource: { type: 'string', format: 'uri' },
          description: { type: 'string' },
          mimeType: { type: 'string' },
          payTo: { type: 'string', description: 'Recipient address' },
          maxTimeoutSeconds: { type: 'integer' },
          asset: { type: 'string', description: 'Token contract address' },
          extra: { type: 'object', additionalProperties: true },
        },
      },
      BazaarItem: {
        type: 'object',
        required: ['resource', 'type', 'x402Version', 'accepts'],
        properties: {
          resource: { type: 'string', format: 'uri' },
          type: { type: 'string', enum: ['http', 'mcp'] },
          x402Version: { type: 'integer' },
          lastUpdated: { type: 'string', format: 'date-time' },
          accepts: { type: 'array', items: { $ref: '#/components/schemas/PaymentOffer' } },
          extensions: { type: 'object', additionalProperties: true },
        },
      },
      BazaarList: {
        type: 'object',
        description: 'Cursor-paginated list. Pass next_cursor back as `cursor` to get the next page.',
        required: ['x402Version', 'items'],
        properties: {
          x402Version: { type: 'integer' },
          items: { type: 'array', items: { $ref: '#/components/schemas/BazaarItem' } },
          total: { type: 'integer', description: 'Total items across all pages' },
          next_cursor: {
            type: ['string', 'null'],
            description: 'Opaque cursor for the next page, null on the last page',
          },
        },
      },
      CheckoutSession: {
        type: 'object',
        description: 'ACP checkout session over this merchant priced resources.',
        required: ['id', 'status', 'currency', 'line_items', 'totals'],
        properties: {
          id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['not_ready_for_payment', 'ready_for_payment', 'completed', 'canceled'],
          },
          currency: { type: 'string', description: 'ISO 4217, lowercase' },
          line_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                item: {
                  type: 'object',
                  properties: { id: { type: 'string' }, quantity: { type: 'integer' } },
                },
                base_amount: { type: 'integer' },
                discount: { type: 'integer' },
                subtotal: { type: 'integer' },
                tax: { type: 'integer' },
                total: { type: 'integer' },
                payment_url: { type: 'string', format: 'uri', description: 'The URL that answers 402 for this line' },
              },
            },
          },
          totals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                display_text: { type: 'string' },
                amount: { type: 'integer' },
              },
            },
          },
          messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
          links: { type: 'array', items: { type: 'object', additionalProperties: true } },
          fulfillment_options: { type: 'array', items: { type: 'object', additionalProperties: true } },
          merchant_authorization: {
            type: 'string',
            description: 'AP2 detached JWS over this body. Verify with the key at /.well-known/ucp.',
          },
          expires_at: { type: 'string', format: 'date-time' },
        },
      },
      AcpError: {
        type: 'object',
        description: 'ACP-shaped error, as the Agentic Commerce Protocol prescribes.',
        required: ['type', 'code', 'message'],
        properties: {
          type: {
            type: 'string',
            enum: ['invalid_request', 'rate_limit_exceeded', 'processing_error', 'service_unavailable'],
          },
          code: { type: 'string' },
          message: { type: 'string' },
          param: { type: 'string', description: 'JSONPath to the offending field' },
        },
      },
    },
    parameters: {
      ApiVersion: {
        name: 'API-Version',
        in: 'header',
        required: false,
        description: 'Pin the API version (date form). Omitted means current.',
        schema: { type: 'string', default: '2026-09-01' },
      },
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        description:
          'Client-supplied unique key. Retrying a write with the same key returns the first result instead of doing the work twice.',
        schema: { type: 'string', maxLength: 255 },
      },
      Cursor: {
        name: 'cursor',
        in: 'query',
        required: false,
        description: 'Cursor from a previous response next_cursor.',
        schema: { type: 'string' },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Page size, 1 to 100.',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
      },
    },
    headers: {
      RateLimit: {
        description: 'RFC draft rate-limit state, e.g. "default";r=94;t=44',
        schema: { type: 'string' },
      },
      'RateLimit-Policy': {
        description: 'The quota in force, e.g. "default";q=120;w=60',
        schema: { type: 'string' },
      },
      'Retry-After': { description: 'Seconds to wait after a 429', schema: { type: 'integer' } },
    },
    responses: {
      Problem400: respuestaError('Malformed request'),
      Problem404: respuestaError('No such resource on this merchant'),
      Problem429: {
        ...respuestaError('Too many requests. Back off for Retry-After seconds.'),
        headers: {
          'Retry-After': { $ref: '#/components/headers/Retry-After' },
          RateLimit: { $ref: '#/components/headers/RateLimit' },
        },
      },
      Problem500: respuestaError('Something failed on our side'),
      Problem502: respuestaError('You paid and the origin failed. The payment is refunded on-chain automatically.'),
    },
  }

  // Cada operación generada por mppx: operationId, respuestas tipadas, errores.
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (typeof op !== 'object' || op === null) continue
      const o = op as Record<string, unknown>
      o.operationId ??= operationId(method, path)
      o.tags = ['paid-resources']
      o.description ??= `${o.summary ?? path}. Answers 402 with the payment terms until you present a credential.`
      o.parameters = [
        ...((o.parameters as unknown[]) ?? []),
        { $ref: '#/components/parameters/ApiVersion' },
        ...(method === 'get' || method === 'head' ? [] : [{ $ref: '#/components/parameters/IdempotencyKey' }]),
      ]
      const res = (o.responses ?? {}) as Record<string, unknown>
      res['200'] = {
        description: 'Paid. The resource, plus a Payment-Receipt header as proof.',
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        headers: {
          'Payment-Receipt': { description: 'Signed receipt for what you just bought', schema: { type: 'string' } },
          RateLimit: { $ref: '#/components/headers/RateLimit' },
          'RateLimit-Policy': { $ref: '#/components/headers/RateLimit-Policy' },
        },
      }
      res['402'] = {
        description: 'Payment required. Not an error: this is the price.',
        content: { 'application/problem+json': { schema: PROBLEM } },
        headers: {
          'WWW-Authenticate': { description: 'One Payment challenge per supported network', schema: { type: 'string' } },
          'Payment-Required': { description: 'Same terms in x402 form', schema: { type: 'string' } },
        },
      }
      res['404'] = { $ref: '#/components/responses/Problem404' }
      res['429'] = { $ref: '#/components/responses/Problem429' }
      res['502'] = { $ref: '#/components/responses/Problem502' }
      o.responses = res
    }
  }

  // Las superficies que no pasan por mppx pero un agente igual necesita.
  doc.paths['/discovery/resources'] = {
    get: {
      operationId: 'listPricedResources',
      tags: ['discovery'],
      summary: 'List everything this merchant charges for',
      description:
        'x402 Bazaar catalog: the exact URLs that answer 402 and the terms each one accepts. Free to call. Cursor-paginated.',
      parameters: [
        { $ref: '#/components/parameters/Cursor' },
        { $ref: '#/components/parameters/Limit' },
        { $ref: '#/components/parameters/ApiVersion' },
      ],
      responses: {
        '200': {
          description: 'One page of the catalog',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BazaarList' } } },
          headers: {
            RateLimit: { $ref: '#/components/headers/RateLimit' },
            'RateLimit-Policy': { $ref: '#/components/headers/RateLimit-Policy' },
          },
        },
        '404': { $ref: '#/components/responses/Problem404' },
        '429': { $ref: '#/components/responses/Problem429' },
      },
    },
  }

  doc.paths['/checkout_sessions'] = {
    post: {
      operationId: 'createCheckoutSession',
      tags: ['commerce'],
      summary: 'Create an ACP checkout session',
      description:
        'Agentic Commerce Protocol checkout over this merchant priced resources. Returns the lines to pay and an AP2 merchant signature over the cart.',
      parameters: [
        { $ref: '#/components/parameters/IdempotencyKey' },
        { $ref: '#/components/parameters/ApiVersion' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['id', 'quantity'],
                    properties: {
                      id: { type: 'string', description: 'Resource slug from /discovery/resources' },
                      quantity: { type: 'integer', minimum: 1 },
                    },
                  },
                },
                buyer: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Session created and ready for payment',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutSession' } } },
        },
        '400': {
          description: 'ACP-shaped validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AcpError' } } },
        },
        '429': { $ref: '#/components/responses/Problem429' },
      },
    },
  }

  doc.paths['/checkout_sessions/{id}'] = {
    get: {
      operationId: 'getCheckoutSession',
      tags: ['commerce'],
      summary: 'Read a checkout session',
      description:
        'Fetch a session created with createCheckoutSession, including its line items and the AP2 merchant signature. Sessions expire 15 minutes after creation.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { $ref: '#/components/parameters/ApiVersion' },
      ],
      responses: {
        '200': {
          description: 'The session',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutSession' } } },
        },
        '404': {
          description: 'Unknown or expired session',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AcpError' } } },
        },
      },
    },
  }

  doc.paths['/agentic_commerce/delegate_payment'] = {
    post: {
      operationId: 'delegatePayment',
      tags: ['commerce'],
      summary: 'ACP Delegate Payment (cards not supported here)',
      description:
        'This merchant settles in stablecoin over HTTP 402 and is not a card processor. The endpoint answers with an ACP-shaped error naming the real rail. No card data is accepted or stored.',
      parameters: [
        { $ref: '#/components/parameters/IdempotencyKey' },
        { $ref: '#/components/parameters/ApiVersion' },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
      },
      responses: {
        '400': {
          description: 'Cards are not a supported instrument on this merchant',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AcpError' } } },
        },
      },
    },
  }

  return doc
}
