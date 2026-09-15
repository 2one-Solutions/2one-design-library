/*
  DLS data + logic layer for the MCP server (Phase 0, local).

  The 2one DLS is already machine-legible, so this layer is thin: it reads the
  committed data (manifest, graph, tokens, brand, rules) and, for the two pieces of
  real LOGIC (decide, check, what-uses), shells out to the repo's own scripts — so
  the MCP answers can never drift from what `npm run` / `npx 2one` produce.

  (Phase 2 / edge hosting would replace the shell-outs with in-process ports; kept
  as shell-outs here on purpose — zero reimplementation, guaranteed-faithful.)
*/
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

// mcp/ lives inside the DLS repo; the root is one level up.
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const readJSON = (rel) => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'))

// ---- committed data --------------------------------------------------------
export const getManifest = () => readJSON('manifest.json')
export const getGraph = () => readJSON('graph.json')
export const getBrand = () => readJSON('brand/brand.json')
export const getUxRules = () => readJSON('rules/ux-rules.json')
export function getTokens() {
  return {
    colors: readJSON('tokens/colors.json'),
    spacing: readJSON('tokens/spacing.json'),
    typography: readJSON('tokens/typography.json'),
  }
}

// ---- shell-outs to the real repo scripts -----------------------------------
function runScript(script, args) {
  const res = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', script), ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  const out = (res.stdout || '').trim()
  try {
    return JSON.parse(out)
  } catch {
    return { raw: out, stderr: (res.stderr || '').trim(), exitCode: res.status }
  }
}

/** Map a build intent → a DLS decision (component/pattern), or suggestions. */
export const decide = (intent) => runScript('graph-decide.mjs', ['decide', String(intent), '--json'])

/** Impact analysis: what uses this node/label. */
export const whatUses = (query) => runScript('what-uses.mjs', [String(query), '--json'])

/** Audit a snippet against the 2one rules (`npx 2one check`). Writes a temp file. */
export function check(code, ext = 'tsx') {
  const tmp = join(tmpdir(), `2one-mcp-check-${Date.now()}.${ext}`)
  try {
    writeFileSync(tmp, String(code), 'utf8')
    return runScript('cli.mjs', ['check', tmp, '--json'])
  } finally {
    try { rmSync(tmp) } catch { /* ignore */ }
  }
}

// ---- in-repo lookups -------------------------------------------------------
export function getComponent(name) {
  const g = getGraph()
  const node = g.nodes.find((n) => n.id === `component:${name}` || n.id === `component-2one:${name}`)
  if (!node) return { error: `No component "${name}". Try the search tool.` }
  // The rules that govern it (governed_by edges run component → rule:X).
  const governedBy = g.edges
    .filter((e) => (e.source || e.s) === node.id && e.type === 'governed_by')
    .map((e) => (e.target || e.t || '').replace('rule:', ''))
    .filter(Boolean)
  return { name, id: node.id, label: node.label, path: node.path ?? null, tier: node.tier ?? null, governed_by: governedBy }
}

export function getPattern(id) {
  const file = join(REPO_ROOT, 'rules', 'patterns', `${id}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const node = getGraph().nodes.find((n) => n.id === `pattern:${id}`)
  return node ?? { error: `No pattern "${id}". Known patterns live in rules/patterns/.` }
}

export function search(query, limit = 20) {
  const q = String(query).toLowerCase()
  return getGraph()
    .nodes.filter((n) => n.id.toLowerCase().includes(q) || (n.label || '').toLowerCase().includes(q))
    .slice(0, limit)
    .map((n) => ({ id: n.id, type: n.type, label: n.label ?? null }))
}

export function brandFacts() {
  const b = getBrand()
  return {
    name: b.name,
    tagline: b.tagline,
    mission: b.mission,
    voice: b.voice,
    tone: b.tone,
    accent: b.color?.accent,
    personas: b.personas,
    writing_rules: b.writing_rules,
    note: 'Answer only from these facts; never invent a brand fact (manifest.json contract).',
  }
}

/** Honest gaps — sourced from manifest.system.not_covered (never fake a capability). */
export function gaps() {
  const nc = getManifest().system?.not_covered
  return { not_covered: nc ?? [], source: 'manifest.json → system.not_covered' }
}

// ---- lightweight web-copy scan (mirrors check:web-copy's high-confidence rules) ---
const BAIT = ['delve', 'leverage', 'unlock', 'elevate', 'seamless', 'robust', 'spearhead', 'tapestry', 'landscape', 'journey', 'battle-tested']
export function webCopyCheck(text) {
  const t = String(text)
  const findings = []
  if (/\b(click here|read more)\b/i.test(t)) findings.push('Non-descriptive link text ("click here" / "read more") — name the destination instead.')
  const bait = BAIT.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t))
  if (bait.length) findings.push(`Bait/AI-slop words unless they're real repo terms: ${bait.join(', ')}.`)
  if (/>\s*https?:\/\//i.test(t) || /\]\(https?:\/\//.test(t) === false && /^https?:\/\//im.test(t.trim())) {
    // raw URL used as visible text
  }
  if (/\bwelcome to\b/i.test(t)) findings.push('Drop welcome filler ("Welcome to …").')
  return { ok: findings.length === 0, findings, rule: 'brand/brand.json writing_rules + docs/web-writing.md' }
}

/** Also expose which docs to read (as resource pointers). */
export function docList() {
  const dir = join(REPO_ROOT, 'docs')
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
}
