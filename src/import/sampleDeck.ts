// A ready-to-import demo deck (basic + cloze + an inline-SVG diagram card) and
// a copyable prompt users can hand to an AI to generate their own decks.
// The sample deck content stays Czech in every language; the AI prompt follows
// the UI language.
import { currentLang } from '../i18n'

export const sampleDeck = {
  subject: 'Římské právo',
  examDate: '2026-07-15',
  reminderTime: '18:30',
  cards: [
    {
      type: 'basic',
      front: 'Co byl Zákon dvanácti desek (Lex duodecim tabularum)?',
      back: 'Nejstarší kodifikace římského práva z roku 451–450 př. n. l., vystavená na fóru. Základ pro další vývoj civilního práva.',
      tags: ['historie'],
    },
    {
      type: 'cloze',
      text: 'Zákon dvanácti desek vznikl roku {{451 př. n. l.}} a byl sepsán komisí {{decemvirů}}.',
      tags: ['historie'],
    },
    {
      type: 'basic',
      front: 'Jaké jsou tři základní statusy osoby v římském právu?',
      back: 'Status libertatis (svoboda), status civitatis (občanství) a status familiae (postavení v rodině).',
      tags: ['osoby'],
    },
    {
      type: 'cloze',
      text: 'Vlastnické právo se v Římě nazývalo {{dominium}} a drženou věc označoval pojem {{possessio}}.',
      tags: ['věcná práva'],
    },
    {
      type: 'basic',
      front: 'Jaké byly hlavní fáze legisakčního civilního procesu?',
      back: 'Řízení in iure (před prétorem — vymezení sporu) a řízení apud iudicem (před soudcem — dokazování a rozsudek).',
      tags: ['proces'],
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><rect x="8" y="34" width="120" height="52" rx="8" fill="#7A6FF0"/><rect x="192" y="34" width="120" height="52" rx="8" fill="#34C9A3"/><text x="68" y="56" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#15151E" font-weight="700">in iure</text><text x="68" y="74" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#15151E">před prétorem</text><text x="252" y="56" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#15151E" font-weight="700">apud iudicem</text><text x="252" y="74" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#15151E">před soudcem</text><line x1="128" y1="60" x2="190" y2="60" stroke="#908EA2" stroke-width="3"/><path d="M182 53 l10 7 -10 7 z" fill="#908EA2"/></svg>',
    },
    {
      type: 'basic',
      front: 'Co znamená zásada "pacta sunt servanda"?',
      back: 'Smlouvy se mají dodržovat — uzavřené dohody zavazují strany k plnění.',
      tags: ['závazky'],
    },
  ],
}

export const sampleDeckJson = JSON.stringify(sampleDeck, null, 2)

const aiPromptCs = `Vytvoř studijní balíček karet ve formátu JSON pro aplikaci StudyFlow.

Vrať POUZE platný JSON (žádný další text) přesně v této struktuře:

{
  "subject": "Název předmětu",
  "examDate": "RRRR-MM-DD",        // datum zkoušky, nebo null
  "reminderTime": "HH:MM",          // čas připomenutí, nebo null
  "cards": [
    { "type": "basic", "front": "Otázka?", "back": "Odpověď", "tags": [] },
    { "type": "cloze", "text": "Věta s {{vynechaným pojmem}}.", "tags": [] },
    { "type": "basic", "front": "Otázka s diagramem?", "back": "Odpověď", "svg": "<svg ...>...</svg>" }
  ]
}

Pravidla:
- "basic" karta má "front" (otázka) a "back" (odpověď).
- "cloze" karta má "text" a v něm jedno či více míst {{takto}}, která se při studiu skryjí.
- Volitelně přidej "svg" s jednoduchým diagramem nebo myšlenkovou mapou (čistý inline SVG, bez skriptů).
- Volitelně přidej "tags" jako pole štítků.
- Počet karet neomezuj — pokryj téma vyčerpávajícím způsobem, do plné hloubky a detailu (klidně stovky karet, 500–1000 u rozsáhlých témat). Každá karta musí být věcně naprosto přesná.

Téma: [SEM DOPLŇ TÉMA, NAPŘ. „Římské právo — věcná práva“]`

const aiPromptEn = `Create a study deck of flashcards in JSON format for the StudyFlow app.

Return ONLY valid JSON (no other text) in exactly this structure:

{
  "subject": "Subject name",
  "examDate": "YYYY-MM-DD",        // exam date, or null
  "reminderTime": "HH:MM",          // reminder time, or null
  "cards": [
    { "type": "basic", "front": "Question?", "back": "Answer", "tags": [] },
    { "type": "cloze", "text": "A sentence with a {{blanked term}}.", "tags": [] },
    { "type": "basic", "front": "Question with a diagram?", "back": "Answer", "svg": "<svg ...>...</svg>" }
  ]
}

Rules:
- A "basic" card has "front" (question) and "back" (answer).
- A "cloze" card has "text" with one or more spots marked {{like this}}, which get hidden during study.
- Optionally add "svg" with a simple diagram or mind map (clean inline SVG, no scripts).
- Optionally add "tags" as an array of labels.
- Do not limit the number of cards — cover the topic exhaustively, in full depth and detail (hundreds of cards are fine, 500–1000 for large topics). Every card must be factually precise.

Topic: [FILL IN THE TOPIC HERE, E.G. “Roman law — property rights”]`

const aiPromptDe = `Erstelle ein Lernkarten-Deck im JSON-Format für die App StudyFlow.

Gib NUR gültiges JSON zurück (keinen weiteren Text), exakt in dieser Struktur:

{
  "subject": "Name des Fachs",
  "examDate": "JJJJ-MM-TT",        // Prüfungsdatum, oder null
  "reminderTime": "HH:MM",          // Erinnerungszeit, oder null
  "cards": [
    { "type": "basic", "front": "Frage?", "back": "Antwort", "tags": [] },
    { "type": "cloze", "text": "Ein Satz mit einem {{ausgelassenen Begriff}}.", "tags": [] },
    { "type": "basic", "front": "Frage mit Diagramm?", "back": "Antwort", "svg": "<svg ...>...</svg>" }
  ]
}

Regeln:
- Eine "basic"-Karte hat "front" (Frage) und "back" (Antwort).
- Eine "cloze"-Karte hat "text" mit einer oder mehreren Stellen {{wie hier}}, die beim Lernen verborgen werden.
- Optional füge "svg" mit einem einfachen Diagramm oder einer Mindmap hinzu (sauberes Inline-SVG, ohne Skripte).
- Optional füge "tags" als Array von Schlagwörtern hinzu.
- Begrenze die Kartenanzahl nicht — decke das Thema erschöpfend und in voller Tiefe ab (gern Hunderte Karten, 500–1000 bei umfangreichen Themen). Jede Karte muss sachlich absolut korrekt sein.

Thema: [HIER DAS THEMA EINSETZEN, Z. B. „Römisches Recht — Sachenrechte“]`

export const aiPrompt = { cs: aiPromptCs, en: aiPromptEn, de: aiPromptDe }[currentLang()]
