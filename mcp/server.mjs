#!/usr/bin/env node
/*
  2one DLS — MCP server, stdio entry (Phase 0, local).
  A local MCP client (Claude Desktop / Claude Code / Cursor) launches this over stdio.

  Run:      node mcp/server.mjs
  Inspect:  npm --prefix mcp run inspect
*/
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { makeServer } from './lib/build-server.mjs'

const server = makeServer()
await server.connect(new StdioServerTransport())
console.error('2one DLS MCP server ready (stdio).')
