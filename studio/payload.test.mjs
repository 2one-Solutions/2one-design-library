/*
  Tests for the client payload contract and the CSS it generates.

  The point of this file is the two ways the contract can quietly stop being
  true:

    1. The theme grows a variable the contract does not know. Then a client
       cannot theme it and nothing says so. The drift guard below fails first.
    2. A value that should be rejected is accepted. Token values land in a
       <style> element and an AI can write them, so the injection cases are
       tested as attacks, not as "invalid input".

  Run: npm run check:studio
*/
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validatePayload, TOKEN_VARS, FONT_VARS } from './src/payload/contract.mjs'
import { payloadToCss } from './src/payload/to-css.mjs'
import { buildSeedPayload, themeVarsInGlobals, REPO_ROOT } from './src/payload/seed.mjs'

const fails = []
const t = (name, ok) => { if (!ok) fails.push(name) }

const seed = buildSeedPayload()
const committed = JSON.parse(readFileSync(join(REPO_ROOT, 'studio/src/payload/2one.payload.json'), 'utf8'))

// ---- the seed is real, valid and current ----
const seedResult = validatePayload(seed)
t('seed: 2one payload validates', seedResult.ok)
if (!seedResult.ok) console.error(seedResult.errors.slice(0, 5))
t('seed: committed file matches what the theme produces (run npm run studio:seed)', JSON.stringify(seed) === JSON.stringify(committed))

// ---- drift guard: the allowlist is exactly the theme's variables ----
const { light, dark } = themeVarsInGlobals()
const inGlobals = new Set([...Object.keys(light), ...Object.keys(dark)])
const known = new Set(TOKEN_VARS)
const unknownToContract = [...inGlobals].filter((v) => !known.has(v))
const unknownToTheme = [...known].filter((v) => !inGlobals.has(v))
t(`drift: globals.css declares variables the contract does not know: ${unknownToContract.join(', ')}`, unknownToContract.length === 0)
t(`drift: contract lists variables globals.css does not declare: ${unknownToTheme.join(', ')}`, unknownToTheme.length === 0)
t('drift: font variables exist in tokens/typography.css', FONT_VARS.every((v) => Boolean(seed.tokens.fonts[v])))

// ---- attacks a client or an AI could try ----
const withLight = (v) => ({ ...seed, tokens: { ...seed.tokens, light: { ...seed.tokens.light, '--primary': v } } })
const rejects = (name, payload) => t(`rejects: ${name}`, validatePayload(payload).ok === false)

rejects('a declaration breakout', withLight('red; } body { display: none'))
rejects('a semicolon inside a colour function', withLight('rgb(0 0 0;)'))
rejects('a brace inside a colour function', withLight('rgb(0 0 0)} a{x:y'))
rejects('a declaration smuggled inside a colour function', withLight('rgb(0 0 0; --brand: red)'))
rejects('a url() value', withLight('url(https://evil.example/x)'))
rejects('a closing style tag', withLight('#fff</style><script>alert(1)</script>'))
rejects('an expression', withLight('expression(alert(1))'))
rejects('a named colour keyword', withLight('red'))
rejects('a non-string value', withLight(12))
rejects('an unknown variable', { ...seed, tokens: { ...seed.tokens, light: { ...seed.tokens.light, '--evil': '#fff' } } })
rejects('an unknown top-level key', { ...seed, extra: 1 })
rejects('an unknown brand key', { ...seed, brand: { ...seed.brand, logo: '<svg onload=alert(1)>' } })
rejects('the wrong version', { ...seed, version: 2 })
rejects('markup in a brand fact', { ...seed, brand: { ...seed.brand, tagline: 'hi <img src=x onerror=alert(1)>' } })
rejects('a font stack with a brace', { ...seed, tokens: { ...seed.tokens, fonts: { '--font-sans': 'Inter; } body {' } } })
rejects('a bad radius', { ...seed, tokens: { ...seed.tokens, light: { ...seed.tokens.light, '--radius': '1em' } } })
rejects('a colour variable set on the length rule', { ...seed, tokens: { ...seed.tokens, light: { ...seed.tokens.light, '--radius': '#fff' } } })
rejects('a non-object payload', 'nope')
rejects('a non-object light theme', { ...seed, tokens: { ...seed.tokens, light: 'nope' } })

// ---- the generator ----
let css = ''
try { css = payloadToCss(seed) } catch (e) { fails.push('css: the seed payload could not be converted: ' + e.message) }
t('css: light theme goes on :root', css.includes(':root {'))
t('css: dark theme goes on .dark', css.includes('.dark {'))
t('css: carries the brand variable', /--brand:\s*#[0-9a-fA-F]+;/.test(css))
t('css: carries the font variables', css.includes('--font-heading:'))
t('css: emits no markup or url()', !/[<>]|url\(/.test(css))

let threw = false
try { payloadToCss({ ...seed, version: 9 }) } catch { threw = true }
t('css: refuses an invalid payload instead of emitting part of it', threw)

const scoped = payloadToCss(seed, { scope: '.studio-preview' })
t('css: a scope themes that container, not :root', scoped.startsWith('.studio-preview {') && !scoped.includes(':root'))
t('css: a scoped dark theme follows the .dark class', scoped.includes('.dark .studio-preview, .studio-preview.dark {'))
for (const bad of ['body, x', '} a {', '.a b', '']) {
  let unsafe = false
  try { payloadToCss(seed, { scope: bad }) } catch { unsafe = true }
  t(`css: refuses unsafe scope "${bad}"`, unsafe)
}

if (fails.length) {
  console.error(`\n  ✗ check:studio — ${fails.length} contract(s) broken:\n`)
  for (const f of fails) console.error(`    · ${f}`)
  console.error('\n  A payload value reaches a <style> element. A loose contract here is a CSS injection path.\n')
  process.exit(1)
}
console.log('\n  ✓ check:studio — the payload contract matches the theme, rejects injection, and generates valid CSS\n')
