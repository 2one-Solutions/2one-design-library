/*
  DLS data + logic layer for the MCP server.

  The 2one DLS is already machine-legible, so this layer is thin: it reads the
  committed data (manifest, graph, tokens, brand, rules) directly, and for the
  three pieces of real LOGIC (decide, check, checkPair) it calls the engine's
  published facade (scripts/api.mjs) in-process, so the MCP answers can never
  drift from what `npm run` / `npx 2one` produce, without paying for a spawned
  child process on every tool call.

  Which payload this file reads is not fixed to this repo — resolved via
  mcp/lib/payload.mjs from DLS_API_KEY (a path today, standing in for a real
  key once Supabase lands). `what_uses` is the one exception still shelling
  out: what-uses.mjs has not been refactored into an importable function yet
  (it is a CLI script, not an inert module like check-usage.mjs/graph-decide.mjs),
  so it is spawned the same way it always was. Noted here rather than silently
  left unexplained.

  ---- why resolution happens here, once, at module load ----

  scripts/api.mjs's `config` is a module-level singleton, resolved once when
  scripts/lib/config.mjs is first imported (by walking up from process.cwd()).
  A `configurePayload()` callable AFTER that import already ran could update
  which payload the read-a-file functions below use, but could never redirect
  `decide`/`check`/`checkPair` — they already closed over the old config. So
  resolution has to happen before scripts/api.mjs is ever imported, and it has
  to happen exactly once per process: one server process answers about one
  payload for its lifetime, same as scripts/mcp.mjs did and same as how the
  HTTP server already behaves today (resolved once at startup, unchanged for
  every request after). The entry files (server.mjs, server-http.mjs) set
  process.env.DLS_API_KEY before this module is ever imported; an unresolvable
  key throws here, which is a startup failure, not a fallback.
*/
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

import { resolvePayload } from './payload.mjs'

// ---- which payload this process answers about, resolved once ---------------
const PAYLOAD = resolvePayload({ apiKey: process.env.DLS_API_KEY || null })
if (!PAYLOAD.ok) throw new Error(`could not resolve a payload (${PAYLOAD.reason}). Check DLS_API_KEY / --api-key.`)

export const getPayloadInfo = () => ({ name: PAYLOAD.name, clientId: PAYLOAD.clientId })
const root = () => PAYLOAD.root

const readJSON = (rel) => JSON.parse(readFileSync(join(root(), rel), 'utf8'))
const readText = (rel) => readFileSync(join(root(), rel), 'utf8')

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

/*
  scripts/api.mjs's `config` singleton resolves the payload by walking up from
  process.cwd() at IMPORT time (scripts/lib/config.mjs). An MCP host decides
  this process's working directory — routinely the user's home folder, not the
  repo — so that walk-up cannot be trusted here any more than it could in the
  old stdio server. chdir to the resolved payload root before this module is
  first imported, so its singleton resolves against the right payload instead
  of whatever the host happened to launch us in. Safe today because the payload
  is resolved once per process (same as the HTTP server's current single-tenant
  behaviour); real per-request multi-tenancy will need scripts/api.mjs's graph
  functions to take an explicit root instead of relying on that singleton —
  left for the phase that actually builds per-request payloads.
*/
process.chdir(root())
const api = await import('../../scripts/api.mjs')
const { checkUsage, decide: engineDecide, checkPair: engineCheckPair, resolveNode, rulesFor, a11yFor, statesFor, alternativesFor, incompatibleWith } = api

// ---- engine calls, in-process -----------------------------------------------
/** Map a build intent -> a DLS decision (component/pattern), or suggestions. */
export const decide = (intent) => engineDecide(intent)

