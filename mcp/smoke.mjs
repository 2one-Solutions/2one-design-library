/*
  Headless end-to-end check: spawn the MCP server over stdio exactly as Claude
  would, list the tools, and call each with a real argument. Proves the wiring +
  that every tool returns real DLS data. Run: npm --prefix mcp run smoke
*/
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const transport = new StdioClientTransport({ command: process.execPath, args: [join(here, 'server.mjs')] })
const client = new Client({ name: '2one-mcp-smoke', version: '0.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log(`\nTOOLS (${tools.length}): ${tools.map((t) => t.name).join(', ')}`)

const { resources } = await client.listResources()
console.log(`RESOURCES (${resources.length}): ${resources.map((r) => r.uri).join(', ')}\n`)

const calls = [
  ['get_tokens', {}],
  ['decide', { intent: 'app shell' }],
  ['search', { query: 'pricing' }],
  ['get_component', { name: 'button' }],
  ['get_pattern', { id: 'marketing-site' }],
  ['what_uses', { query: 'token:primary' }],
  ['get_block', { name: 'dashboard-plain' }],
  ['get_chart', { name: 'chart-area-default' }],
  ['get_rule', { id: 'tokens-only' }],
  ['list', { type: 'block' }],
  ['get_recipe', { id: 'build-an-app' }],
  ['get_ai_component', { name: 'guardrail-notice' }],
  ['get_doc', { name: 'web-writing' }],
  ['get_skill', { rule: 'forms' }],
  ['brand_facts', {}],
  ['gaps', {}],
  ['web_copy_check', { text: 'Click here to unlock seamless value' }],
  ['check', { code: 'export const Buy = () => <button style={{ background: "#ff0000" }}>Buy now</button>' }],
]

let failures = 0
for (const [name, args] of calls) {
  try {
    const r = await client.callTool({ name, arguments: args })
    const text = r.content?.[0]?.text ?? ''
    const ok = text.length > 0 && !r.isError
    if (!ok) failures++
    console.log(`== ${name} ${ok ? 'OK' : 'FAIL'} ==\n${text.slice(0, 220)}\n`)
  } catch (e) {
    failures++
    console.log(`== ${name} FAIL == ${e.message}\n`)
  }
}

await client.close()
console.log(failures ? `\n✗ ${failures} tool(s) failed` : `\n✓ all ${calls.length} tools returned data`)
process.exit(failures ? 1 : 0)
