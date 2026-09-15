/*
  Contract tests for the MCP server, driven over REAL stdio with the real SDK
  client. Not a mock of the protocol: the server is spawned as a child process
  exactly as a host spawns it, so framing errors and stray stdout writes fail
  here the way they would in Claude Desktop.

  Three things are worth testing beyond "the tools return something":

    1. stdout is clean. stdout IS the transport, so one console.log anywhere in
       the engine corrupts the stream and the host reports a parse error rather
       than a bug.
    2. the payload is never guessed. An unknown --api-key must refuse to start,
       because a server that silently answered about the wrong (or default)
       design system would have no symptom.
    3. provenance travels with the data. Every response names the payload it
       answered about.

  Run: npm run check:mcp
*/
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const here = dirname(fileURLToPath(import.meta.url))
const SERVER = join(here, 'server.mjs')

const fails = []
const t = (name, ok) => { if (!ok) fails.push(name) }

// ---- it refuses to guess ----
const badKey = spawnSync(process.execPath, [SERVER, '--api-key', 'zzz-no-such-key'], { encoding: 'utf8' })
t('mcp: refuses an unknown api key', badKey.status === 1)
t('mcp: says why it refused', /unknown API key/.test(badKey.stderr))
t('mcp: refusal writes nothing to stdout', badKey.stdout === '')

// ---- it serves the default payload (this repo) with no key ----
const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: 'pipe' })
const client = new Client({ name: '2one-mcp-contract', version: '1.0.0' })
await client.connect(transport)

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args })
  const text = r.content.map((c) => c.text).join('')
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* assertions below fail */ }
  return { isError: Boolean(r.isError), parsed }
}

const listed = await client.listTools()
const names = listed.tools.map((tool) => tool.name).sort()
const EXPECTED = [
  'decide', 'search', 'get_component', 'get_pattern', 'get_block', 'get_chart', 'get_ai_component',
  'get_doc', 'get_skill', 'get_rule', 'list', 'get_recipe', 'get_tokens', 'check', 'check_pair',
  'what_uses', 'web_copy_check', 'brand_facts', 'gaps',
]
t('mcp: advertises every tool', EXPECTED.every((n) => names.includes(n)))
t('mcp: every tool carries a description', listed.tools.every((tool) => typeof tool.description === 'string' && tool.description.length > 20))

const toks = await call('get_tokens')
t('get_tokens: returns colours, spacing and typography', ['colors', 'spacing', 'typography'].every((g) => Boolean(toks.parsed?.[g])))

const comp = await call('get_component', { name: 'button' })
t('get_component: resolves a name', typeof comp.parsed?.id === 'string')
t('get_component: carries an import path', typeof comp.parsed?.import?.barrel === 'string')
t('get_component: carries the graph-decide facets', Array.isArray(comp.parsed?.states) && Array.isArray(comp.parsed?.rules))

const noComp = await call('get_component', { name: 'zzz-no-such-component' })
t('get_component: unknown name is an error result', typeof noComp.parsed?.error === 'string')

const decision = await call('decide', { intent: 'app shell' })
t('decide: resolves a real intent', decision.isError === false && typeof decision.parsed?.error === 'undefined')

const pair = await call('check_pair', { a: 'Button', b: 'Button' })
t('check_pair: returns a known verdict', ['YES', 'NO', 'UNSPECIFIED'].includes(pair.parsed?.verdict))

// The dialog carries this payload's one accepted finding, exercising the
// known-findings path through the protocol rather than only the happy one.
const chk = await call('check', { code: 'export const Buy = () => <button style={{ background: "#ff0000" }}>Buy now</button>' })
t('check: audits a snippet', chk.parsed?.conforms === false)
t('check: reports the violation', (chk.parsed?.errors ?? []).length > 0)

const search = await call('search', { query: 'button' })
t('search: returns matches under items', Array.isArray(search.parsed?.items) && search.parsed.items.length > 0)

const badSearch = await call('search', { query: 'zzz nonsense query' })
t('search: no matches is an empty list, not an error', badSearch.isError === false && badSearch.parsed?.items?.length === 0)

// ---- provenance on everything ----
const all = [toks, comp, noComp, decision, pair, chk, search, badSearch]
t('mcp: every response names the payload it answered about', all.every((r) => typeof r.parsed?.payload?.name === 'string'))

await client.close()

if (fails.length) {
  console.error(`\n  ✗ check:mcp — ${fails.length} contract(s) broken:\n`)
  for (const f of fails) console.error(`    · ${f}`)
  console.error('\n  The server is what an LLM host talks to. A broken contract here is a')
  console.error('  wrong answer about someone\'s design system, delivered confidently.\n')
  process.exit(1)
}
console.log('\n  ✓ check:mcp — refuses an unknown key, answers over real stdio, and names its source on every response\n')
