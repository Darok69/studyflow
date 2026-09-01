// Catalogue of didactic card kinds — the single source of truth for the
// generator prompt, the card editor and the browser filters. A definition card
// and a case card are graded differently at the exam, so the kind travels with
// the card instead of being guessed from its text.
//
// `Card.type` ('basic' | 'cloze') stays what it always was: how the card is
// RENDERED. `Card.kind` is what it TEACHES.

export type Discipline = 'law' | 'geography' | 'general'

/** 1 = recall, 2 = understanding, 3 = application (BRIEF §3). */
export type CardLevel = 1 | 2 | 3

export const CARD_LEVELS: readonly CardLevel[] = [1, 2, 3] as const

export type CardKind =
  // shared
  | 'basic'
  | 'cloze'
  // law
  | 'definice'
  | 'znaky'
  | 'schema'
  | 'pripad'
  | 'rozliseni'
  | 'norma'
  | 'judikat'
  // geography
  | 'proces'
  | 'mapa'
  | 'cisla'
  | 'srovnani'
  | 'model'
  | 'graf'

export interface CardKindSpec {
  kind: CardKind
  discipline: Discipline
  /** Czech label for the UI (also read by the generator prompt). */
  label: string
  /** One line handed to the model describing what such a card must contain. */
  prompt: string
  /** The kind only makes sense with an image (map, chart, scheme). */
  needsImage: boolean
  /** Level the generator aims at unless the block says otherwise. */
  level: CardLevel
}

export const CARD_KINDS: readonly CardKindSpec[] = [
  {
    kind: 'basic',
    discipline: 'general',
    label: 'Otázka a odpověď',
    prompt: 'Přímá otázka a odpověď na jednu myšlenku.',
    needsImage: false,
    level: 1,
  },
  {
    kind: 'cloze',
    discipline: 'general',
    label: 'Doplňovačka',
    prompt: 'Věta z podkladu s vynechaným klíčovým termínem ve tvaru {{termín}}.',
    needsImage: false,
    level: 1,
  },
  // ---- law: a definition alone is not enough, at the exam one subsumes ----
  {
    kind: 'definice',
    discipline: 'law',
    label: 'Definice',
    prompt: 'Pojem a jeho definice tak, jak ji uznává zkoušející — bez příkladů navíc.',
    needsImage: false,
    level: 1,
  },
  {
    kind: 'znaky',
    discipline: 'law',
    label: 'Znaky',
    prompt: 'Výčet znaků skutkové podstaty nebo institutu; odpověď je číslovaný seznam, ne souvislý text.',
    needsImage: false,
    level: 1,
  },
  {
    kind: 'schema',
    discipline: 'law',
    label: 'Prüfungsschema',
    prompt: 'Kroky zkoušebního schématu v pořadí, v jakém se postupuje; každý krok jedna řádka.',
    needsImage: false,
    level: 2,
  },
  {
    kind: 'pripad',
    discipline: 'law',
    label: 'Případ',
    prompt:
      'Krátký skutkový stav (2–3 věty) a řešení v pořadí norma → znaky → subsumpce → výsledek.',
    needsImage: false,
    level: 3,
  },
  {
    kind: 'rozliseni',
    discipline: 'law',
    label: 'Rozlišení',
    prompt: 'Dva zaměnitelné instituty vedle sebe a kritérium, kterým se od sebe poznají.',
    needsImage: false,
    level: 2,
  },
  {
    kind: 'norma',
    discipline: 'law',
    label: 'Norma',
    prompt: 'Co stojí v konkrétním paragrafu a co z toho plyne pro praxi. Označení § uvádět přesně.',
    needsImage: false,
    level: 1,
  },
  {
    kind: 'judikat',
    discipline: 'law',
    label: 'Judikát',
    prompt: 'Rozhodnutí, jeho právní věta a proč se cituje. Spisovou značku neuvádět, pokud v podkladu není.',
    needsImage: false,
    level: 2,
  },
  // ---- geography: terms matter least ----
  {
    kind: 'proces',
    discipline: 'geography',
    label: 'Proces',
    prompt: 'Kauzální řetěz příčina → mechanismus → důsledek. Odpověď musí obsahovat všechny tři články.',
    needsImage: false,
    level: 2,
  },
  {
    kind: 'mapa',
    discipline: 'geography',
    label: 'Mapa',
    prompt: 'Poloha nebo název objektu na mapě či profilu; určeno pro zakrývání masek nad obrázkem.',
    needsImage: true,
    level: 1,
  },
  {
    kind: 'cisla',
    discipline: 'geography',
    label: 'Řádový odhad',
    prompt: 'Řádový odhad, ne přesné číslo. Odpověď je rozpětí a to je považováno za správné.',
    needsImage: false,
    level: 1,
  },
  {
    kind: 'srovnani',
    discipline: 'geography',
    label: 'Srovnání',
    prompt: 'Dva regiony podle stejných kritérií; odpověď drží u obou stejné pořadí kritérií.',
    needsImage: false,
    level: 2,
  },
  {
    kind: 'model',
    discipline: 'geography',
    label: 'Model',
    prompt: 'Teorie nebo model a jeho limity — co vysvětluje a kde selhává.',
    needsImage: false,
    level: 2,
  },
  {
    kind: 'graf',
    discipline: 'geography',
    label: 'Čtení grafu',
    prompt: 'Čtení grafu nebo klimadiagramu: co je na osách a co z průběhu plyne.',
    needsImage: true,
    level: 2,
  },
] as const

const BY_KIND = new Map<CardKind, CardKindSpec>(CARD_KINDS.map((s) => [s.kind, s]))

/** Spec for a kind; unknown kinds fall back to the plain question/answer card. */
export function cardKindSpec(kind: CardKind): CardKindSpec {
  return BY_KIND.get(kind) ?? BY_KIND.get('basic')!
}

export function isCardKind(value: unknown): value is CardKind {
  return typeof value === 'string' && BY_KIND.has(value as CardKind)
}

/** Kinds offered for a discipline — always including the two shared ones. */
export function kindsForDiscipline(discipline: Discipline): CardKindSpec[] {
  if (discipline === 'general') return [...CARD_KINDS]
  return CARD_KINDS.filter((s) => s.discipline === discipline || s.discipline === 'general')
}

export function isCardLevel(value: unknown): value is CardLevel {
  return value === 1 || value === 2 || value === 3
}
