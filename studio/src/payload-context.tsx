import * as React from 'react'
import seedJson from './payload/2one.payload.json'
import { validatePayload } from './payload/contract.mjs'
import { payloadToCss } from './payload/to-css.mjs'
import { createLocalStore } from './payload/store.mjs'
import type { Payload } from './types'

const seed = seedJson as unknown as Payload

interface HistoryEntry { at: string; note: string; payload: Payload }

interface PayloadContextValue {
  /** What the page is rendering: the draft while it is valid, otherwise the saved payload. */
  payload: Payload
  saved: Payload
  draftText: string
  setDraftText: (text: string) => void
  /** Errors in the draft, empty when it is valid or untouched. */
  errors: string[]
  dirty: boolean
  save: (note?: string) => void
  discard: () => void
  reset: () => void
  history: HistoryEntry[]
  restore: (index: number) => void
}

const Ctx = React.createContext<PayloadContextValue | null>(null)

export function usePayload() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('usePayload must be used inside <PayloadProvider>')
  return v
}

const pretty = (p: Payload) => JSON.stringify(p, null, 2)

/*
  The draft is the same mechanism the AI Studio will use: text in, validated,
  previewed live, then saved or thrown away. The page renders the draft only
  while it validates, so a half-typed edit never blanks the theme.
*/
export function PayloadProvider({ children }: { children: React.ReactNode }) {
  const store = React.useMemo(() => {
    let storage: Storage | undefined
    try { storage = window.localStorage } catch { /* blocked storage: the store falls back to memory */ }
    return createLocalStore({ seed, storage })
  }, [])

  const [saved, setSaved] = React.useState<Payload>(() => store.load())
  const [history, setHistory] = React.useState<HistoryEntry[]>(() => store.history())
  const [draftText, setDraftText] = React.useState(() => pretty(saved))

  const parsed = React.useMemo(() => {
    try {
      const value = JSON.parse(draftText)
      const result = validatePayload(value)
      return { value: result.ok ? (value as Payload) : null, errors: result.errors as string[] }
    } catch (e) {
      return { value: null, errors: [`Not valid JSON: ${(e as Error).message}`] }
    }
  }, [draftText])

  const payload = parsed.value ?? saved
  const dirty = draftText !== pretty(saved)

  React.useEffect(() => {
    let el = document.getElementById('studio-theme') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'studio-theme'
      document.head.appendChild(el)
    }
    el.textContent = payloadToCss(payload)
  }, [payload])

  const sync = React.useCallback(() => {
    const next = store.load()
    setSaved(next)
    setHistory(store.history())
    setDraftText(pretty(next))
  }, [store])

  const value: PayloadContextValue = {
    payload,
    saved,
    draftText,
    setDraftText,
    errors: dirty ? parsed.errors : [],
    dirty,
    save: (note = 'edit') => {
      if (!parsed.value) return
      if (store.save(parsed.value, note).ok) sync()
    },
    discard: () => setDraftText(pretty(saved)),
    reset: () => { store.reset(); sync() },
    history,
    restore: (index) => {
      const entry = history[index]
      if (entry && store.save(entry.payload, 'restore').ok) sync()
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