/** Impact analysis: what uses this node/label. Still a shell-out — see header. */
export function whatUses(query) {
  const res = spawnSync(process.execPath, [join(root(), 'scripts', 'what-uses.mjs'), String(query), '--json'], {
    cwd: root(),
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

/** Audit a snippet against the 2one rules. Writes a temp file so checkUsage has a real path. */
export function check(code, ext = 'tsx') {
  const tmp = join(tmpdir(), `2one-mcp-check-${Date.now()}.${ext}`)
  try {
    writeFileSync(tmp, String(code), 'utf8')
    const r = checkUsage({ targets: [tmp], cwd: root() })
    if (!r.ok) return { error: r.error.message, code: r.error.code }
    return { conforms: r.errors.length === 0, errors: r.errors, warnings: r.warnings, known: r.known }
  } finally {
    try { rmSync(tmp) } catch { /* ignore */ }
  }
}

/** Whether two components/tokens may be used together, and which rules decide it. */
export function checkPair(a, b) {
  return engineCheckPair(a, b)
}

// ---- in-repo lookups -------------------------------------------------------
/** Parse cva variant groups (variant/size/…) -> their options, from component source. */
function parseVariants(code) {
  const out = {}
  const m = code.match(/cva\([\s\S]*?variants:\s*\{([\s\S]*?)\n\s{4}\}/)
  const body = m ? m[1] : ''
  const groupRe = /(\w+):\s*\{([\s\S]*?)\n\s{6}\}/g
  let g
  while ((g = groupRe.exec(body))) {
    const opts = [...g[2].matchAll(/^\s{8}["']?([\w-]+)["']?:/gm)].map((x) => x[1])
    if (opts.length) out[g[1]] = opts
  }
  const def = code.match(/defaultVariants:\s*\{([\s\S]*?)\}/)
  return { groups: out, defaults: def ? Object.fromEntries([...def[1].matchAll(/(\w+):\s*["']([\w-]+)["']/g)].map((x) => [x[1], x[2]])) : {} }
}

/** Package import paths for a component from its source path. */
function importPaths(path, exportName) {
  const sub = path ? path.replace(/^src\//, '').replace(/\.tsx?$/, '') : null
  return {
    barrel: `import { ${exportName} } from '@2one/design-library'`,
    subpath: sub ? `import { ${exportName} } from '@2one/design-library/${sub}'` : null,
  }
}

export function getComponent(name) {
  const g = getGraph()
  const node = g.nodes.find((n) => n.id === `component:${name}` || n.id === `component-2one:${name}`)
  if (!node) return { error: `No component "${name}". Try the search tool.` }
  const governedBy = g.edges
    .filter((e) => (e.source || e.s) === node.id && e.type === 'governed_by')
    .map((e) => (e.target || e.t || '').replace('rule:', ''))
    .filter(Boolean)

  const exportName = node.label || name
  const path = node.path ?? null
  let variants = { groups: {}, defaults: {} }
  let props = []
  if (path && existsSync(join(root(), path))) {
    const code = readText(path)
    variants = parseVariants(code)
    // exported prop-type member names (best-effort: the component's *Props interface).
    const pi = code.match(new RegExp(`interface\\s+\\w*Props[^{]*\\{([\\s\\S]*?)\\n\\}`))
    if (pi) props = [...pi[1].matchAll(/^\s*(\w+)\??:/gm)].map((x) => x[1])
  }
  const opt = (grp) => (variants.groups[grp] ? ` ${grp}="${variants.groups[grp].find((o) => o !== variants.defaults[grp]) || variants.groups[grp][0]}"` : '')
  const example = `<${exportName}${variants.groups.variant ? opt('variant') : ''}>${exportName}</${exportName}>`

  // The graph-decide facets (states/accessibility/alternatives/incompatible_with)
  // only resolve for nodes the graph's own resolver knows about — best-effort,
  // same as scripts/mcp.mjs's dls_component tool.
  const resolvedId = resolveNode(name) ?? resolveNode(node.id)

  return {
    name,
    id: node.id,
    label: exportName,
    path,
    tier: node.tier ?? null,
    governed_by: governedBy,
    import: importPaths(path, exportName),
    variants: variants.groups,
    variant_defaults: variants.defaults,
    props,
    example,
    states: resolvedId ? statesFor(resolvedId) : [],
    accessibility: resolvedId ? a11yFor(resolvedId) : [],
    rules: resolvedId ? rulesFor(resolvedId) : [],
    alternatives: resolvedId ? alternativesFor(resolvedId) : [],
    incompatible_with: resolvedId ? incompatibleWith(resolvedId) : [],
  }
}

export function getPattern(id) {
  const file = join(root(), 'rules', 'patterns', `${id}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const node = getGraph().nodes.find((n) => n.id === `pattern:${id}`)
  return node ?? { error: `No pattern "${id}". Known patterns live in rules/patterns/.` }
}

/** A block (marketing section, login/signup, dashboard) — ALL source files an agent
 *  needs to assemble it: every file (multi-file blocks like dashboard-plain included),
 *  the import lines, exported symbols, and sample data. */
export function getBlock(name) {
  const g = getGraph()
  const node = g.nodes.find((n) => n.id === `block:${name}`)
  if (!node) return { error: `No block "${name}". Use list("block") or search.` }
  const label = node.label || name // e.g. "marketing/hero", "login-01", "dashboard-plain"

  const singleTsx = `src/blocks/${label}.tsx`
  const dir = `src/blocks/${label}`
  let relFiles = []
  if (existsSync(join(root(), singleTsx))) relFiles = [singleTsx]
  else if (existsSync(join(root(), dir)) && statSync(join(root(), dir)).isDirectory())
    relFiles = readdirSync(join(root(), dir)).filter((f) => /\.(tsx?|json)$/.test(f)).map((f) => `${dir}/${f}`)

  const files = relFiles.map((rel) => ({ path: rel, code: readText(rel) }))
  const main = relFiles.find((f) => f.endsWith('page.tsx')) || relFiles[0] || null
  const mainCode = main ? readText(main) : ''
  const imports = mainCode.split('\n').filter((l) => /^import\s/.test(l))
  const exports = [...mainCode.matchAll(/export\s+(?:function|const)\s+(\w+)/g)].map((m) => m[1])
  const dataFile = relFiles.find((f) => f.endsWith('.json'))
  const sample_data = dataFile ? JSON.parse(readText(dataFile)) : null

  return {
    id: node.id,
    label,
    main,
    exports,
    imports,
    files,
    sample_data,
    composes: g.edges
      .filter((e) => (e.source || e.s) === node.id && e.type === 'composed_of')
      .map((e) => (e.target || e.t)),
  }
}

/** A chart template — source + the expected data shape (chartData / chartConfig). */
export function getChart(name) {
  const g = getGraph()
  const node = g.nodes.find((n) => n.id === `chart:${name}`)
  const rel = `src/blocks/charts/${(node && node.label) || name}.tsx`
  if (!existsSync(join(root(), rel))) return { error: `No chart "${name}". Use list("chart").` }
  const code = readText(rel)
  const dataMatch = code.match(/const\s+chartData\s*=\s*(\[[\s\S]*?\n\])/)
  const configMatch = code.match(/const\s+chartConfig\s*=\s*(\{[\s\S]*?\n\})\s*(?:satisfies\s+\w+)?/)
  const firstRow = dataMatch ? (dataMatch[1].match(/\{[\s\S]*?\}/) || [null])[0] : null
  return {
    id: node ? node.id : `chart:${name}`,
    label: (node && node.label) || name,
    path: rel,
    code,
    data_shape: { chartData_first_row: firstRow, chartConfig: configMatch ? configMatch[1] : null },
  }
}

/** An AI-interface component (streaming-text, reasoning-panel, …) — node + spec + source. */
export function getAiComponent(name) {
  const node = getGraph().nodes.find((n) => n.id === `ai-component:${name}`)
  const specPath = `rules/ai-components/${name}.json`
  const hasSpec = existsSync(join(root(), specPath))
  if (!node && !hasSpec) return { error: `No ai-component "${name}".` }
  return {
    id: node?.id ?? `ai-component:${name}`,
    label: node?.label ?? name,
    description: node?.description ?? null,
    spec: hasSpec ? JSON.parse(readText(specPath)) : null,
    code: node?.source && existsSync(join(root(), node.source)) ? readText(node.source) : null,
  }
}

/** A guidance doc (web-writing, consuming, accessibility, …). No name -> list them. */
export function getDoc(name) {
  const docs = docList()
  if (!name) return { docs }
  const file = name.endsWith('.md') ? name : `${name}.md`
  if (!docs.includes(file)) return { error: `No doc "${name}". Available: ${docs.join(', ')}` }
  return { name: file, content: readText(`docs/${file}`) }
}

/** The 2one skill (wrong/right code per rule). No rule -> overview + list. */
export function getSkill(rule) {
  const rulesDir = join(root(), 'skills/2one-dls/rules')
  const available = existsSync(rulesDir) ? readdirSync(rulesDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')) : []
  if (!rule) {
    return { overview: existsSync(join(root(), 'skills/2one-dls/SKILL.md')) ? readText('skills/2one-dls/SKILL.md') : null, rules: available }
  }
  if (!available.includes(rule)) return { error: `No skill "${rule}". Available: ${available.join(', ')}` }
  return { rule, content: readText(`skills/2one-dls/rules/${rule}.md`) }
}

/** A single UX rule — text + rationale + severity. */
export function getRule(id) {
  const r = getUxRules().rules.find((x) => x.id === id)
  if (!r) return { error: `No rule "${id}". Use list("rule").` }
  return { id: r.id, category: r.category, severity: r.severity, label: r.label, statement: r.statement, rationale: r.rationale }
}

/** Enumerate ids + labels by type (component|block|chart|pattern|intent|rule|token|ai-component|recipe). */
const TYPE_MAP = {
  component: ['component', 'component-2one'],
  block: ['template-block'],
  chart: ['template-chart'],
  pattern: ['pattern'],
  intent: ['intent'],
  rule: ['rule'],
  token: ['token-color', 'token-type', 'token-radius'],
  'ai-component': ['ai-component'],
}
export function listByType(type) {
  if (type === 'recipe') return { type, items: recipeList().map((f) => ({ id: f.replace('.md', ''), label: f.replace('.md', '') })) }
  const types = TYPE_MAP[type]
  if (!types) return { error: `Unknown type "${type}". One of: ${Object.keys(TYPE_MAP).join(', ')}, recipe.` }
  return {
    type,
    items: getGraph().nodes.filter((n) => types.includes(n.type)).map((n) => ({ id: n.id.split(':')[1], label: n.label ?? null })),
  }
}

const recipeList = () => (existsSync(join(root(), 'recipes')) ? readdirSync(join(root(), 'recipes')).filter((f) => f.endsWith('.md')) : [])

/** A build recipe (build-an-app, build-a-website, …). No id -> list them. */
export function getRecipe(id) {
  const recipes = recipeList().map((f) => f.replace('.md', ''))
  if (!id) return { recipes }
  if (!recipes.includes(id)) return { error: `No recipe "${id}". Available: ${recipes.join(', ')}` }
  return { id, content: readText(`recipes/${id}.md`) }
}

export function search(query, limit = 20) {
  // Tokenize + OR-match + rank by score, so "stat metric card table chart" matches
  // (each word scored independently) instead of failing as one phrase.
  const tokens = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (!tokens.length) return []
  return getGraph()
    .nodes.map((n) => {
      const hay = `${n.id} ${n.label ?? ''}`.toLowerCase()
      const score = tokens.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0)
      return { id: n.id, type: n.type, label: n.label ?? null, score }
    })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
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
  return { not_covered: nc ?? [], source: 'manifest.json -> system.not_covered' }
}

// ---- lightweight web-copy scan (mirrors check:web-copy's high-confidence rules) ---
const BAIT = ['delve', 'leverage', 'unlock', 'elevate', 'seamless', 'robust', 'spearhead', 'tapestry', 'landscape', 'journey', 'battle-tested']
export function webCopyCheck(text) {
  const t = String(text)
  const findings = []
  if (/\b(click here|read more)\b/i.test(t)) findings.push('Non-descriptive link text ("click here" / "read more") — name the destination instead.')
  const bait = BAIT.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t))
  if (bait.length) findings.push(`Bait/AI-slop words unless they're real repo terms: ${bait.join(', ')}.`)
  if (/\bwelcome to\b/i.test(t)) findings.push('Drop welcome filler ("Welcome to …").')
  return { ok: findings.length === 0, findings, rule: 'brand/brand.json writing_rules + docs/web-writing.md' }
}

/** Also expose which docs to read (as resource pointers). */
export function docList() {
  const dir = join(root(), 'docs')
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
}
