// Učebnice odjinud: co smí přijít zvenčí do /api/pub a MCP.
//
// Balíček (pack) je JEDEN dokument, který cizí Claude sestaví z vlastních
// podkladů: předmět, přednášky, a v každém slidu text + karty. Server z něj
// odvodí tři věci, které appka už umí číst — rejstřík učebnice, soubor ke
// každé přednášce a balíček karet. Proto se otázky píšou JEN JEDNOU:
// v učebnici u slidu, odkud se berou i karty (přesně jak to dělá vlastní
// pipeline v content/).
//
// Modul je čistý: žádný disk, žádná síť, žádná i18n. Chyby jsou krátké
// anglické kódy — jdou do logu a do odpovědi API, ne do UI.
import { isCardKind, isCardLevel, type CardKind, type CardLevel } from '../db/cardKinds'

// ---- co smí přijít ----

export interface PackTermInput {
  term?: unknown
  def?: unknown
}

export interface PackCardInput {
  q?: unknown
  a?: unknown
  front?: unknown
  back?: unknown
  text?: unknown
  kind?: unknown
  level?: unknown
  difficulty?: unknown
  topic?: unknown
  tags?: unknown
}

export interface PackSlideInput {
  n?: unknown
  title?: unknown
  text?: unknown
  terms?: unknown
  cards?: unknown
}

export interface PackLectureInput {
  id?: unknown
  unit?: unknown
  title?: unknown
  slides?: unknown
}

export interface PackInput {
  subject?: unknown
  title?: unknown
  examDate?: unknown
  code?: unknown
  number?: unknown
  lectures?: unknown
  cards?: unknown
}

// ---- co z toho vyleze ----

export interface PackTerm {
  term: string
  def: string
}

export interface PackSlide {
  n: number
  title: string
  text: string
  terms?: PackTerm[]
}

export interface PackLectureFile {
  lecture_id: string
  course: string
  course_title: string
  unit: string
  title: string
  slides: PackSlide[]
}

export interface PackIndexLecture {
  id: string
  unit: string
  title: string
  slides: number
  cards: number
}

export interface PackIndex {
  exam: { name: string; date: string | null; language: string | null } | null
  courses: {
    code: string
    number: string
    title: string
    subject: string
    lectures: PackIndexLecture[]
  }[]
}

export interface PackDeckCard {
  type: 'basic'
  kind: CardKind
  level: CardLevel
  topic: string
  front: string
  back: string
  tags: string[]
  sourceRef: string
}

export interface PackDeck {
  subject: string
  examDate: string | null
  cards: PackDeckCard[]
  filing: never[]
}

export interface NormalizedPack {
  slug: string
  subject: string
  examDate: string | null
  index: PackIndex
  /** Klíč je ID přednášky i jméno souboru — už s prefixem balíčku. */
  lectures: Record<string, PackLectureFile>
  deck: PackDeck
  warnings: string[]
}

// ---- meze ----
// Štědré, ale konečné: jeden balíček nesmí zaplnit disk ani rozbít rejstřík.
export const MAX_LECTURES = 200
export const MAX_SLIDES_PER_LECTURE = 500
export const MAX_CARDS = 5000
export const MAX_TEXT = 20_000
export const MAX_TITLE = 300

/** ID přednášky, jak ho píše autor balíčku (prefix doplní server). */
export const LECTURE_ID_RE = /^[A-Za-z0-9]{1,12}$/
/** Jméno balíčku v URL i v souborech. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/
/** Prefix, který server balíčku přidělí — drží ID přednášek oddělená mezi uživateli. */
export const PACK_PREFIX_RE = /^[a-z0-9]{6}$/

/**
 * Jméno → slug. Diakritika pryč, mezery na pomlčky, nic jiného nezůstane.
 * Když po očištění nezbude nic použitelného, vrací prázdný řetězec a volající
 * si musí říct o jiné jméno (nevymýšlíme uživateli název za něj).
 */
export function packSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 41)
    .replace(/-+$/g, '')
  return SLUG_RE.test(base) ? base : ''
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function normalizeTerms(value: unknown): PackTerm[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: PackTerm[] = []
  for (const raw of value.slice(0, 40)) {
    const item = raw as PackTermInput
    const term = str(item?.term, MAX_TITLE)
    const def = str(item?.def, MAX_TEXT)
    if (term && def) out.push({ term, def })
  }
  return out.length ? out : undefined
}

/**
 * Karta ze slidu. Bere `q`/`a` (jak je píše pipeline) i `front`/`back`
 * (jak je vede appka) — cizí Claude nemá důvod znát oba tvary, tak uznáme oba.
 */
function normalizeCard(raw: unknown, fallbackTopic: string, sourceRef: string): PackDeckCard | null {
  const item = raw as PackCardInput
  const front = str(item?.front, MAX_TEXT) || str(item?.q, MAX_TEXT)
  const back = str(item?.back, MAX_TEXT) || str(item?.a, MAX_TEXT)
  if (!front || !back) return null
  const kind = isCardKind(item?.kind) ? item.kind : 'basic'
  // `difficulty` je slovo vlastní pipeline, `level` slovo appky — obojí 1–3.
  const rawLevel = item?.level ?? item?.difficulty
  const level = isCardLevel(rawLevel) ? rawLevel : 1
  const tags = Array.isArray(item?.tags)
    ? item.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 8)
    : []
  return {
    type: 'basic',
    kind,
    level,
    topic: str(item?.topic, MAX_TITLE) || fallbackTopic,
    front,
    back,
    tags,
    sourceRef,
  }
}

