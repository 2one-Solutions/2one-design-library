/*
  Payload resolution — given an API key (or none), decide which client's
  payload this server answers about.

  This is the one seam multi-tenancy grows from. Today the lookup is a local
  stub file standing in for what becomes a Supabase table (client id, api key,
  payload location). The interface — resolvePayload({ apiKey }) returning a
  payload root — stays the same when that lookup moves to a real database;
  only DIRECTORY_FILE's reader changes, nothing that calls resolvePayload does.

  No key given resolves to this server's own repo. That is not a client case:
  it is how the 2one team runs this server for its own development, and how
  the deployed HTTP server behaves today (mcp/server-http.mjs keeps its
  MCP_TOKEN gate unchanged — this file does not touch HTTP auth, only which
  payload gets served once a request is already authorized).
*/
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// mcp/lib/ -> mcp/ -> repo root.
export const SELF_ROOT = join(HERE, '..', '..')

const DIRECTORY_FILE = join(HERE, 'payload-directory.stub.json')

function readDirectory() {
  if (!existsSync(DIRECTORY_FILE)) return {}
  return JSON.parse(readFileSync(DIRECTORY_FILE, 'utf8'))
}

function selfPayload() {
  const pkg = JSON.parse(readFileSync(join(SELF_ROOT, 'package.json'), 'utf8'))
  return { root: SELF_ROOT, name: pkg.name, clientId: null }
}

/**
 * Resolve which payload to answer about.
 *   - apiKey omitted or empty: this server's own repo.
 *   - apiKey given: looked up in the local stub directory. An unknown key is a
 *     refusal (ok: false), never a silent fallback to self — an agent holding
 *     answers about the wrong client's design system has no symptom.
 * Returns { ok: true, root, name, clientId } or { ok: false, reason }.
 */
export function resolvePayload({ apiKey } = {}) {
  if (!apiKey) return { ok: true, ...selfPayload() }

  const directory = readDirectory()
  const entry = directory[apiKey]
  if (!entry || typeof entry !== 'object') return { ok: false, reason: 'unknown API key' }

  const root = entry.root === 'self' ? SELF_ROOT : entry.root
  if (!root || !existsSync(root)) return { ok: false, reason: `payload root does not exist: ${root}` }

  return { ok: true, root, name: entry.name ?? apiKey, clientId: entry.clientId ?? apiKey }
}
