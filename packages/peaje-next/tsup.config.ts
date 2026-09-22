import { defineConfig } from 'tsup'

/**
 * `@peaje/shared` es privado en el workspace: se bundlea dentro del dist para
 * que el paquete publicado no dependa de él. `next` y `react` quedan como
 * peers externos (el host ya los tiene).
 */
export default defineConfig({
  entry: { index: 'src/index.ts', head: 'src/head.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  noExternal: ['@peaje/shared'],
  external: ['next', 'next/headers', 'react', 'react/jsx-runtime'],
})