export type PackResult = { pack: NormalizedPack } | { error: string }

/**
 * Zkontroluje a přepíše balíček do tvaru, který server uloží na disk.
 *
 * `prefix` přiděluje server při založení balíčku a drží ID přednášek jedinečná
 * napříč uživateli — bez něj by cizí `PD01` přebilo Danielovo v rejstříku.
 */
export function normalizePack(
  input: PackInput,
  opts: { slug: string; prefix: string },
): PackResult {
  const { slug, prefix } = opts
  if (!SLUG_RE.test(slug)) return { error: 'bad-slug' }
  if (!PACK_PREFIX_RE.test(prefix)) return { error: 'bad-prefix' }

  const subject = str(input?.subject, MAX_TITLE)
  if (!subject) return { error: 'missing-subject' }

  const examDate = isIsoDate(input?.examDate) ? input.examDate : null
  if (input?.examDate != null && !examDate) return { error: 'bad-exam-date' }

  const rawLectures = Array.isArray(input?.lectures) ? input.lectures : []
  if (rawLectures.length === 0) return { error: 'no-lectures' }
  if (rawLectures.length > MAX_LECTURES) return { error: 'too-many-lectures' }

  const warnings: string[] = []
  const lectures: Record<string, PackLectureFile> = {}
  const indexLectures: PackIndexLecture[] = []
  const cards: PackDeckCard[] = []
  const seenIds = new Set<string>()
  const code = str(input?.code, 12).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'UC'
  const courseTitle = str(input?.title, MAX_TITLE) || subject

  for (const [i, rawLecture] of rawLectures.entries()) {
    const lecture = rawLecture as PackLectureInput
    const givenId = str(lecture?.id, 12)
    const id = LECTURE_ID_RE.test(givenId) ? givenId : `L${String(i + 1).padStart(2, '0')}`
    if (!LECTURE_ID_RE.test(givenId)) warnings.push(`lecture-id-generated:${id}`)
    if (seenIds.has(id)) return { error: `duplicate-lecture-id:${id}` }
    seenIds.add(id)

    const title = str(lecture?.title, MAX_TITLE)
    if (!title) return { error: `missing-lecture-title:${id}` }
    const unit = str(lecture?.unit, MAX_TITLE) || `Téma ${i + 1}`

    const rawSlides = Array.isArray(lecture?.slides) ? lecture.slides : []
    if (rawSlides.length === 0) return { error: `no-slides:${id}` }
    if (rawSlides.length > MAX_SLIDES_PER_LECTURE) return { error: `too-many-slides:${id}` }

    const fullId = `${prefix}${id}`
    const slides: PackSlide[] = []
    let cardsHere = 0

    for (const [j, rawSlide] of rawSlides.entries()) {
      const slide = rawSlide as PackSlideInput
      const n = typeof slide?.n === 'number' && Number.isInteger(slide.n) && slide.n > 0 ? slide.n : j + 1
      const text = str(slide?.text, MAX_TEXT)
      const slideTitle = str(slide?.title, MAX_TITLE)
      // Prázdný slide (jen nadpis obrázku) je legitimní, ale slide bez nadpisu
      // I textu je omyl — v učebnici by se zobrazil jako prázdné místo.
      if (!slideTitle && !text) {
        warnings.push(`empty-slide:${fullId}#${n}`)
        continue
      }
      const terms = normalizeTerms(slide?.terms)
      slides.push({ n, title: slideTitle, text, ...(terms ? { terms } : {}) })

      if (Array.isArray(slide?.cards)) {
        for (const rawCard of slide.cards) {
          const card = normalizeCard(rawCard, title, `${fullId}#${n}`)
          if (!card) {
            warnings.push(`card-skipped:${fullId}#${n}`)
            continue
          }
          if (cards.length >= MAX_CARDS) return { error: 'too-many-cards' }
          cards.push(card)
          cardsHere++
        }
      }
    }

    if (slides.length === 0) return { error: `no-slides:${id}` }

    lectures[fullId] = {
      lecture_id: fullId,
      course: code,
      course_title: courseTitle,
      unit,
      title,
      slides,
    }
    indexLectures.push({ id: fullId, unit, title, slides: slides.length, cards: cardsHere })
  }

  // Karty mimo slidy: balíček může nést i hotovou sadu otázek bez učebnice.
  if (Array.isArray(input?.cards)) {
    for (const rawCard of input.cards) {
      const card = normalizeCard(rawCard, subject, slug)
      if (!card) {
        warnings.push('card-skipped:loose')
        continue
      }
      if (cards.length >= MAX_CARDS) return { error: 'too-many-cards' }
      cards.push(card)
    }
  }

  return {
    pack: {
      slug,
      subject,
      examDate,
      index: {
        exam: examDate ? { name: subject, date: examDate, language: null } : null,
        courses: [
          {
            code: `${prefix.toUpperCase()}${code}`,
            number: str(input?.number, 12) || '',
            title: courseTitle,
            subject,
            lectures: indexLectures,
          },
        ],
      },
      lectures,
      deck: { subject, examDate, cards, filing: [] },
      warnings,
    },
  }
}
