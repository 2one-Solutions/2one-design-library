/*
  Turn a validated payload into the CSS that re-themes the components.

  The components read CSS variables, so a client's theme is just those variables
  redefined. No component code changes per client, which is what makes the
  engine/payload split hold on the frontend too.

  This refuses an invalid payload instead of emitting whatever it can. A
  half-applied theme from a rejected AI proposal would look like a bug in the
  design system rather than a rejected edit.
*/
import { validatePayload } from './contract.mjs'

// `scope` lets the AI Studio preview theme one container instead of the whole page.
const SCOPE_RE = /^[.#]?[A-Za-z][A-Za-z0-9_-]{0,63}$/

const block = (selector, map) => {
  const lines = Object.entries(map).map(([k, v]) => `  ${k}: ${String(v).trim()};`)
  return lines.length ? `${selector} {\n${lines.join('\n')}\n}\n` : ''
}

/**
 * @param {object} payload a payload that passes validatePayload
 * @param {{ scope?: string }} [options] scope: a class or id selector to theme instead of :root
 * @returns {string} CSS text
 */
export function payloadToCss(payload, { scope } = {}) {
  const { ok, errors } = validatePayload(payload)
  if (!ok) throw new Error(`payloadToCss: invalid payload (${errors[0]}${errors.length > 1 ? `, +${errors.length - 1} more` : ''})`)
  if (scope !== undefined && !SCOPE_RE.test(scope)) throw new Error(`payloadToCss: unsafe scope "${scope}"`)

  const light = scope ?? ':root'
  const dark = scope ? `.dark ${scope}, ${scope}.dark` : '.dark'
  const { light: lightVars = {}, dark: darkVars = {}, fonts = {} } = payload.tokens

  return block(light, { ...fonts, ...lightVars }) + block(dark, darkVars)
}
