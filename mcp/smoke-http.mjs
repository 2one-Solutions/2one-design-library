/*
  Local verification of the HTTP transport: start server-http.mjs on a test port,
  connect as an MCP client over Streamable HTTP, list + call tools. Proves the
  remote path works end-to-end — no Docker/deploy needed.
  Run: npm --prefix mcp run smoke:http
*/
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = 8799
const base = `http://localhost:${PORT}`

const child = spawn(process.execPath, [join(here, 'server-http.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'inherit',
})

async function waitForHealth(timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('server did not become healthy')
}

let failures = 0
try {
  await waitForHealth()
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`))
  const client = new Client({ name: '2one-mcp-http-smoke', version: '0.0.0' })
  await client.connect(transport)

  const { tools } = await client.listTools()
  console.log(`\nHTTP OK · TOOLS (${tools.length}): ${tools.map((t) => t.name).join(', ')}`)

  for (const [name, args] of [
    ['decide', { intent: 'present pricing' }],
    ['get_tokens', {}],
    ['check', { code: 'export const B = () => <button style={{ background: "#ff0000" }}>Buy</button>' }],
  ]) {
    const r = await client.callTool({ name, arguments: args })
    const text = r.content?.[0]?.text ?? ''
    const ok = text.length > 0 && !r.isError
    if (!ok) failures++
    console.log(`\n== ${name} ${ok ? 'OK' : 'FAIL'} ==\n${text.slice(0, 160)}`)
  }
  await client.close()
} catch (e) {
  failures++
  console.log(`FAIL: ${e.message}`)
} finally {
  child.kill()
}

console.log(failures ? `\n✗ ${failures} failure(s)` : `\n✓ HTTP transport works end-to-end`)
process.exit(failures ? 1 : 0)
