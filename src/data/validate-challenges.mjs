#!/usr/bin/env node
// Standalone catalog linter: checks every start/target title against the live
// English Wikipedia API. No dependencies and no build step. It regex-extracts the
// titles straight out of the .ts sources so it can never drift from a stale copy.
//
//   node src/data/validate-challenges.mjs
//
// Reports titles that are missing, that are redirects (with the canonical target
// so the catalog can be corrected), or that are disambiguation pages.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOG_DIR = join(HERE, 'challenges')
const API = 'https://en.wikipedia.org/w/api.php'
const BATCH_SIZE = 50

/** Matches `c('easy', 'some-id', 'Start Title', 'Target Title', ...)`. */
const CHALLENGE_RE = /c\(\s*'(?:easy|medium|hard)'\s*,\s*'[^']*'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g

async function collectTitles() {
  const files = (await readdir(CATALOG_DIR)).filter(
    (name) => name.endsWith('.ts') && name !== 'shared.ts',
  )
  const titles = new Set()

  for (const name of files) {
    const source = await readFile(join(CATALOG_DIR, name), 'utf8')
    let match
    let found = 0
    while ((match = CHALLENGE_RE.exec(source)) !== null) {
      titles.add(match[1])
      titles.add(match[2])
      found += 1
    }
    if (found === 0) {
      console.warn(`warning: no challenges parsed out of ${name}`)
    }
  }

  return [...titles].sort()
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function queryBatch(titles) {
  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    redirects: '1',
    prop: 'pageprops',
    ppprop: 'disambiguation',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })

  const response = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': 'WikiDash-catalog-validator/1.0 (dev script)' },
  })
  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status} ${response.statusText}`)
  }

  const body = await response.json()
  if (body.error) {
    throw new Error(`Wikipedia API error: ${body.error.info ?? 'unknown'}`)
  }
  return body.query ?? {}
}

async function main() {
  const titles = await collectTitles()
  console.log(`Checking ${titles.length} unique article titles...\n`)

  const missing = []
  const redirects = []
  const disambiguations = []
  const normalized = []

  for (const batch of chunk(titles, BATCH_SIZE)) {
    const query = await queryBatch(batch)

    for (const entry of query.normalized ?? []) {
      normalized.push([entry.from, entry.to])
    }
    for (const entry of query.redirects ?? []) {
      redirects.push([entry.from, entry.to])
    }
    for (const page of query.pages ?? []) {
      if (page.missing) {
        missing.push(page.title)
      } else if (page.pageprops && 'disambiguation' in page.pageprops) {
        disambiguations.push(page.title)
      }
    }
  }

  const report = (label, rows, format) => {
    if (rows.length === 0) return
    console.log(`${label} (${rows.length}):`)
    for (const row of rows) console.log(`  ${format(row)}`)
    console.log('')
  }

  report('MISSING', missing, (t) => t)
  report('REDIRECT', redirects, ([from, to]) => `${from}  ->  ${to}`)
  report('NORMALIZED', normalized, ([from, to]) => `${from}  ->  ${to}`)
  report('DISAMBIGUATION', disambiguations, (t) => t)

  const problems = missing.length + redirects.length + disambiguations.length
  if (problems === 0) {
    console.log(`All ${titles.length} titles are clean.`)
  } else {
    console.log(`${problems} problem title(s) found.`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`validation failed: ${error.message}`)
  process.exitCode = 1
})
