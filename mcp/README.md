# 2one DLS — MCP server (Phase 0, local)

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

`smoke` should end with `✓ all 10 tools returned data`.

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
| `get_component(name)` | a component + the rules that govern it | `graph.json` |
| `get_pattern(id)` | a page-pattern spec | `rules/patterns/*.json` |
| `get_block(name)` | a ready section (marketing/login/signup/dashboard) + code | `src/blocks/**` |
| `get_ai_component(name)` | an AI-interface component spec + code | `rules/ai-components/*` + `src/ai-components/*` |
| `get_doc(name?)` | a guidance doc (web-writing, consuming, a11y…); no name lists them | `docs/*.md` |
| `get_skill(rule?)` | wrong-vs-right code per rule area (brand/composition/forms) | `skills/2one-dls/` |
| `get_tokens()` | colours, spacing, typography | `tokens/*.json` |
| `check(code)` | audit a snippet against the rules | `npx 2one check` |
| `what_uses(query)` | impact analysis before a change | `scripts/what-uses.mjs` |
| `web_copy_check(text)` | flag click-here / bait words / filler | `brand.json` + web-writing rules |
| `brand_facts()` | name, voice, tone, accent, personas | `brand/brand.json` |
| `gaps()` | the honest, documented gaps | `manifest.json → system.not_covered` |

Resources: `dls://manifest`, `dls://rules`, `dls://tokens`.

## Remote (Phase 2 — connect by URL)

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

- **Phase 0/2 both shell out** to the repo's own scripts, so answers never drift from
  `npm run` / `npx 2one`. The server (stdio or HTTP) must run where it can read the sibling
  `manifest.json`, `graph.json`, `tokens/`, `rules/`, `scripts/` — locally that's the repo
  checkout; in Docker the repo is copied into the image.
- **Later (edge):** an in-process port (bundle the JSON, drop `child_process`) would let it
  run on Cloudflare Workers. Not needed for Render/Docker, which run full Node.
