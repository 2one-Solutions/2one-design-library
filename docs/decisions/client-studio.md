# Client studio: plan

Status: slice 1 in progress on `feat/client-studio`. Written 2026-09-24.

## What is being built

A hosted frontend where a client signs in and sees a replica of the 2one
showcase site (`dev/showcase.tsx`, the catalog and how-to-use page) rendered with
their own brand and components, plus an AI Studio panel where they describe a
change in words and Claude proposes an edit to their payload, previewed live
before they accept it. The engine (`mcp/`) stays generic and reads the same
payload, so what a client tunes in the studio is what their LLM tools see.

## Where the payload stands today

| Part | Separated? | Notes |
| --- | --- | --- |
| Colour, radius, font tokens | Yes at runtime | Components read CSS variables in `src/styles/globals.css`. Overriding `:root` and `.dark` re-themes everything with no component change. |
| Brand facts (name, tagline, voice) | Data, not wired | `brand/brand.json`. The showcase does not read it. |
| Page copy | No | Hardcoded 2one text in `dev/showcase.tsx` and `dev/i18n/en.json`. |
| Client components | No mechanism | See risk 1 below. |
| Storage | No | Files on disk. `mcp/lib/payload-directory.stub.json` only maps a dev key back to 2one. |

## Assumptions

1. **The 34 colour and radius variables plus 3 font variables in `globals.css`
   are the whole theming surface.** Confidence: high, extracted from the file
   and guarded by a test that fails if `globals.css` gains a variable the
   contract does not know. If wrong: a client cannot theme something and we find
   out from a bug report instead of a failing test.
2. **The studio can share the repo's root `node_modules`** rather than get its
   own `package.json` like `mcp/`. Confidence: medium. The components need
   react, radix and tailwind, which are all root dependencies. If wrong (say we
   later split the repo), the studio needs its own install and a copy of the
   component source. This corrects what I said earlier about a separate
   `package.json`.
3. **New studio dependencies go in root `devDependencies`**, not `dependencies`,
   so they do not ride along to library consumers. Needs approval, see below.
4. **AI edits are patches to the payload, validated by the same contract as a
   hand edit.** Confidence: high. If wrong, the model can write values the page
   then injects into a `<style>` tag, which is a CSS injection path.
5. **The Anthropic key never reaches the browser.** The AI call runs
   server-side (a Supabase Edge Function or the existing `mcp/` Express
   server). Confidence: high, it is not negotiable.

## Risks to decide on before slice 4

1. **Client components are untrusted code.** "Client's own components" rendered
   in a hosted page means running a client's React. Options: (a) v1 stores them
   as data only (name, props, guidance, screenshot) and the studio lists them
   without executing them; (b) render them in a sandboxed iframe. Recommendation:
   (a) for v1. Not decided.
2. **Logos are SVG.** Inline SVG from a client can carry script. Slice 1 leaves
   logos out of the contract on purpose. They arrive as an uploaded asset with
   sanitizing, or as an image URL.
3. **Client A must never read client B.** Supabase row level security carries
   this, and it has to be tested with two real users, not assumed.

## Slices

1. **Payload contract and CSS generator** (in progress). No dependencies, no
   secrets. A strict validator, `payloadToCss`, and a seed of 2one's own payload
   derived from `globals.css` so it cannot drift. Test: `npm run check:studio`,
   added to `verify`.
2. **Studio app shell.** `studio/` Vite app reusing `src/components`. Loads a
   payload, applies it live, renders the showcase replica from payload data
   (copy and brand read from the payload, not hardcoded). Local JSON store.
3. **Supabase.** Tables, row level security, auth, a `PayloadStore`
   implementation. SQL migrations are committed in the repo and run by you, not
   by me. Needs your project URL and anon key in `studio/.env.local`.
4. **AI Studio.** Server-side endpoint, prompt with the contract as the only
   writable surface, patch validated then previewed, accept or reject,
   version history so every accept is revertable.
5. **Engine reads the payload.** `mcp/lib/payload.mjs` resolves an API key to a
   Supabase payload instead of the stub file. Includes API key management UI
   (Mercury-styled dashboard).

## Deliberately not in slice 1

No UI, no Supabase, no AI, no logos, no client components, no copy overrides.
Each is a later slice above.

## Needs your approval before it is added

- `@supabase/supabase-js` (slice 3)
- `@anthropic-ai/sdk`, or plain `fetch` to the API to avoid the dependency (slice 4)
- A router, only if the studio grows past one page (not needed yet)
