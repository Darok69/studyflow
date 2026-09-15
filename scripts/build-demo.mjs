// Ukázková učebnice, kterou v appce vidí každý.
//
// Prochází přesně tou validací, kterou server pouští na nahrávky zvenčí —
// kdyby ukázka neprošla, znamenalo by to, že ukazujeme tvar, který appka
// nepřijme. Výstup se pak nahraje do /data/materials/demo/ na produkci.
//
//   node scripts/build-demo.mjs [výstupní adresář]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePack } from '../server/gen/pipeline.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = 'ukazka'
// Napevno, ne losem: ukázka se přenahrává a ID přednášek se měnit nesmí,
// jinak by lidem po aktualizaci zmizela rozečtená stránka.
const PREFIX = 'ukazka'

const source = JSON.parse(readFileSync(join(root, 'content/demo/pack.json'), 'utf8'))
const result = normalizePack(source, { slug: SLUG, prefix: PREFIX })
if (result.error) {
  console.error(`ukázka neprošla kontrolou: ${result.error}`)
  process.exit(1)
}
const { pack } = result

const outDir = process.argv[2] ?? join(root, 'content/demo/out')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const write = (name, value) =>
  writeFileSync(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`)

write(`index-${SLUG}.json`, pack.index)
write(`deck-${SLUG}.json`, pack.deck)
for (const [id, lecture] of Object.entries(pack.lectures)) write(`${id}.json`, lecture)

for (const warning of pack.warnings) console.warn(`  ! ${warning}`)
console.log(
  `ukázka: ${Object.keys(pack.lectures).length} přednášek, ` +
    `${pack.index.courses[0].lectures.reduce((n, l) => n + l.slides, 0)} oddílů, ` +
    `${pack.deck.cards.length} karet → ${outDir}`,
)
