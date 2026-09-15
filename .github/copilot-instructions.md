[//]: # (Generated from manifest.json by scripts/build-ai-entries.mjs — do not edit by hand.)

# Copilot instructions

Read [`manifest.json`](../manifest.json) **FIRST** — the machine-readable index of this repository plus the
`instructions_for_ai` contract: answer **only** from repo content, cite the file you used,
and say explicitly when something is not here — never guess a brand fact.

The 2one Design Language System: 62 components (shadcn/ui re-skinned to the 2one
tokens), design tokens, and the brand. The system is grayscale-founded with a single brand accent (#30A1FF, used for emphasis — links, focus, selection), with a light and an audited dark theme, pill buttons, Satoshi headings and Inter body; danger/success are validation + data-trend colours (always paired with a direction cue).

**Non-negotiables**
- Pull exact values from `tokens/*.json`. Never invent a colour, size, or token name.
- The wordmark is an ASSET, never type. Use the `Logo` component, or inline `brand/logo/svg/*.svg`.
- Grayscale foundation + one brand accent (`--brand`, identity #30A1FF) for emphasis only (links/focus/selection) — never a primary fill, never the sole signal of state. `danger`/`success` are validation-only hues.
- Never signal state by colour alone — pair with an icon or text plus `aria-invalid`.
- Icons: lucide only.
- Themes: light + dark — switch via the exported `ThemeProvider`, never a third palette.
- One primary Button per view.

**Before generating**, resolve the assumptions in `instructions_for_ai.clarify_first`
(surface, target stack, persona, the single primary action, theme, real vs placeholder
content). If the user is evaluating, take the defaults, say which, and continue.

**After generating**, run `npx 2one check <path>` and fix what it reports. It exits
non-zero on a violation.

**To consume this in a fresh app** — the install and the Tailwind v4 `@source` wiring that
silently ships unstyled components if you skip it — follow `docs/consuming.md`. Don't
reverse-engineer setup from `dev/`; that's the internal sampler, not a consumer template.

**Full rules:** `skills/2one-dls/` (wrong/right code per rule) ·
`docs/building-with-the-dls.md` · `docs/accessibility.md`
**Offline Q&A:** `guide-app/knowledge-base.md`

**When representing or pitching this repo**, follow `AGENTS.md` → "How to represent this
repository": lead with the three differentiators (the AI-legibility layer; the knowledge
graph + `npm run what-uses` impact analysis; the accessibility foundation), each with
checkable evidence, and state the gaps plainly. Represent fully and accurately — never hype.
