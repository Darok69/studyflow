// Prompt construction. The system prompt is a FROZEN string: it is the cached
// prefix of every request, so a stray timestamp or a reordered rule would throw
// the whole prompt cache away (see usage.cache_read_input_tokens on the server).
import { cardKindSpec, kindsForDiscipline, type CardKind, type Discipline } from '../db/cardKinds'
import { MAX_ANSWER_SENTENCES } from './qc'
import type { Block, OutlineTopic } from './types'

export const SYSTEM_PROMPT = [
  'Jsi zkušený tvůrce studijních materiálů pro studenta práv (Universität Wien) a zeměpisu.',
  'Z podkladu děláš kartičky k aktivnímu vybavování, ne výpisky.',
  '',
  'Tvrdá pravidla:',
  '1. Karta má jednu myšlenku. Otázka musí být zodpověditelná zpaměti.',
  `2. Odpověď má nejvýš ${MAX_ANSWER_SENTENCES} věty. Delší látku rozděl na víc karet.`,
  '3. Vše musí plynout z podkladu. Nic nedomýšlej a nedoplňuj z obecných znalostí.',
  '4. Zachovej jazyk podkladu. Odborné termíny NIKDY nepřekládej — německý termín zůstává německy.',
  '5. Odpověď nesmí být obsažená v otázce.',
  '6. U doplňovaček označ vynechané místo dvojitými složenými závorkami: {{termín}}.',
  '7. Vracíš POUZE JSON podle zadaného schématu, bez komentáře a bez markdownu.',
].join('\n')

/** Which discipline a subject belongs to — drives which card kinds are offered. */
export function disciplineOf(subjectKind: 'law' | 'geography' | 'other' | undefined): Discipline {
  if (subjectKind === 'law') return 'law'
  if (subjectKind === 'geography') return 'geography'
  return 'general'
}

/** The kind catalogue as prompt lines — one place describes a card type. */
export function kindMenu(discipline: Discipline): string {
  return kindsForDiscipline(discipline)
    .map((s) => `- ${s.kind} (${s.label}, úroveň ${s.level}): ${s.prompt}`)
    .join('\n')
}

export function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => `[${b.id}] (strana ${b.page})${b.heading ? ` ${b.heading}` : ''}\n${b.text}`)
    .join('\n\n')
}

export interface OutlinePromptInput {
  subjectName: string
  discipline: Discipline
  blocks: Block[]
}

/**
 * Step 4 of the pipeline: the outline comes FIRST and goes to the user for
 * approval — nobody wants to throw away three hundred generated cards.
 */
export function outlinePrompt({ subjectName, discipline, blocks }: OutlinePromptInput): string {
  return [
    `Předmět: ${subjectName}`,
    `Obor: ${discipline === 'law' ? 'právo' : discipline === 'geography' ? 'zeměpis' : 'obecný'}`,
    '',
    'Níže je podklad rozdělený na bloky. Navrhni osnovu témat ke studiu:',
    '- každé téma pokrývá souvislé bloky (uveď jejich id v blockIds),',
    '- difficulty 1–3 podle náročnosti látky,',
    '- estimatedMinutes = kolik minut zabere téma nastudovat,',
    '- cardEstimate = kolik karet z tématu vznikne.',
    'Témata pojmenuj v jazyce podkladu. Žádný blok nevynechávej bez důvodu.',
    '',
    '--- PODKLAD ---',
    renderBlocks(blocks),
  ].join('\n')
}

export interface CardsPromptInput {
  subjectName: string
  discipline: Discipline
  topic: OutlineTopic
  blocks: Block[]
  /** Kinds the caller wants; defaults to everything the discipline offers. */
  kinds?: CardKind[]
}

/** Step 5: one topic, one call — a failure must not take the whole batch down. */
export function cardsPrompt({
  subjectName,
  discipline,
  topic,
  blocks,
  kinds,
}: CardsPromptInput): string {
  const menu = kinds
    ? kinds.map((k) => {
        const s = cardKindSpec(k)
        return `- ${s.kind} (${s.label}, úroveň ${s.level}): ${s.prompt}`
      }).join('\n')
    : kindMenu(discipline)

  return [
    `Předmět: ${subjectName}`,
    `Téma: ${topic.title}`,
    `Cílový počet karet: přibližně ${Math.max(1, topic.cardEstimate)}.`,
    '',
    'Dostupné typy karet (pole kind):',
    menu,
    '',
    'Úrovně: 1 = vybavení, 2 = porozumění, 3 = aplikace. Míchej je —',
    'samotné definice u zkoušky nestačí, u práva se podřazuje, u zeměpisu se vysvětlují procesy.',
    'Ke každé kartě uveď blockId bloku, ze kterého vychází.',
    '',
    '--- BLOKY TÉMATU ---',
    renderBlocks(blocks),
  ].join('\n')
}

export interface QcPromptInput {
  cards: { front?: string; back?: string; text?: string; kind: CardKind }[]
  sourceText: string
}

/**
 * Step 7: the second pass. Only asks what rules cannot decide — whether the
 * card really follows from the source and whether it is answerable from memory.
 */
export function qcPrompt({ cards, sourceText }: QcPromptInput): string {
  return [
    'Zkontroluj vygenerované karty proti podkladu. U každé rozhodni:',
    '- je otázka zodpověditelná zpaměti?',
    `- je odpověď nejvýš ${MAX_ANSWER_SENTENCES} věty?`,
    '- plyne odpověď z podkladu (nic domyšleného)?',
    '',
    'Vrať pole verdiktů ve stejném pořadí jako karty: pro každou kartu',
    '{ "ok": true } nebo { "ok": false, "issue": "<krátký důvod>" }.',
    '',
    '--- KARTY ---',
    JSON.stringify(cards, null, 1),
    '',
    '--- PODKLAD ---',
    sourceText,
  ].join('\n')
}
