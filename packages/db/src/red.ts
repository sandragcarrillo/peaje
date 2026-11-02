/**
 * Modo del registro de pagos (migración 20261101000000): los pagos de testnet
 * y de mainnet viven en la misma tabla, marcados con `testnet`. Todo lo que el
 * store lee de `payments` queda en el modo del proceso, así el panel en mainnet
 * nunca suma pagos de prueba. Sale de NEXT_PUBLIC_RED, el mismo nombre en
 * Railway y Vercel (el gateway lo valida al arrancar con `modoTestnet`). Se lee
 * en cada llamada porque los tests fijan el entorno después de importar.
 */
export function registroTestnet(): boolean {
  return (process.env.NEXT_PUBLIC_RED ?? process.env.TEMPO_NETWORK ?? 'testnet').trim() !== 'mainnet'
}
