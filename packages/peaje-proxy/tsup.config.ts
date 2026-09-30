import { defineConfig } from 'tsup'

/**
 * `@peaje/shared` es privado en el workspace: se bundlea dentro del dist para
 * que el paquete publicado no dependa de él.
 */
export default defineConfig({
  entry: { index: 'src/index.ts', express: 'src/express.ts', hono: 'src/hono.ts', vercel: 'src/vercel.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  noExternal: ['@peaje/shared'],
  external: ['express', 'hono'],
})
