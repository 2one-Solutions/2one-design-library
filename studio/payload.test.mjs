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
import { createLocalStore } from './src/payload/store.mjs'
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

// ---- client components are data only ----
const withComponents = (custom) => ({ ...seed, components: { custom } })
const price = { name: 'PriceTag', description: 'Shows a price with its currency.', props: [{ name: 'amount', type: 'number' }] }
t('components: a described component validates', validatePayload(withComponents([price])).ok)
rejects('a component name that is not PascalCase', withComponents([{ ...price, name: 'price tag' }]))
rejects('a duplicate component name', withComponents([price, price]))
rejects('markup in a component description', withComponents([{ ...price, description: 'x <script>' }]))
rejects('code smuggled in as a component field', withComponents([{ ...price, render: '() => alert(1)' }]))
rejects('a prop with a non-identifier name', withComponents([{ ...price, props: [{ name: 'a b', type: 'number' }] }]))
rejects('more than the allowed number of components', withComponents(Array.from({ length: 51 }, (_, i) => ({ name: `C${i}`, description: 'x' }))))
rejects('an unknown components key', { ...seed, components: { builtin: [] } })

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

// ---- the store ----
const memoryStorage = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), raw: m }
}
const storage = memoryStorage()
const store = createLocalStore({ seed, storage })
t('store: starts from the seed', store.load().name === seed.name)
const renamed = { ...seed, name: 'Acme', brand: { ...seed.brand, name: 'Acme' } }
t('store: accepts a valid save', store.save(renamed, 'rename').ok && store.load().name === 'Acme')
t('store: keeps the previous payload in history', store.history()[0]?.payload.name === seed.name && store.history()[0]?.note === 'rename')
const bad = store.save({ ...renamed, version: 9 })
t('store: refuses an invalid save and reports why', bad.ok === false && bad.errors.length > 0)
t('store: an invalid save leaves the current payload untouched', store.load().name === 'Acme')
t('store: a second store over the same storage sees the save', createLocalStore({ seed, storage }).load().name === 'Acme')
storage.raw.set('2one-studio-payload', '{not json')
t('store: corrupt storage falls back instead of throwing', createLocalStore({ seed, storage }).load().name === seed.name)
storage.raw.set('2one-studio-payload', JSON.stringify({ current: { ...seed, version: 9 }, history: [] }))
t('store: a stored payload that no longer validates is not trusted', createLocalStore({ seed, storage }).load().name === seed.name)
const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
const inMemory = createLocalStore({ seed, storage: throwing })
t('store: blocked storage still works for the session', inMemory.save(renamed).ok && inMemory.load().name === 'Acme')
store.reset()
t('store: reset returns to the seed and clears history', store.load().name === seed.name && store.history().length === 0)
const many = createLocalStore({ seed, storage: memoryStorage() })
for (let i = 0; i < 30; i++) many.save({ ...seed, name: `n${i}` })
t('store: history is capped', many.history().length === 20)

if (fails.length) {
  console.error(`\n  ✗ check:studio — ${fails.length} contract(s) broken:\n`)
  for (const f of fails) console.error(`    · ${f}`)
  console.error('\n  A payload value reaches a <style> element. A loose contract here is a CSS injection path.\n')
  process.exit(1)
}
console.log('\n  ✓ check:studio — the payload contract matches the theme, rejects injection, and generates valid CSS\n')
