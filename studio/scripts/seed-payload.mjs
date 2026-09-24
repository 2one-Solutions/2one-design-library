/*
  Regenerate studio/src/payload/2one.payload.json from the theme and brand files.
  Run after changing src/styles/globals.css or brand/brand.json:  npm run studio:seed
*/
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSeedPayload, REPO_ROOT } from '../src/payload/seed.mjs'

const file = join(REPO_ROOT, 'studio/src/payload/2one.payload.json')
writeFileSync(file, JSON.stringify(buildSeedPayload(), null, 2) + '\n')
console.log(`  wrote ${file}`)
