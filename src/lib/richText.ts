/**
 * Výklad v učebnici je prostý text — s jedinou výjimkou: tabulky.
 *
 * Přehledové tabulky (teploty, velikosti zrn, tvrdosti…) jsou nejcennější
 * pomůcka k písemce s výběrem možností, a jako odstavec by byly nečitelné.
 * Píšou se proto markdownem (řádky začínající `|`, druhý řádek `|---|`) a
 * mezititulek `### `. Nic dalšího se nevykládá — text, který tabulku nemá,
 * vyjde jako dřív jeden odstavec.
 *
 * Čistá funkce (bez DOM), testuje se v test/core.test.ts.
 */

export type RichBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }

const isRow = (line: string) => line.trim().startsWith('|')
const isRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

function cells(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

export function parseRichText(text: string): RichBlock[] {
  const lines = text.split('\n')
  const out: RichBlock[] = []
  let para: string[] = []
  const flush = () => {
    const joined = para.join('\n').trim()
    if (joined) out.push({ kind: 'p', text: joined })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // A table needs a header row AND the rule under it; a stray "|" is text.
    if (isRow(line) && i + 1 < lines.length && isRule(lines[i + 1])) {
      flush()
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isRow(lines[i])) {
        const row = cells(lines[i])
        while (row.length < head.length) row.push('')
        rows.push(row.slice(0, head.length))
        i++
      }
      i--
      out.push({ kind: 'table', head, rows })
      continue
    }
    if (/^###\s+/.test(line)) {
      flush()
      out.push({ kind: 'h', text: line.replace(/^###\s+/, '').trim() })
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    para.push(line)
  }
  flush()
  return out
}
