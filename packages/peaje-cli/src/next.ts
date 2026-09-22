/**
 * Ediciones de texto sobre archivos de Next. Sin parser: solo los casos
 * simples y reconocibles; todo lo demás queda en `manual` con la instrucción.
 * Preferimos no tocar a tocar mal: el archivo es del negocio, no nuestro.
 */

export type Edicion = { ok: true; src: string } | { ok: false; motivo: 'already' | 'complex' }

const IDENT = String.raw`[A-Za-z_$][\w$]*`

/**
 * Envuelve el export de `next.config.*` con `withPeaje(X, { slug })`.
 * Simple = termina en `export default X` o `module.exports = X`, donde X es un
 * identificador o un objeto literal. Cualquier wrapper (`withSentryConfig(...)`)
 * o forma rara queda para el agente: no se puede saber dónde va el nuestro.
 */
export function envolverNextConfig(src: string, slug: string): Edicion {
  if (/\bwithPeaje\b/.test(src)) return { ok: false, motivo: 'already' }
  const opciones = `{ slug: ${JSON.stringify(slug)} }`

  const esm = new RegExp(String.raw`(^|\n)export default\s+(${IDENT}|\{[\s\S]*\})\s*;?\s*$`)
  const mEsm = esm.exec(src)
  if (mEsm) {
    const cuerpo = src.replace(esm, (_todo, salto: string, x: string) => `${salto}export default withPeaje(${x}, ${opciones})\n`)
    return { ok: true, src: `import { withPeaje } from '@peaje/next'\n${cuerpo}` }
  }

  const cjs = new RegExp(String.raw`(^|\n)module\.exports\s*=\s*(${IDENT}|\{[\s\S]*\})\s*;?\s*$`)
  const mCjs = cjs.exec(src)
  if (mCjs) {
    const cuerpo = src.replace(cjs, (_todo, salto: string, x: string) => `${salto}module.exports = withPeaje(${x}, ${opciones})\n`)
    return { ok: true, src: `const { withPeaje } = require('@peaje/next')\n${cuerpo}` }
  }

  return { ok: false, motivo: 'complex' }
}

/** Config nueva cuando el proyecto no tiene ninguna. */
export function nextConfigNuevo(slug: string, typescript: boolean): { path: string; content: string } {
  const opciones = `{ slug: ${JSON.stringify(slug)} }`
  if (typescript) {
    return {
      path: 'next.config.ts',
      content: `import type { NextConfig } from 'next'\nimport { withPeaje } from '@peaje/next'\n\nconst nextConfig: NextConfig = {}\n\nexport default withPeaje(nextConfig, ${opciones})\n`,
    }
  }
  return {
    path: 'next.config.mjs',
    content: `import { withPeaje } from '@peaje/next'\n\n/** @type {import('next').NextConfig} */\nconst nextConfig = {}\n\nexport default withPeaje(nextConfig, ${opciones})\n`,
  }
}

/**
 * Inserta un import después del último `import` del archivo. Un import puede
 * ocupar varias líneas, así que el final es la primera cadena entre comillas
 * después del `import`, no el salto de línea.
 */
export function agregarImport(src: string, sentencia: string): string {
  const imports = [...src.matchAll(/^import\b/gm)]
  const ultimo = imports.at(-1)
  if (!ultimo || ultimo.index === undefined) {
    // Sin imports: después de la directiva 'use client'/'use server' si la hubiera.
    const directiva = /^(['"]use (client|server)['"];?\s*\n)/.exec(src)
    return directiva ? `${directiva[1]}${sentencia}\n${src.slice(directiva[1]!.length)}` : `${sentencia}\n${src}`
  }
  const resto = src.slice(ultimo.index)
  // `[^\S\n]` y no `\s`: un `\s*` se comería la línea en blanco que separa imports de código.
  const fin = /^import[\s\S]*?['"][^'"\n]*['"][^\S\n]*;?[^\S\n]*(\n|$)/.exec(resto)
  const corte = ultimo.index + (fin ? fin[0].length : resto.indexOf('\n') + 1)
  return `${src.slice(0, corte)}${sentencia}\n${src.slice(corte)}`
}

function indentacionDeLinea(src: string, indice: number): string {
  const inicio = src.lastIndexOf('\n', indice) + 1
  return /^[ \t]*/.exec(src.slice(inicio, indice))?.[0] ?? ''
}

/**
 * Pone `<PeajeHead slug="..." />` en el root layout del app router. Con
 * `<head>` existente va adentro; sin `<head>` pero con `<html>` y `<body>`,
 * se crea el `<head>` justo antes del `<body>`.
 */
export function insertarPeajeHead(src: string, slug: string): Edicion {
  if (/\bPeajeHead\b/.test(src)) return { ok: false, motivo: 'already' }
  const etiqueta = `<PeajeHead slug=${JSON.stringify(slug)} />`
  const importe = `import { PeajeHead } from '@peaje/next/head'`

  const head = /<head(\s[^>]*)?(?<!\/)>/.exec(src)
  if (head && head.index !== undefined) {
    const indent = indentacionDeLinea(src, head.index)
    const corte = head.index + head[0].length
    const cuerpo = `${src.slice(0, corte)}\n${indent}  ${etiqueta}${src.slice(corte)}`
    return { ok: true, src: agregarImport(cuerpo, importe) }
  }

  const body = /<body[\s>]/.exec(src)
  if (/<html[\s>]/.test(src) && body && body.index !== undefined) {
    const indent = indentacionDeLinea(src, body.index)
    const inicioLinea = src.lastIndexOf('\n', body.index) + 1
    const bloque = `${indent}<head>\n${indent}  ${etiqueta}\n${indent}</head>\n`
    const cuerpo = `${src.slice(0, inicioLinea)}${bloque}${src.slice(inicioLinea)}`
    return { ok: true, src: agregarImport(cuerpo, importe) }
  }

  return { ok: false, motivo: 'complex' }
}

/** Agrega `@peaje/next` a dependencies conservando la indentación del archivo. */
export function agregarDependencia(pkgSrc: string, nombre: string, version: string): string | null {
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(pkgSrc) as Record<string, unknown>
  } catch {
    return null
  }
  const deps = { ...((pkg.dependencies as Record<string, string> | undefined) ?? {}) }
  if (deps[nombre]) return null
  deps[nombre] = version
  pkg.dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)))
  const indent = /^[ \t]+/m.exec(pkgSrc)?.[0] ?? '  '
  return `${JSON.stringify(pkg, null, indent)}${pkgSrc.endsWith('\n') ? '\n' : ''}`
}
