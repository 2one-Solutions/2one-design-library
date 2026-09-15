#!/usr/bin/env node
/*
  2one DLS — MCP server, stdio entry.
  A local MCP client (Claude Desktop / Claude Code / Cursor) launches this over stdio.

    node mcp/server.mjs                      serves this repo's own payload (dev)
    node mcp/server.mjs --api-key <key>       serves the payload that key resolves to
    DLS_API_KEY=<key> node mcp/server.mjs     same, via env

  No key given answers about this repo — that is not a client case, it is how
  the 2one team runs this server for its own development. A key that does not
  resolve is a startup failure, not a silent fallback to the default: see
  mcp/lib/payload.mjs and mcp/lib/dls.mjs for why.

  Run:      node mcp/server.mjs
  Inspect:  npm --prefix mcp run inspect
*/
const args = process.argv.slice(2)
const flagIndex = args.indexOf('--api-key')
const apiKey = flagIndex !== -1 ? args[flagIndex + 1] : process.env.DLS_API_KEY || null
if (apiKey) process.env.DLS_API_KEY = apiKey

let makeServer
try {
  ;({ makeServer } = await import('./lib/build-server.mjs'))
} catch (err) {
  console.error(`\n  2one mcp: ${err.message}\n`)
  process.exit(1)
}

const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
const { getPayloadInfo } = await import('./lib/dls.mjs')

const server = makeServer()
await server.connect(new StdioServerTransport())
const { name } = getPayloadInfo()
console.error(`2one DLS MCP server ready (stdio) — serving "${name}".`)
