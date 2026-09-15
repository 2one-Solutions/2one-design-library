# Running and testing the MCP server

`mcp/` serves this design system to an LLM host over the Model Context Protocol.
There is **one** implementation, two transports:

- **stdio** (`mcp/server.mjs`) — a local client (Claude Desktop, Claude Code,
  Cursor) launches it as a child process. Used for the 2one team's own
  development, not for clients.
- **Streamable HTTP** (`mcp/server-http.mjs`) — any MCP client connects by URL.
  This is the one clients use: `claude mcp add --transport http 2one-dls
  https://<host>/mcp`. No install, no local files — the whole point of a
  hosted design system, the same shape as Figma's or Canva's MCP.

This page is about **proving it works**, in increasing order of fidelity: a
health check, the automated contract suite, an interactive session, and
finally a real host.

---

## What it is, in one paragraph

stdio: the host spawns the server and talks JSON-RPC over stdin/stdout.
**stdout is the protocol**, so the server redirects `console.log`/`info`/`debug`
to stderr before loading anything else; a stray print in the engine would
otherwise corrupt the stream and the host would report a parse error rather
than a bug. HTTP: the same tools and resources, served statelessly over
`POST /mcp` — a fresh server + transport per request, no session store.

The payload is **never guessed**. `mcp/lib/payload.mjs` resolves which payload
a process answers about from `DLS_API_KEY` / `--api-key`, once, at startup — an
unresolvable key is a startup failure, not a fallback to some default.

---

## Which payload, and how that is going to change

No key given answers about this repo's own design system — the default, and
today the only real case: this deployment, and every developer running the
server locally, serves 2one's own tokens, brand and components.

An API key is the seam for **multi-tenancy**: each client gets their own key,
which resolves to their own payload data instead of 2one's. That lookup is a
local stub file today (`mcp/lib/payload-directory.stub.json`) standing in for
what becomes a Supabase table — the interface (`resolvePayload({ apiKey })`)
does not change when that lands, only what backs the lookup. The deployed HTTP
server's `MCP_TOKEN` bearer gate is a separate concern (who may call the server
at all) and is unchanged by any of this; per-client keys replacing that shared
secret is the multi-tenant phase, not this one.

---

## 1. Health check

### stdio

Closing stdin ends the transport cleanly, which makes the whole startup path a
one-liner. **The syntax depends on your shell**, and the wrong one fails in a
way that looks like a broken server when it is not:

```bash
# bash, zsh, Git Bash
node mcp/server.mjs < /dev/null
```

```powershell
# PowerShell
$null | node mcp/server.mjs
```

```
2one DLS MCP server ready (stdio) — serving "@2one/design-library".
```

That line goes to **stderr**, which is where a host shows MCP logs. Read the
name: if it is not the system you meant, the resolved key is wrong and no tool
call will tell you more gently.

An unknown key should exit 1 with an explanation rather than a stack trace, and
write nothing to stdout:

```bash
node mcp/server.mjs --api-key zzz-no-such-key < /dev/null
```

### HTTP

```bash
PORT=8787 node mcp/server-http.mjs &
curl -s http://localhost:8787/health
```

```json
{"ok":true,"server":"2one-dls","payload":"@2one/design-library","transport":"streamable-http"}
```

---

## 2. The contract suite

```bash
npm run check:mcp
```

Installs `mcp/`'s own dependencies (a separate package, separate lockfile —
that is what the Dockerfile installs too) then spawns the real server as a
child process and drives it with the MCP SDK's own client, so protocol framing
and stdout pollution fail here the way they would in a host. It is part of
`npm run verify`.

It asserts every tool is advertised with a description, an unknown `--api-key`
refuses to start, an unknown component/intent comes back as an **error
result** rather than crashing the process, and every response — including the
error ones — names the payload it answered about.

### Proving the stdout guard

Worth doing once, because it shows both what the guard covers and what it
cannot. Add a module-scope print to any engine file the server touches, for
example near the top of `scripts/check-usage.mjs`:

```js
console.log('noise')        // check:mcp still passes — the guard redirects it
process.stdout.write('x\n') // check:mcp FAILS with "Connection closed"
```

