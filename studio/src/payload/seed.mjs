/*
  Build 2one's own payload from the files that already define it.

  A new client should start from a working system and change what they want,
  not from an empty form. This derives the starting payload from the real theme
  (src/styles/globals.css), the font tokens and brand/brand.json, so it cannot
  drift from what the components actually render. The committed
  2one.payload.json is this function's output, and payload.test.mjs fails if
  the two differ.

  Node only (it reads files). The contract itself stays browser safe.
*/
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAYLOAD_VERSION, FONT_VARS } from './contract.mjs'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations inside the first top-level block opened by `selector {`. */
function declarationsOf(css, selector) {
  const start = css.search(new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'm'))
  if (start === -1) throw new Error(`seed: no "${selector} {" block found`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const out = {}
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, ' ')
  return out
}

/** Every theme variable the light and dark blocks declare, for the drift guard. */
export function themeVarsInGlobals(root = REPO_ROOT) {
  const css = stripComments(readFileSync(join(root, 'src/styles/globals.css'), 'utf8'))
  return { light: declarationsOf(css, ':root'), dark: declarationsOf(css, '.dark') }
}

export function buildSeedPayload(root = REPO_ROOT) {
  const { light, dark } = themeVarsInGlobals(root)
  const type = stripComments(readFileSync(join(root, 'tokens/typography.css'), 'utf8'))
  const fonts = {}
  for (const name of FONT_VARS) {
    const m = type.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
    if (m) fonts[name] = m[1].trim().replace(/\s+/g, ' ')
  }
  const brand = JSON.parse(readFileSync(join(root, 'brand/brand.json'), 'utf8'))
  const descriptors = (v) => (v && Array.isArray(v.descriptors) ? { descriptors: v.descriptors, ...(v.note ? { note: v.note } : {}) } : undefined)

  return {
    version: PAYLOAD_VERSION,
    name: brand.name,
    brand: {
      name: brand.name,
      ...(brand.tagline ? { tagline: brand.tagline } : {}),
      ...(brand.mission ? { mission: brand.mission } : {}),
      ...(brand.vision ? { vision: brand.vision } : {}),
      ...(descriptors(brand.voice) ? { voice: descriptors(brand.voice) } : {}),
      ...(descriptors(brand.tone) ? { tone: descriptors(brand.tone) } : {}),
    },
    tokens: { light, dark, fonts },
  }
}
