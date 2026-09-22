import { defineConfig } from 'tsup'

/**
 * Un solo archivo ESM con shebang y cero dependencias de runtime: `npx @peaje/cli@1`
 * tiene que arrancar rápido en la máquina de un agente. `@peaje/shared` es
 * privado y va bundleado.
 */
export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  dts: false,
  sourcemap: false,
  clean: true,
  splitting: false,
  noExternal: ['@peaje/shared'],
  banner: { js: '#!/usr/bin/env node' },
})
