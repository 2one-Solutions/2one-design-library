# 2one DLS — MCP server

Exposes the 2one Design Language System to any MCP client (Claude Desktop, Claude Code)
as tools + resources, so you build **from** the system without pasting a prompt each time.

Read-only by design: tools return DLS data, decisions, and check results — the client
(Claude) writes the code in your editor.

## Setup

```bash
cd mcp
npm install
```

## Verify it works (no Claude needed)

```bash
npm run smoke      # spawns the server over stdio, calls every tool, prints results
npm run inspect    # opens the MCP Inspector UI to click through the tools
```

`smoke` should end with `✓ all 19 tools returned data`.

## Connect it to Claude

**Claude Code**
```bash
claude mcp add 2one-dls -- node D:/Claude/2one-design-library/mcp/server.mjs
```

**Claude Desktop** — add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "2one-dls": {
      "command": "node",
      "args": ["D:\\Claude\\2one-design-library\\mcp\\server.mjs"]
    }
  }
}
```

Restart Claude, then ask e.g. *"Using 2one, what should I build for a pricing page?"* or
*"Check this component against 2one's rules."* Claude will call the tools automatically.

## Tools

| Tool | What it does | Backed by |
|---|---|---|
| `decide(intent)` | intent → the component/pattern to use (or suggestions) | `scripts/graph-decide.mjs` |
| `search(query)` | search the knowledge graph | `graph.json` |
| `get_component(name)` | import path, variants, props, states, a11y, rules, alternatives, conflicts | `graph.json` + `@2one/design-library/api` |
| `get_pattern(id)` | a page-pattern spec | `rules/patterns/*.json` |
| `get_block(name)` | a ready section (marketing/login/signup/dashboard) + code | `src/blocks/**` |
| `get_chart(name)` | a chart template + expected data shape | `src/blocks/charts/**` |
| `get_ai_component(name)` | an AI-interface component spec + code | `rules/ai-components/*` + `src/ai-components/*` |
| `get_doc(name?)` | a guidance doc (web-writing, consuming, a11y…); no name lists them | `docs/*.md` |
| `get_skill(rule?)` | wrong-vs-right code per rule area (brand/composition/forms) | `skills/2one-dls/` |
| `get_rule(id)` | one UX rule — statement, rationale, severity | `rules/ux-rules.json` |
| `list(type)` | enumerate ids/labels of a node type | `graph.json` |
| `get_recipe(id?)` | an end-to-end build guide; no id lists them | `recipes/*.md` |
| `get_tokens()` | colours, spacing, typography | `tokens/*.json` |
| `check(code)` | audit a snippet against the rules | `@2one/design-library/api` (in-process) |
| `check_pair(a, b)` | may these two be used together, and which rule decides | `@2one/design-library/api` (in-process) |
| `what_uses(query)` | impact analysis before a change | `scripts/what-uses.mjs` (still spawned — not yet an exported function) |
| `web_copy_check(text)` | flag click-here / bait words / filler | `brand.json` + web-writing rules |
| `brand_facts()` | name, voice, tone, accent, personas | `brand/brand.json` |
| `gaps()` | the honest, documented gaps | `manifest.json → system.not_covered` |

Resources: `dls://manifest`, `dls://rules`, `dls://tokens`.

## Which payload (API keys)

No key given serves this repo's own design system — the default, and today the
only real case. `--api-key <key>` / `DLS_API_KEY=<key>` resolves a different
payload via `mcp/lib/payload.mjs`, looked up in a local stub file today,
standing in for a per-client Supabase table once that phase lands. An unknown
key refuses to start rather than silently falling back to the default.

```bash
node mcp/server.mjs --api-key dev-2one-self   # the one seeded stub entry
```

## Remote (connect by URL)

The same tools over **Streamable HTTP**, so anyone connects to a URL instead of a local path.

**Run the HTTP server locally**
```bash
npm --prefix mcp run start:http           # → http://localhost:8787/mcp
npm --prefix mcp run smoke:http           # verifies the HTTP transport end-to-end
# require a token:  set MCP_TOKEN=secret before start:http
```

**Deploy (Docker → Render, ~$7/mo)**
```bash
docker build -f mcp/Dockerfile -t 2one-mcp .     # context = repo root
docker run -p 8787:8787 -e MCP_TOKEN=secret 2one-mcp
```
Or use `mcp/render.yaml` (Render → New → Blueprint). Endpoint: `https://<service>.onrender.com/mcp`.

**Connect a client to the URL**
```bash
claude mcp add --transport http 2one-dls https://<host>/mcp   # + header if MCP_TOKEN is set
```
Claude Desktop / claude.ai / Cursor: add a **custom connector** with the `/mcp` URL.

**Auth:** `MCP_TOKEN` sets a shared **bearer token** (good for trusted clients + the Inspector).
Full **OAuth** — which claude.ai custom connectors expect for public use — is the next
sub-phase; until then, deploy behind the token (or an unguessable URL for testing).

## Notes

- **`decide`, `check` and `check_pair` call `@2one/design-library/api` in-process** — no
  spawned child process, so answers never drift from `npm run` / `npx 2one` and there is no
  per-call spawn cost. `what_uses` is the one holdout, still shelling out to
  `scripts/what-uses.mjs`, because that script has not been refactored into an importable
  function yet.
- **Payload resolution happens once, at process startup**, before the engine is imported —
  see the header of `mcp/lib/dls.mjs` for why that has to be exactly-once-per-process rather
  than callable again later.
- **Both transports must run where they can read the sibling** `manifest.json`, `graph.json`,
  `tokens/`, `rules/`, `scripts/`, `src/` — locally that's the repo checkout; in Docker the
  repo is copied into the image.
- **Later (edge):** an in-process port (bundle the JSON, drop `child_process`) would let it
  run on Cloudflare Workers. Not needed for Render/Docker, which run full Node.