The guard catches the console. It cannot catch a direct write to the stream,
and nothing can. Remove whichever you added afterwards.

---

## 3. Interactive: the MCP Inspector

```bash
npm --prefix mcp run inspect
```

The official interactive client — opens a browser UI listing every tool, lets
you fill in arguments and see raw responses. The fastest way to explore what
the tools actually return.

---

## 4. A real host

### Claude Desktop, local (2one's own development)

`%APPDATA%\Claude\claude_desktop_config.json` on Windows,
`~/Library/Application Support/Claude/` on macOS:

```json
{
  "mcpServers": {
    "2one-dls": {
      "command": "node",
      "args": ["D:/path/to/2one-design-library/mcp/server.mjs"]
    }
  }
}
```

Then **fully quit and reopen** the app. Reloading a window does not respawn
the server. Forward slashes work on Windows and avoid the escaped-backslash
mistakes that make this file silently invalid.

### Any MCP client, hosted (what a client actually does)

```bash
claude mcp add --transport http 2one-dls https://<host>/mcp
```

Nothing to install, no path to get right, no `node_modules`. If the deployment
requires a bearer token, pass it the way the client supports (Claude Code:
`--header "Authorization: Bearer <token>"`).

### What to ask first

In order, because each proves a further link:

1. **"What can you tell me about the 2one design system?"** — `brand_facts` /
   `gaps`. Should answer only from the manifest, and say plainly what is not
   covered rather than guessing.
2. **"What should I use to build a pricing page?"** — `decide`.
3. **"Give me the exact brand accent and spacing scale."** — `get_tokens`.
   Should read the token files rather than recall a hex from training.
4. **Write a component, then ask it to check the code** — `check`. This is the
   loop the system exists for.

### When the tools do not appear

| Symptom | Cause |
| --- | --- |
| No 2one tools at all | The app was reloaded, not fully restarted |
| No 2one tools, other servers fine | Invalid JSON in the config file |
| Server exits immediately (stdio) | `node` on the app's PATH differs from the shell's. Use an absolute path to the node binary. |
| 401 from the hosted server | Missing or wrong bearer token |
| Answers look wrong | Every response carries `payload.name` — read it |

---

## The tools

| Tool | Answers |
| --- | --- |
| `decide` | What to build for an intent, and why |
| `search` | Find a component/pattern/block/rule by id or label |
| `get_component` | One component's import path, variants, props, states, a11y, rules, alternatives, conflicts |
| `get_pattern` | A page pattern spec |
| `get_block` | A ready section (marketing, auth, dashboard) — every source file, imports, exports, sample data |
| `get_chart` | A chart template — source + expected data shape |
| `get_ai_component` | An AI-interface component — spec + source |
| `get_doc` | A guidance doc (web-writing, accessibility, …) |
| `get_skill` | Wrong vs right code examples per rule area |
| `get_rule` | One UX rule — statement, rationale, severity |
| `list` | Enumerate ids/labels of any node type |
| `get_recipe` | An end-to-end build guide |
| `get_tokens` | The exact colour/spacing/type values, so nothing is invented |
| `check` | Audit a code snippet against the rules |
| `check_pair` | May these two be used together, and which rule decides |
| `what_uses` | Impact analysis: what depends on this node |
| `web_copy_check` | Audit marketing/UI copy against the writing rules |
| `brand_facts` | Name, voice, tone, the one accent, personas |

`decide`, `check` and `check_pair` call `@2one/design-library/api` in-process.
`what_uses` still shells out to `scripts/what-uses.mjs`, which has not been
refactored into an importable function yet. Everything else reads the
committed data (manifest, graph, tokens, brand, rules, source) directly.

---

## Related

- `docs/consuming.md` — installing the library in an app (unrelated to the MCP
  server — a client using the hosted MCP never does this)
- `mcp/server.mjs` / `mcp/server-http.mjs` — the two transports
- `mcp/lib/build-server.mjs` — the shared tool/resource definitions
- `mcp/lib/dls.mjs` — the data + logic layer
- `mcp/lib/payload.mjs` — API-key resolution, the multi-tenancy seam
- `mcp/mcp.test.mjs` — the contract suite
- `npm run check:api` — the library entry points `decide`/`check`/`check_pair` are built on
