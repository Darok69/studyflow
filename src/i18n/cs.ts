// Czech dictionary — the source of truth for message keys. Values are either
// plain strings or functions (parametrised / pluralised messages).

/** Czech plural: 1 / 2–4 / 5+ */
const dny = (n: number) => (n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní')
const karty = (n: number) => (n === 1 ? 'karta' : n >= 2 && n <= 4 ? 'karty' : 'karet')
const kartyAcc = (n: number) => (n === 1 ? 'kartu' : n >= 2 && n <= 4 ? 'karty' : 'karet')
const predmety = (n: number) => (n === 1 ? 'předmět' : n >= 2 && n <= 4 ? 'předměty' : 'předmětů')

const WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']

export const cs = {
  // Common
  locale: 'cs-CZ',
  loading: 'Načítám…',
  back: '← Zpět',
  backPlain: 'Zpět',
  cancel: 'Zrušit',
  save: 'Uložit',
  saving: 'Ukládám…',
  delete: 'Smazat',
  close: 'Zavřít',
  edit: 'Upravit',
  copy: 'Zkopírovat',
  copied: 'Zkopírováno ✓',
  weekdayShort: (day: number) => WEEKDAYS[day],

  // App shell
  navImport: 'Import',

  // Home
  navCards: 'Kartičky',
  navStats: 'Statistiky',
  navSettings: 'Nastavení',
  todayPlan: 'Dnešní plán',
  toReview: 'k opakování',
  newCount: 'nových',
  estMinutes: (min: number) => `~${min} min`,
  nothingTodayLeaf: 'Na dnešek nic nečeká 🌿',
  studyAll: 'Studovat vše',
  heavyLoad: (cards: number, minutes: number) =>
    `Dnes je toho víc (${cards} ${karty(cards)}, ~${minutes} min). Klidně to rozlož během dne — nemusíš všechno najednou. 🌱`,
  emptyNothingYet: 'Zatím tu nic není — a to je úplně v pořádku.',
  emptyImportHint: 'Naimportuj si první balíček a můžeme začít v klidu.',
  importDeckBtn: 'Importovat balíček',

  // Study
  doneHeading: 'Hotovo!',
  doneCram: (n: number) =>
    `Procvičil sis ${n} ${kartyAcc(n)} nanečisto — plán opakování zůstal nedotčený. 🌿`,
  doneStudy: (n: number) =>
    `Dal sis na tom záležet — prošel jsi ${n} ${kartyAcc(n)}. Pěkná práce. 🌿`,
  nothingToCram: 'Není co procvičovat',
  nothingTodayPlain: 'Na dnešek nic nečeká',
  enjoyBreak: 'Užij si pauzu — uvidíme se zase, až budeš chtít.',
  backToOverview: 'Zpět na přehled',
  undoLast: '⌫ Vrátit poslední hodnocení',
  endSession: 'Konec',
  undoTitle: 'Vrátit poslední hodnocení (Z)',
  undoShort: '⌫ Zpět',
  typeCram: 'procvičování',
  typeNew: 'nová',
  typeReview: 'opakování',
  buryBtn: 'Odložit',
  buryTitle: 'Kartu dnes přeskočit — vrátí se zítra',
  suspendBtn: 'Pozastavit',
  suspendTitle: 'Vyřadit z opakování (obnovíš v Kartičkách)',
  cramNote: 'Procvičování nanečisto — hodnocení neovlivní naplánovaná opakování.',
  breakNudge: (min: number) => `Studuješ přes ${min} minut — dáš si pauzu? 🙂`,
  keepGoing: 'Pokračovat',
  leechHint: 'Tahle kartička se ti pořád vrací. Často pomůže ji přeformulovat nebo rozdělit na menší.',
  keepCard: 'Nechat',
  verdictCorrect: '✓ Správně',
  verdictClose: '≈ Skoro — mrkni na rozdíl',
  verdictWrong: 'Jinak — nevadí, od toho opakujeme',
  yourAnswer: (a: string) => `tvoje odpověď: „${a}"`,
  answerPlaceholder: 'Napiš odpověď…',
  checkAnswer: 'Zkontrolovat',
  skipTypingTitle: 'Přeskočit psaní',
  justShow: 'Jen zobrazit',
  showAnswer: 'Zobrazit odpověď',

  // Rating buttons (Anki convention)
  rateAgain: 'Znovu',
  rateHard: 'Těžké',
  rateGood: 'Dobré',
  rateEasy: 'Snadné',
  intervalShort: (days: number) => (days <= 0 ? 'dnes' : days === 1 ? '1 den' : `${days} d`),

  // Subject card
  learnedRatio: (studied: number, total: number) => `naučeno ${studied} / ${total}`,
  readinessPillTitle:
    'Odhad, kolik si toho budeš pamatovat v den zkoušky (FSRS křivka zapomínání)',
  readinessPercent: (p: number) => `připravenost ${p} %`,
  subjectTodayCounts: (due: number, fresh: number) => `${due} k opakování · ${fresh} nových`,
  doneForToday: 'pro dnešek hotovo',
  cramBtn: 'Procvičit',
  subjectOpenTitle: 'Klepnutím spustíš dnešní učení tohoto předmětu',

  // Browser
  filterAll: 'Vše',
  filterNew: 'Nové',
  filterLearning: 'V učení',
  filterSuspended: 'Pozastavené',
  filterLeech: 'Problémové',
  cardsCount: (n: number) => `${n} ${karty(n)}`,
  newCardBtn: '+ Nová karta',
  searchPlaceholder: 'Hledat v otázkách, odpovědích a štítcích…',
  allSubjects: 'Všechny předměty',
  noCardMatches: 'Žádná karta neodpovídá filtru.',
  editCardTitle: 'Upravit kartu',
  chipSuspended: 'pozastavená',
  chipBuried: 'odložená',
  chipLeech: 'problémová',
  unburyTitle: 'Vrátit odloženou kartu do dnešní fronty',
  unburyBtn: 'Vrátit',
  resumeTitle: 'Vrátit do opakování',
  suspendTitleShort: 'Vyřadit z opakování',
  resumeBtn: 'Obnovit',

  // Login
  errTooManyAttempts: 'Příliš mnoho pokusů — zkus to za chvíli znovu.',
  errBadCredentials: 'E-mail nebo přístupový kód nesedí.',
  errServer: 'Nepodařilo se spojit se serverem — zkus to znovu.',
  welcome: 'Vítej ve StudyFlow',
  introTagline: 'Chytré kartičky pro dlouhodobé zapamatování.',
  introPoint1: 'Opakování řídí algoritmus FSRS — učíš se přesně ve chvíli, kdy bys začal zapomínat.',
  introPoint2: 'Připravenost ke zkoušce: vidíš, kolik % látky bys reálně věděl v den zkoušky.',
  introPoint3: 'Funguje offline jako aplikace na mobilu i počítači. Tvá data zůstávají jen u tebe.',
  inviteOnly: 'Aplikace je jen pro zvané. Přihlas se e-mailem a přístupovým kódem, který jsi dostal.',
  emailLabel: 'E-mail',
  accessCodeLabel: 'Přístupový kód',
  loggingIn: 'Přihlašuji…',
  loginBtn: 'Přihlásit se',

  // Import
  importTitle: 'Import balíčku',
  sharedBanner: 'Někdo ti poslal balíček kartiček 🎁 — mrkni na obsah níže a potvrď import.',
  pasteHint: 'Vlož JSON s kartami, nebo si načti ukázkový balíček.',
  jsonPlaceholder: '{ "subject": "...", "examDate": "RRRR-MM-DD", "cards": [ ... ] }',
  loadSample: 'Načíst ukázkový balíček',
  importing: 'Importuji…',
  importBtn: 'Importovat',
  aiHeading: 'Vygeneruj balíček pomocí AI',
  aiHint: 'Zkopíruj prompt do svého oblíbeného AI nástroje, doplň téma a výsledný JSON vlož výše.',

  // Deck parsing errors
  errInvalidJson: (msg: string) => `Neplatný JSON: ${msg}`,
  errRootObject: 'Kořenový prvek musí být objekt balíčku.',
  errMissingSubject: 'Chybí název předmětu ("subject").',
  errExamDateFormat: 'Pole "examDate" musí být ve formátu YYYY-MM-DD.',
  errCardsArray: 'Pole "cards" musí být pole karet.',
  errClozeCardNeedsBlank: (n: number) =>
    `Karta #${n}: cloze musí obsahovat alespoň jedno {{vynechané slovo}}.`,
  errBasicCardNeedsBoth: (n: number) => `Karta #${n}: základní karta musí mít "front" i "back".`,
  errNoUsableCards: 'Balíček neobsahuje žádné použitelné karty.',

  // Backup parsing errors (shown in Settings when a restore fails)
  errBackupNotJson: 'Soubor není platný JSON.',
  errBackupForeign: 'Tohle nevypadá jako záloha StudyFlow.',
  errBackupNewer: 'Záloha je z novější verze aplikace.',
  errBackupMissingData: 'Záloze chybí data (subjects / cards / reviews).',
  errBackupCorrupt: 'Záloha obsahuje poškozené záznamy.',

  // Settings
  sectionAccount: 'Účet a synchronizace',
  lastSyncAt: (when: string) => `Poslední synchronizace: ${when}`,
  notSyncedYet: 'Zatím nesynchronizováno.',
  syncAutoNote: 'Data se zálohují na server automaticky — na dalším zařízení se stačí přihlásit.',
  syncing: 'Synchronizuji…',
  syncNow: 'Synchronizovat teď',
  logout: 'Odhlásit se',
  syncFailed: 'Synchronizace se nepovedla — zkus to znovu.',
  reminderName: 'Denní připomínka',
  reminderDesc:
    'Push notifikace s počtem kartiček, které na tebe ten den čekají. Funguje i při zavřené aplikaci (nainstaluj si ji na plochu).',
  reminderTimeLabel: 'Čas připomínky',
  reminderBlocked: 'Prohlížeč notifikace zablokoval — povol je v nastavení stránky.',
  reminderFailed: 'Nepodařilo se zapnout připomínky — zkus to znovu.',
  reminderConfirmNote: 'Hned po zapnutí ti přijde potvrzovací notifikace, ať víš, že to funguje.',
  pushTestBtn: 'Poslat zkušební notifikaci',
  pushTestSending: 'Posílám…',
  pushTestSent: 'Odesláno — během chvilky ti přijde oznámení 🔔',
  pushTestFailed: 'Odeslání se nepovedlo — zkus připomínku vypnout a znovu zapnout.',
  pushInstallHint:
    'Na iPhonu/iPadu fungují notifikace jen z nainstalované aplikace: v Safari klepni na Sdílet → „Přidat na plochu" a otevři StudyFlow z plochy — pak tu jde denní připomínka zapnout.',
  sectionLearning: 'Učení',
  retentionName: 'Cílová zapamatovanost',
  retentionDesc:
    'Kolik procent karet chceš mít v hlavě, když přijdou na řadu. Vyšší hodnota = častější opakování; 90 % je rozumný standard.',
  previewsName: 'Náhledy intervalů',
  previewsDesc: 'Na tlačítkách hodnocení uvidíš, za jak dlouho se karta vrátí (jako v Anki).',
  typedName: 'Psané odpovědi',
  typedDesc:
    'U krátkých odpovědí nejdřív napíšeš, co si myslíš — aktivní vybavování je nejsilnější forma učení. Překlepy a diakritika se odpouští.',
  sectionPace: 'Tempo a pohoda',
  capName: 'Denní strop nových karet',
  capDesc:
    'Klidnější tempo před zkouškou — nové karty se rozloží do více dní místo jednoho velkého sezení. Opakování se nestropuje.',
  capMaxLabel: 'Max. nových karet za den',
  breakAfterLabel: 'Připomenout pauzu po (min)',
  sectionAppearance: 'Vzhled karet',
  fontSizeName: 'Velikost písma',
  fontSmaller: 'Menší',
  fontNormal: 'Normální',
  fontLarger: 'Větší',
  sansName: 'Bezpatkové písmo',
  sansDesc:
    'Karty se standardně zobrazují patkovým (knižním) písmem. Pokud ti sedí víc bezpatkové, přepni.',
  sectionLanguage: 'Jazyk / Language / Sprache',
  sectionData: 'Data',
  dataDesc:
    'Vše je uložené jen v tomto prohlížeči (offline). Záloha přenese předměty, karty i celou historii učení na jiné zařízení.',
  downloadBackup: 'Stáhnout zálohu',
  restoreFromBackup: 'Obnovit ze zálohy',
  deleteAllData: 'Smazat všechna data',
  confirmDeleteAll: 'Opravdu smazat všechna data (předměty, karty i historii)?',
  confirmRestore: (nSubjects: number, nCards: number) =>
    `Nahradit všechna současná data zálohou (${nSubjects} ${predmety(nSubjects)}, ${nCards} ${karty(nCards)})?`,
  backupFileName: (date: string) => `studyflow-zaloha-${date}.json`,

  // Admin users
  adminSection: 'Přístupy (admin)',
  adminDesc:
    'Kdo tu je, může se přihlásit. Nový uživatel dostane přístupový kód — zobrazí se jen jednou, pošli mu ho třeba WhatsAppem.',
  loadUsersFailed: 'Nepodařilo se načíst uživatele.',
  emailExists: 'Tenhle e-mail už přístup má.',
  invalidEmail: 'To nevypadá jako e-mail.',
  addFailed: 'Přidání se nepovedlo — zkus to znovu.',
  confirmNewCode: (email: string) =>
    `Vygenerovat nový kód pro ${email}? Starý přestane platit a odhlásí se.`,
  confirmRemoveUser: (email: string) =>
    `Odebrat přístup pro ${email}? Smaže se i jeho záloha na serveru.`,
  issuedMessage: (email: string, code: string) =>
    `StudyFlow → https://study.dmarka.eu\nE-mail: ${email}\nPřístupový kód: ${code}`,
  addBtn: 'Přidat',
  codeShownOnce: 'Kód se už znovu nezobrazí — teď ho zkopíruj a pošli.',
  copyMessage: 'Zkopírovat zprávu',
  lastLoginAt: (when: string) => `naposledy ${when}`,
  notLoggedInYet: 'zatím nepřihlášen',
  newCodeBtn: 'Nový kód',
  removeBtn: 'Odebrat',
  adminEmailPlaceholder: 'kamarad@email.cz',

  // Card editor
  errSelectSubject: 'Vyber předmět.',
  errClozeNeedsBlank: 'Doplňovačka musí obsahovat alespoň jedno {{vynechané slovo}}.',
  errBasicNeedsBoth: 'Základní karta musí mít otázku i odpověď.',
  confirmDeleteCard: 'Smazat tuhle kartu i s její historií?',
  newCardTitle: 'Nová karta',
  subjectLabel: 'Předmět',
  cardTypeLabel: 'Typ karty',
  typeBasic: 'Základní',
  typeCloze: 'Doplňovačka',
  frontLabel: 'Přední strana (otázka)',
  backLabel: 'Zadní strana (odpověď)',
  clozeFieldLabel: 'Text s {{vynechanými}} slovy — každé {{...}} se stane doplňovačkou',
  clozePlaceholder: 'Dvanáct desek pochází z roku {{451 př. n. l.}}.',
  tagsLabel: 'Štítky (oddělené čárkou)',

  // Subject editor
  errSubjectNeedsName: 'Předmět potřebuje název.',
  confirmDeleteSubject: (name: string) => `Smazat předmět „${name}" a všechny jeho karty?`,
  editSubjectTitle: 'Upravit předmět',
  nameLabel: 'Název',
  examDateLabel: 'Datum zkoušky',
  reminderLabel: 'Připomínka',
  dailyNewLabel: 'Nových kartiček denně',
  dailyNewAuto: 'auto',
  dailyNewHint: 'Prázdné = automaticky podle termínu zkoušky. 0 = žádné nové karty.',
  subjectColorLabel: 'Barva předmětu',
  colorN: (n: number) => `Barva ${n}`,
  shareTooBig: 'Balíček je na odkaz moc velký — použij Exportovat a pošli soubor.',
  exportBtn: 'Exportovat',
  linkCopied: 'Odkaz zkopírován ✓',
  shareLink: 'Sdílet odkazem',

  // Stats
  statsTitle: 'Tvůj pokrok',
  daysInRow: (n: number) => (n === 1 ? 'den v řadě' : n >= 2 && n <= 4 ? 'dny v řadě' : 'dní v řadě'),
  reviewsPer7: 'opakování / 7 dní',
  learnedCardsLabel: 'naučených karet',
  last7Days: 'Posledních 7 dní',
  upcoming14: 'Co tě čeká (14 dní)',
  forecastNote:
    'Naplánovaná opakování den po dni — nové karty se přidávají zvlášť podle termínů zkoušek.',
  forecastSparkLabel: 'Naplánovaná opakování na příštích 14 dní',
  last12Weeks: 'Posledních 12 týdnů',
  readinessSection: 'Připravenost ke zkoušce',
  readinessNote:
    'Odhad z křivky zapomínání (FSRS): kolik si toho budeš pamatovat v den zkoušky, kdyby ses ode dneška už neučil. Roste s každým opakováním.',
  statsKeepGoing: 'Konzistence je víc než výkon. Hezky pokračuj. 🌿',
  statsFreshStart: 'Každý den je nový začátek — klidně se vrať dnes. 🌱',
  sparklineLabel: 'Opakování za posledních 7 dní',
  heatmapLabel: 'Aktivita opakování v posledních týdnech',

  // Dates / countdowns
  countdownNone: 'bez termínu',
  countdownToday: 'dnes',
  countdownTomorrow: 'zítra',
  countdownIn: (n: number) => `za ${n} ${dny(n)}`,
  countdownOverdue: (n: number) => `${n} ${dny(n)} po termínu`,

  // Encouragement (never punitive)
  encStart: 'Začni klidně jednou kartou — stačí pár minut. 🌱',
  encDoneToday: 'Dnešek máš hotový — pěkná práce. 🌿',
  encNothingWaiting: 'Pro dnešek nic nečeká. Užij si pauzu. 🌿',
  encMissed: 'Včera jsi vynechal — nevadí, jdeme dál.',
  encStreak: (n: number) => `Máš sérii ${n} ${dny(n)} v řadě — hezky popořádku. ✨`,

  // Sync conflict
  syncConflict:
    'Na serveru jsou novější data (z jiného zařízení), ale i tady máš neuložené změny.\n\nOK = načíst data ze serveru (místní změny se zahodí)\nZrušit = nechat moje a přepsat server',
}

/**
 * Shape every dictionary must satisfy: same keys as the Czech source, with
 * literal string returns widened to `string` so translations can differ.
 */
export type Messages = {
  [K in keyof typeof cs]: (typeof cs)[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string
}
