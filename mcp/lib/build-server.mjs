/*
  Builds a configured 2one DLS MCP server (tools + resources + auto-use
  instructions). Shared by the stdio entry (server.mjs) and the HTTP entry
  (server-http.mjs) so both transports expose exactly the same surface.
*/
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as dls from './dls.mjs'

const asText = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] })

export function makeServer() {
  const server = new McpServer(
    { name: '2one-dls', version: '0.1.0' },
    {
      instructions: [
        'This server is the 2one Design Language System. Use it PROACTIVELY — without being',
        'asked — whenever the user builds, designs, reviews, or asks about any UI, component,',
        'screen, page, colour, spacing, or brand copy.',
        '',
        'Default workflow when building UI:',
        '1. Call `decide` with the user’s intent to pick the right component or pattern.',
        '2. Call `get_tokens` for exact colours/spacing/typography, and `get_component` /',
        '   `get_pattern` for the pieces — NEVER invent a colour, size, component, or brand fact.',
        '3. Generate the UI from those.',
        '4. Call `check` on what you generated and fix whatever it reports before presenting it.',
        'For marketing/UI copy, call `web_copy_check`. For brand questions, call `brand_facts`.',
        'Before changing a shared token/component, call `what_uses`. State only capabilities in',
        '`gaps` — never claim more. Answer from these tools; cite the source.',
      ].join('\n'),
    },
  )

  server.tool(
    'decide',
    'Call this FIRST whenever the user wants to build or design any screen, page, or feature. Maps a build intent (e.g. "app shell", "present pricing", "confirm action") to the 2one component or pattern to use — or returns suggestions if the intent is unknown.',
    { intent: z.string().describe('What you want to build, in a few words.') },
    async ({ intent }) => asText(dls.decide(intent)),
  )
  server.tool(
    'search',
    'Search the 2one knowledge graph (components, patterns, tokens, rules, blocks) by id or label.',
    { query: z.string(), limit: z.number().int().min(1).max(50).optional() },
    async ({ query, limit }) => asText(dls.search(query, limit ?? 20)),
  )
  server.tool(
    'get_component',
    'Get a 2one component by name (e.g. "button", "dialog", "app-bar") plus the rules that govern it.',
    { name: z.string() },
    async ({ name }) => asText(dls.getComponent(name)),
  )
  server.tool(
    'get_pattern',
    'Get a 2one page pattern spec by id (e.g. "app-shell", "marketing-site", "pricing-page").',
    { id: z.string() },
    async ({ id }) => asText(dls.getPattern(id)),
  )
  server.tool(
    'get_block',
    'Get a 2one block (a ready section to compose from: marketing sections like "marketing-hero", auth like "login-01"/"signup-01", or "dashboard-plain") — its spec + source code. Use these instead of hand-building sections.',
    { name: z.string() },
    async ({ name }) => asText(dls.getBlock(name)),
  )
  server.tool(
    'get_ai_component',
    'Get a 2one AI-interface component (e.g. "streaming-text", "reasoning-panel", "guardrail-notice", "typing-indicator") — its node, machine spec, and source. Use for AI/agent UIs.',
    { name: z.string() },
    async ({ name }) => asText(dls.getAiComponent(name)),
  )
  server.tool(
    'get_doc',
    'Read a 2one guidance doc (e.g. "web-writing", "consuming", "accessibility", "building-with-the-dls", "placeholders"). Call with no name to list all docs. Read the relevant doc before building the matching surface.',
    { name: z.string().optional() },
    async ({ name }) => asText(dls.getDoc(name)),
  )
  server.tool(
    'get_skill',
    'Get the 2one skill — WRONG vs RIGHT code examples per rule area (e.g. "brand", "composition", "forms"). Call with no rule to list them. Use these to see the correct pattern, not just the rule.',
    { rule: z.string().optional() },
    async ({ rule }) => asText(dls.getSkill(rule)),
  )
  server.tool(
    'get_tokens',
    'Call this before writing any UI so every colour, spacing, and type value comes from the 2one tokens — never invent or hardcode a colour or size.',
    {},
    async () => asText(dls.getTokens()),
  )
  server.tool(
    'check',
    'Call this on ANY UI you generate or the user shares, to audit it against the 2one design rules (`npx 2one check`). Returns errors/warnings with rule ids — fix what it reports before presenting the UI.',
    { code: z.string().describe('The TSX/JSX to audit.'), ext: z.enum(['tsx', 'jsx', 'ts', 'js']).optional() },
    async ({ code, ext }) => asText(dls.check(code, ext ?? 'tsx')),
  )
  server.tool(
    'what_uses',
    'Impact analysis: what depends on a node (e.g. "token:primary", "Button", "radius-full") before you change it.',
    { query: z.string() },
    async ({ query }) => asText(dls.whatUses(query)),
  )
  server.tool(
    'web_copy_check',
    'Call this on any marketing or UI copy you write or the user shares, to check it against the 2one web-writing rules (no "click here", no bait/slop words, no welcome filler).',
    { text: z.string() },
    async ({ text }) => asText(dls.webCopyCheck(text)),
  )
  server.tool(
    'brand_facts',
    'The 2one brand facts (name, voice, tone, the one accent, personas, writing rules). Answer brand questions only from these.',
    {},
    async () => asText(dls.brandFacts()),
  )
  server.tool(
    'gaps',
    'The honest, documented gaps of the 2one DLS (from manifest.json → system.not_covered). Do not claim capabilities beyond these.',
    {},
    async () => asText(dls.gaps()),
  )

  server.resource('manifest', 'dls://manifest', async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(dls.getManifest()) }],
  }))
  server.resource('ux-rules', 'dls://rules', async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(dls.getUxRules()) }],
  }))
  server.resource('tokens', 'dls://tokens', async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(dls.getTokens()) }],
  }))

  return server
}
