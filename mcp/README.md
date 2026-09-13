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
| `get_tokens()` | colours, spacing, typography | `tokens/*.json` |
| `check(code)` | audit a snippet against the rules | `npx 2one check` |
| `what_uses(query)` | impact analysis before a change | `scripts/what-uses.mjs` |
| `web_copy_check(text)` | flag click-here / bait words / filler | `brand.json` + web-writing rules |
| `brand_facts()` | name, voice, tone, accent, personas | `brand/brand.json` |
| `gaps()` | the honest, documented gaps | `manifest.json → system.not_covered` |

Resources: `dls://manifest`, `dls://rules`, `dls://tokens`.

## Notes

- **Phase 0** shells out to the repo's own scripts, so answers never drift from `npm run` /
  `npx 2one`. It must run inside a checkout of the DLS repo (it reads the sibling
  `manifest.json`, `graph.json`, `tokens/`, `rules/`, `scripts/`).
- **Next (Phase 2):** an in-process port (bundle the JSON, no `child_process`) so it can be
  hosted remotely on Cloudflare Workers with OAuth — then teams connect over a URL instead
  of a local path. See the productization notes.
