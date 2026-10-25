// Catálogo de Peaje en Paddle: un producto (Peaje Pro) con dos precios
// mensuales en USD, sin prueba gratis y de a una unidad: founder US$30 y pro
// US$69 (packages/db/src/planes.ts). Solo crea, nunca edita ni borra.
//
// Por defecto apunta al SANDBOX. Con --live usa la cuenta de producción.
//
//   PADDLE_API_KEY=pdl_sdbx_... npx tsx scripts/seed-paddle.mts --dry     # solo muestra el plan
//   PADDLE_API_KEY=pdl_sdbx_... npx tsx scripts/seed-paddle.mts           # crea en sandbox
//   PADDLE_API_KEY_LIVE=pdl_live_... npx tsx scripts/seed-paddle.mts --live
//
// La clave se crea en Paddle > Developer tools > Authentication con permisos
// product.write y price.write. Nunca va al repo.
import { PRECIOS_USD } from '../packages/db/src/planes'

const DRY = process.argv.includes('--dry')
const LIVE = process.argv.includes('--live')

const PRODUCTO = {
  name: 'Peaje Pro',
  tax_category: 'saas',
  description:
    'Peaje Pro agent for one business: AI assistant citation tracking, chat with the agent, Telegram and Slack, page drafts, mystery buyer and weekly email. Billed monthly.',
  custom_data: { app: 'peaje' },
}

const precio = (plan: 'founder' | 'pro', nombre: string, descripcion: string) => ({
  description: descripcion,
  name: nombre,
  unit_price: { amount: String(PRECIOS_USD[plan] * 100), currency_code: 'USD' },
  billing_cycle: { interval: 'month', frequency: 1 },
  // Una suscripción por negocio: nada de comprar 3 unidades.
  quantity: { minimum: 1, maximum: 1 },
  custom_data: { plan },
})

const PRECIOS = {
  founder: precio('founder', 'Founder, monthly', 'Peaje Pro founder monthly (first 50 businesses)'),
  pro: precio('pro', 'Pro, monthly', 'Peaje Pro monthly'),
}

async function main() {
  const destino = LIVE ? 'PRODUCCIÓN' : 'sandbox'
  console.log(DRY ? 'Plan (nada se crea):' : `Creando en el ${destino} de Paddle…`)
  console.log(JSON.stringify({ producto: PRODUCTO, precios: PRECIOS }, null, 2))
  if (DRY) return

  const nombreClave = LIVE ? 'PADDLE_API_KEY_LIVE' : 'PADDLE_API_KEY'
  const clave = process.env[nombreClave]
  if (!clave) throw new Error(`Falta ${nombreClave} (con permisos product.write y price.write).`)
  if (LIVE !== clave.startsWith('pdl_live_')) throw new Error(`La clave de ${nombreClave} no corresponde al ambiente ${destino}.`)
  const base = LIVE ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'

  const post = async (ruta: string, cuerpo: unknown) => {
    const res = await fetch(`${base}${ruta}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const json = (await res.json()) as { data?: { id: string }; error?: unknown }
    if (!res.ok || !json.data) throw new Error(`${ruta} ${res.status}: ${JSON.stringify(json.error ?? json)}`)
    return json.data
  }

  const producto = await post('/products', PRODUCTO)
  const founder = await post('/prices', { ...PRECIOS.founder, product_id: producto.id })
  const pro = await post('/prices', { ...PRECIOS.pro, product_id: producto.id })
  console.log(`\nIDs creados (${destino}):`)
  console.log(JSON.stringify({ product_id: producto.id, PADDLE_PRICE_FOUNDER: founder.id, PADDLE_PRICE_PRO: pro.id }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
