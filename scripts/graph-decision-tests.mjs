/*
  graph-decision-tests — deterministic regression tests for AI decisions.

  Each case asks graph-decide a real 2one question and asserts the answer the
  2one rules require. The point is not to test the graph's size but to LOCK the
  AI's behaviour: if a graph change silently alters a design decision, this fails.

  Expected answers come from the authored 2one rules (graph/decisions.json), not
  from invented values. Run: npm run graph:test
*/
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { config as cfg } from './lib/config.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// graph-decide prints its JSON result and then exits non-zero on a no-match (a valid
// "nothing resolved, here are suggestions" response), so parse stdout even when
// execFileSync throws on the exit code.
const decide = (args) => {
  try { return JSON.parse(execFileSync('node', [join(root, 'scripts/graph-decide.mjs'), ...args, '--json'], { encoding: 'utf8' })) }
  catch (e) { if (e.stdout) { try { return JSON.parse(e.stdout) } catch { /* fall through */ } } throw e }
}

const cases = [
  { name: 'primary action → Primary Button',
    run: () => decide(['decide', 'primary-action']),
    expect: (r) => r.decision === 'variant:button-primary' },

  { name: '"app shell" (free text) → app-shell pattern (D1 fuzzy + D2 intent)',
    run: () => decide(['decide', 'app shell']),
    expect: (r) => r.decision === 'pattern:app-shell' },

  { name: '"show profile" → profile-header pattern (D1: articles/order-agnostic)',
    run: () => decide(['decide', 'show profile']),
    expect: (r) => r.decision === 'pattern:profile-header' },

  { name: 'unknown domain intent → no decision, but extension guidance (D3)',
    run: () => decide(['decide', 'book a hotel room']),
    expect: (r) => !r.decision && /domain pack/.test(r.guidance || '') },

  { name: 'submit a form → form-submission pattern, composed with Input+Label+Primary Button',
    run: () => decide(['decide', 'submit-form']),
    expect: (r) => r.decision === 'pattern:form-submission' &&
      ['component:input', 'component:label', 'variant:button-primary'].every((c) => r.composition.some((x) => x.id === c)) },

  { name: 'destructive action → destructive-confirmation (AlertDialog + Destructive Button), destructive-intent mandatory',
    run: () => decide(['decide', 'destructive-action']),
    expect: (r) => r.decision === 'pattern:destructive-confirmation' &&
      r.composition.some((x) => x.id === 'component:alert-dialog') &&
      r.mandatory_rules.some((x) => x.id === 'rule:destructive-intent') },

  { name: 'confirm an action → AlertDialog',
    run: () => decide(['decide', 'confirm-action']),
    expect: (r) => r.decision === 'component:alert-dialog' },

  { name: 'supplementary info → Tooltip',
    run: () => decide(['decide', 'supplementary-info']),
    expect: (r) => r.decision === 'component:tooltip' },

  { name: 'essential information must NOT be tooltip-only',
    run: () => decide(['check', 'component:tooltip', 'essential-instruction']),
    expect: (r) => r.verdict === 'NO' && r.governing_rules.includes('rule:tooltip-not-essential') },

  { name: 'destructive styling must NOT be used for navigation',
    run: () => decide(['check', 'variant:button-destructive', 'navigate']),
    expect: (r) => r.verdict === 'NO' && r.governing_rules.includes('rule:destructive-intent') },

  { name: 'what replaces Dialog on mobile → Sheet',
    run: () => decide(['alternatives', 'component:dialog']),
    expect: (r) => r.alternatives.includes('component:sheet') },

  { name: 'Sheet is preferred over Dialog, sourced to the DLS docs',
    run: () => decide(['why', 'component:sheet', 'component:dialog']),
    expect: (r) => r.edges.some((e) => e.type === 'preferred_over' && e.evidence === cfg.rel('docs.guide')) },

  { name: 'Button carries the mandatory no-color-alone + pill rules',
    run: () => decide(['rules', 'component:button']),
    expect: (r) => r.rules.some((x) => x.id === 'rule:no-color-alone') && r.rules.some((x) => x.id === 'rule:pill-buttons') },
]

let failed = 0
console.log('\n  graph-decision-tests\n')
for (const c of cases) {
  let ok = false, err = null
  try { ok = c.expect(c.run()) } catch (e) { err = e.message }
  console.log(`   ${ok ? '✓' : '✗'} ${c.name}${err ? '  — ' + err : ''}`)
  if (!ok) failed++
}
console.log('')
if (failed) { console.error(`  ✗ ${failed}/${cases.length} decision tests failed — AI behaviour changed\n`); process.exit(1) }
console.log(`  ✓ all ${cases.length} decisions resolve as the 2one rules require\n`)
