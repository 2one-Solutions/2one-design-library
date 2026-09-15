#!/usr/bin/env node
/*
  2one DLS — MCP server, HTTP entry (Phase 2, remote).

  Speaks MCP over Streamable HTTP so any client connects by URL instead of a local
  path. Stateless: a fresh server + transport per request (simple, horizontally
  scalable, no session store). Optional bearer auth via MCP_TOKEN.

  Run:    PORT=8787 MCP_TOKEN=secret node mcp/server-http.mjs
  Then:   POST http://localhost:8787/mcp   (Authorization: Bearer secret)
*/
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { makeServer } from './lib/build-server.mjs'
import { getPayloadInfo } from './lib/dls.mjs'

const PORT = Number(process.env.PORT) || 8787
const TOKEN = process.env.MCP_TOKEN || '' // when set, require Authorization: Bearer <token>
/*
  DLS_API_KEY, if set, picks which payload this process answers about (resolved
  once at startup — see mcp/lib/dls.mjs). Distinct from MCP_TOKEN: that gates
  WHO may call this server at all, this picks WHAT it answers about. Unset here
  today (this deployment serves its own repo), on purpose — per-client keys are
  the multi-tenant phase, not this one.
*/
const { name: payloadName } = getPayloadInfo()

const app = express()
app.use(express.json({ limit: '4mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, server: '2one-dls', payload: payloadName, transport: 'streamable-http' }))

function authorized(req, res) {
  if (!TOKEN) return true
  if ((req.headers['authorization'] || '') === `Bearer ${TOKEN}`) return true
  res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null })
  return false
}

app.post('/mcp', async (req, res) => {
  if (!authorized(req, res)) return
  // Stateless: no session id, new server/transport each request.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  try {
    const server = makeServer()
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(err?.message || err) }, id: null })
    }
  }
})

// Stateless server: no server-initiated stream or session teardown.
const methodNotAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method Not Allowed (stateless server — use POST /mcp)' }, id: null })
app.get('/mcp', methodNotAllowed)
app.delete('/mcp', methodNotAllowed)

app.listen(PORT, () =>
  console.error(
    `2one DLS MCP (HTTP) listening on :${PORT} — POST /mcp — serving "${payloadName}"` +
      (TOKEN ? '  [auth: bearer]' : '  [auth: none]'),
  ),
)
