/*
  Where a client's payload is kept.

  The studio talks to a PayloadStore and never to a particular backend, so the
  local store used to build and test the app today and the Supabase store that
  replaces it are interchangeable. A store never accepts an invalid payload:
  validation lives here, at the write, so no caller can skip it.

    load()          the current payload
    save(payload)   validate then persist; returns { ok, errors }
    reset()         back to the seed

  Every save appends to a history, capped, so an accepted AI edit can always be
  reverted. `history()` is newest first.
*/
import { validatePayload } from './contract.mjs'

const MAX_HISTORY = 20

/**
 * A store over any Storage-shaped object (localStorage in the browser, a Map
 * wrapper in tests). Storage can be missing or throw (private windows, blocked
 * site data), so every access is guarded and the store falls back to memory.
 */
export function createLocalStore({ seed, storage, key = '2one-studio-payload' }) {
  let memory = { current: seed, history: [] }

  const read = () => {
    try {
      const raw = storage?.getItem(key)
      if (!raw) return memory
      const parsed = JSON.parse(raw)
      return validatePayload(parsed.current).ok ? parsed : memory
    } catch {
      return memory
    }
  }
  const write = (state) => {
    memory = state
    try { storage?.setItem(key, JSON.stringify(state)) } catch { /* memory copy still holds it */ }
  }

  return {
    load: () => read().current,
    history: () => read().history,
    save(payload, note = 'edit') {
      const result = validatePayload(payload)
      if (!result.ok) return result
      const state = read()
      write({
        current: payload,
        history: [{ at: new Date().toISOString(), note, payload: state.current }, ...state.history].slice(0, MAX_HISTORY),
      })
      return { ok: true, errors: [] }
    },
    reset() {
      write({ current: seed, history: [] })
    },
  }
}
