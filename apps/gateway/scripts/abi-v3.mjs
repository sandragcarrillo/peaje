// Copia el ABI de PeajeSettlementV3 desde el artefacto de Foundry a
// src/abi/settlement-v3.ts. Correr después de `cd contracts && forge build`:
//   pnpm --filter @peaje/gateway abi:v3
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const artefacto = resolve(aqui, '../../../contracts/out/PeajeSettlementV3.sol/PeajeSettlementV3.json')
const destino = resolve(aqui, '../src/abi/settlement-v3.ts')

const { abi } = JSON.parse(readFileSync(artefacto, 'utf8'))
const texto = `// Generado por scripts/abi-v3.mjs desde contracts/out/PeajeSettlementV3.sol/PeajeSettlementV3.json.
// No editar a mano: \`cd contracts && forge build\` y después \`pnpm --filter @peaje/gateway abi:v3\`.
export const settlementV3Abi = ${JSON.stringify(abi, null, 2)} as const
`
writeFileSync(destino, texto)
console.log(`ABI de PeajeSettlementV3: ${abi.length} entradas en ${destino}`)
