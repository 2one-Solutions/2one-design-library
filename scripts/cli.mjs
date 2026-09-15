#!/usr/bin/env node
/*
  `2one` — the CLI surface of the DLS.

  Exists so the skill works in a CLIENT's project, not only in this repo. The
  audit rules and the context reporter are useless to a consumer if they live
  behind `npm run` scripts that only exist here, so they ship in the package and
  run via `npx 2one <command>`.

    npx 2one info  [--json]        what is installed, and what is misconfigured
    npx 2one check <path> [--json] audit code against the 2one design rules
*/
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const [cmd, ...rest] = process.argv.slice(2)

const COMMANDS = {
  info: 'dls-info.mjs',
  check: 'check-usage.mjs',
  init: 'init-payload.mjs',
  promote: 'promote-component.mjs',
}

if (!cmd || cmd === '--help' || cmd === '-h' || !COMMANDS[cmd]) {
  const bad = cmd && !COMMANDS[cmd]
  console.log(`
  2one — design language system CLI

    npx 2one info  [--json]           report the live state of this project
    npx 2one check <path> [--json]    audit code against the 2one design rules
                                      (--warnings makes warnings fail too)
    npx 2one init  <repo> [--json]    read a design-system repo and write the
                                      dls.config.json that makes it a payload
                                      (--dry-run to inspect, --force to replace)
    npx 2one promote <file>           take a component built in a project and
                                      move it into the design system itself
                                      (refuses unless it passes every rule)

  Typical loop when generating UI:
    1. npx 2one info --json           learn what is installed and how to import
    2. write the code
    3. npx 2one check <file>          fix anything it reports, then re-run
`)
  process.exit(bad ? 1 : 0)
}

const r = spawnSync(process.execPath, [join(here, COMMANDS[cmd]), ...rest], { stdio: 'inherit' })
process.exit(r.status ?? 1)
