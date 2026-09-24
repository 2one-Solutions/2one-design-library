/*
  The client payload contract.

  A payload is the data a client owns: their brand facts and their theme. The
  engine and the components are shared and never change per client. This file
  is the single definition of what a payload may contain, and the studio, the
  AI Studio and (later) the MCP server all validate against it.

  ---- why it is strict ----

  Token values end up inside a <style> element, and an AI can author them. A
  value like `red; } body { display:none` would break out of its declaration.
  So nothing is free text: every writable variable is on an allowlist, every
  value must match a narrow pattern for its kind, and unknown keys are
  rejected rather than ignored. A hand edit and an AI edit pass the same gate.

  ---- the allowlist is a mirror, and a test keeps it honest ----

  TOKEN_VARS is the set of theme variables in src/styles/globals.css. It is
  written out here rather than parsed at runtime so this file has no
  filesystem dependency and can run in a browser. payload.test.mjs parses
  globals.css and fails if the two differ, so adding a variable to the theme
  without teaching the contract is a failing check, not a silent gap.

  Deliberately absent for now: logos (inline SVG can carry script), copy
  overrides and client components. Each arrives in its own slice.
*/

export const PAYLOAD_VERSION = 1

/** Colour variables, defined per theme (`:root` light, `.dark` dark). */
export const COLOR_VARS = [
  '--accent', '--accent-foreground', '--background', '--border', '--brand', '--brand-foreground',
  '--card', '--card-foreground', '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--destructive', '--destructive-foreground', '--foreground', '--input', '--muted',
  '--muted-foreground', '--popover', '--popover-foreground', '--primary', '--primary-foreground',
  '--ring', '--scrim', '--secondary', '--secondary-foreground', '--sidebar', '--sidebar-accent',
  '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-foreground', '--sidebar-primary',
  '--sidebar-primary-foreground', '--sidebar-ring', '--success', '--success-foreground',
]

/** Length variables. Light theme only: a radius does not change with the theme. */
export const LENGTH_VARS = ['--radius']

/** Font stacks, shared by both themes. */
export const FONT_VARS = ['--font-sans', '--font-heading', '--font-link']

export const TOKEN_VARS = [...COLOR_VARS, ...LENGTH_VARS]

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|oklch)\([0-9a-zA-Z.,%/\s-]{1,60}\))$/
const LENGTH_RE = /^\d{1,3}(\.\d{1,3})?(px|rem)$/
// A font stack: names, commas, quotes. No parentheses, semicolons, braces or slashes.
const FONT_RE = /^[A-Za-z0-9 ,'"_-]{1,200}$/

const TOP_KEYS = ['version', 'name', 'brand', 'tokens']
const BRAND_KEYS = ['name', 'tagline', 'mission', 'vision', 'voice', 'tone']
const TOKEN_KEYS = ['light', 'dark', 'fonts']
const DESCRIPTOR_KEYS = ['descriptors', 'note']

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

const unknownKeys = (obj, allowed, path, errors) => {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${path}.${k}: not part of the payload contract`)
}

const checkText = (v, path, max, errors) => {
  if (typeof v !== 'string' || !v.trim()) errors.push(`${path}: must be a non-empty string`)
  else if (v.length > max) errors.push(`${path}: longer than ${max} characters`)
  // Markup characters have no place in brand facts, and they are the cheapest way to smuggle HTML.
  else if (/[<>]/.test(v)) errors.push(`${path}: must not contain < or >`)
}

function checkDescriptors(v, path, errors) {
  if (!isObject(v)) return errors.push(`${path}: must be an object with descriptors`)
  unknownKeys(v, DESCRIPTOR_KEYS, path, errors)
  if (!Array.isArray(v.descriptors) || v.descriptors.length === 0 || v.descriptors.length > 8) {
    errors.push(`${path}.descriptors: must be a list of 1 to 8 words`)
  } else {
    v.descriptors.forEach((d, i) => checkText(d, `${path}.descriptors[${i}]`, 40, errors))
  }
  if (v.note !== undefined) checkText(v.note, `${path}.note`, 400, errors)
}

function checkVarMap(map, allowed, re, kind, path, errors) {
  if (!isObject(map)) return errors.push(`${path}: must be an object`)
  for (const [k, v] of Object.entries(map)) {
    if (!allowed.includes(k)) errors.push(`${path}.${k}: not a themable variable`)
    else if (typeof v !== 'string' || !re.test(v.trim())) errors.push(`${path}.${k}: "${String(v).slice(0, 40)}" is not a valid ${kind}`)
  }
}

/**
 * Validate a payload. Returns { ok, errors }. Never throws on bad input, so an
 * AI proposal that fails validation is an error message to show, not a crash.
 */
export function validatePayload(payload) {
  const errors = []
  if (!isObject(payload)) return { ok: false, errors: ['payload: must be an object'] }
  unknownKeys(payload, TOP_KEYS, 'payload', errors)

  if (payload.version !== PAYLOAD_VERSION) errors.push(`payload.version: must be ${PAYLOAD_VERSION}`)
  checkText(payload.name, 'payload.name', 80, errors)

  if (!isObject(payload.brand)) {
    errors.push('payload.brand: must be an object')
  } else {
    const b = payload.brand
    unknownKeys(b, BRAND_KEYS, 'payload.brand', errors)
    checkText(b.name, 'payload.brand.name', 80, errors)
    for (const k of ['tagline', 'mission', 'vision']) if (b[k] !== undefined) checkText(b[k], `payload.brand.${k}`, 300, errors)
    for (const k of ['voice', 'tone']) if (b[k] !== undefined) checkDescriptors(b[k], `payload.brand.${k}`, errors)
  }

  if (!isObject(payload.tokens)) {
    errors.push('payload.tokens: must be an object')
  } else {
    const t = payload.tokens
    unknownKeys(t, TOKEN_KEYS, 'payload.tokens', errors)
    if (t.light !== undefined) {
      if (!isObject(t.light)) {
        errors.push('payload.tokens.light: must be an object')
      } else {
        const { [LENGTH_VARS[0]]: radius, ...colors } = t.light
        checkVarMap(colors, COLOR_VARS, COLOR_RE, 'colour', 'payload.tokens.light', errors)
        if (radius !== undefined) checkVarMap({ [LENGTH_VARS[0]]: radius }, LENGTH_VARS, LENGTH_RE, 'length', 'payload.tokens.light', errors)
      }
    }
    if (t.dark !== undefined) checkVarMap(t.dark, COLOR_VARS, COLOR_RE, 'colour', 'payload.tokens.dark', errors)
    if (t.fonts !== undefined) checkVarMap(t.fonts, FONT_VARS, FONT_RE, 'font stack', 'payload.tokens.fonts', errors)
  }

  return { ok: errors.length === 0, errors }
}
