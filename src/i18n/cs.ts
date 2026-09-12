// Czech dictionary — the source of truth for message keys. Values are either
// plain strings or functions (parametrised / pluralised messages).

/** Czech plural: 1 / 2–4 / 5+ */
const dny = (n: number) => (n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní')
const karty = (n: number) => (n === 1 ? 'karta' : n >= 2 && n <= 4 ? 'karty' : 'karet')
const kartyAcc = (n: number) => (n === 1 ? 'kartu' : n >= 2 && n <= 4 ? 'karty' : 'karet')
const predmety = (n: number) => (n === 1 ? 'předmět' : n >= 2 && n <= 4 ? 'předměty' : 'předmětů')
const stran = (n: number) => (n === 1 ? 'strana' : n >= 2 && n <= 4 ? 'strany' : 'stran')
const chyby = (n: number) => (n === 1 ? 'chyba' : n >= 2 && n <= 4 ? 'chyby' : 'chyb')
const bloku = (n: number) => (n === 1 ? 'blok' : n >= 2 && n <= 4 ? 'bloky' : 'bloků')

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

  // New deck (manual, in-app)
  newDeckBtn: '+ Nový balíček',
  newDeckTitle: 'Nový balíček',
  newDeckHint: 'Vytvoř balíček ručně — kartičky (klidně i s fotkami) přidáš hned v dalším kroku.',
  createDeckBtn: 'Vytvořit a přidat kartičky',

  // Card photos
  photoFrontLabel: 'Fotka k otázce',
  photoBackLabel: 'Fotka k odpovědi',
  addPhoto: '📷 Přidat fotku',
  removePhoto: 'Odebrat fotku',
  photoTooBig: 'Fotka je i po zmenšení příliš velká — zkus menší výřez.',
  photoUnreadable: 'Tenhle soubor se nepodařilo načíst jako obrázek.',
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
  // Podklady → osnova → karty
  navSources: 'Podklady',
  sourcesTitle: 'Podklady',
  sourcesIntro:
    'Nahraj skripta, fotku poznámek nebo vlastní text. Nejdřív z toho vznikne osnova témat, kterou schválíš, a teprve pak karty.',
  sourcesNeedDeck: 'Nejdřív si založ balíček — podklad vždycky patří k nějakému předmětu.',
  sourcesDeckLabel: 'Balíček',
  sourcesUpload: 'Nahrát soubor',
  sourcesUploadHint: 'PDF, text nebo fotka stránky.',
  sourcesPaste: 'Vložit text',
  sourcesPasteHint: 'Zkopíruj text z přednášky nebo ze skript.',
  sourcesUploading: 'Nahrávám…',
  sourcesEmpty: 'Zatím tu nic není.',
  sourcesOffline: 'Bez připojení podklady zpracovat nejde. Učení běží dál.',
  sourceStatusUploaded: 'Nahráno',
  sourceStatusExtracting: 'Čtu podklad…',
  sourceStatusExtracted: (pages: number, blocks: number) =>
    `${pages} ${stran(pages)} · ${blocks} ${bloku(blocks)}`,
  sourceStatusOutlined: 'Osnova připravená',
  sourceStatusGenerating: 'Generuji karty…',
  sourceStatusGenerated: 'Karty připravené',
  sourceStatusDone: 'Hotovo',
  sourceStatusError: 'Nepovedlo se',
  sourceExtract: 'Zpracovat',
  sourceOutlineBtn: 'Navrhnout osnovu',
  sourceOutlineWorking: 'Připravuji osnovu…',
  sourceApprove: 'Schválit a vygenerovat karty',
  sourceGenerating: (done: number, total: number) => `Generuji… ${done} z ${total}`,
  sourceImportBtn: (n: number) => `Přidat ${n} ${kartyAcc(n)} do balíčku`,
  sourceImported: (n: number) => `Přidáno ${n} ${karty(n)}.`,
  sourceReviewBtn: 'Zkontrolovat modelem',
  sourceReviewTitle: 'Nepovinný druhý průchod: model projde hotové karty proti podkladu (stojí navíc)',
  sourceReviewed: (drafts: number) =>
    drafts === 0 ? 'Kontrola hotová, vše prošlo.' : `Kontrola hotová — ${drafts} ${karty(drafts)} k přepsání.`,
  sourceDelete: 'Smazat podklad',
  sourceDeleteConfirm: 'Smazat podklad i s vygenerovanými kartami? Karty už přidané do balíčku zůstanou.',
  sourceEstimate: (usd: string) => `Odhad ceny: ${usd}`,
  sourceSpent: (spent: string, budget: string) => `Tento měsíc utraceno ${spent} z ${budget}`,
  sectionAi: 'Generování karet',
  aiBudgetName: 'Měsíční strop',
  aiBudgetDesc:
    'Kolik smí generování karet za měsíc stát. Po vyčerpání se přepne na pravidlový generátor a řekne to.',
  sourceModelUnavailable: 'Model není k dispozici — poběží pravidlový generátor.',
  sourceModelOff: 'Model není k dispozici — karty vyrobila pravidla.',
  modelOffName: 'Zdarma podle pravidel',
  modelOffDesc:
    'Karty vyrobí vzory v textu — definice, znaky, paragrafy, procesy, letopočty a čísla. Nic to nestojí a funguje to i bez internetu.',
  modelOnName: 'S modelem (platí se)',
  modelOnDesc:
    'Model projde podklad a napíše karty i tam, kde pravidla nestačí. Odhad ceny uvidíš u podkladu předem.',
  sourceReasonChoice: 'zvolil sis pravidla',
  sourceReasonNoKey: 'chybí API klíč',
  sourceReasonBudget: 'vyčerpaný měsíční rozpočet',
  sourceReasonApiError: 'API neodpovědělo',
  sourceReasonOffline: 'bez připojení',
  sourceNeedsModel: 'Fotku bez modelu přečíst neumíme.',
  outlineTitle: 'Osnova ke schválení',
  outlineHint: 'Přejmenuj témata nebo odškrtni ta, která se učit nechceš. Karty vzniknou až potom.',
  outlineTopicMeta: (cards: number, minutes: number) => `${cards} ${karty(cards)} · ${minutes} min`,
  outlineNoneSelected: 'Vyber aspoň jedno téma.',
  draftBadge: 'Koncept',
  draftReasonEmpty: 'prázdná karta',
  draftReasonTooLong: 'odpověď je delší než tři věty',
  draftReasonEcho: 'odpověď je obsažená v otázce',
  draftReasonCloze: 'doplňovačka bez vynechaného místa',
  draftReasonImage: 'chybí obrázek, na který se karta ptá',
  draftReasonDuplicate: 'duplicita',
  draftReasonSource: 'odpověď se v podkladu nenašla',
  draftApproveBtn: 'Použít',
  draftApproveTitle: 'Zařadit kartu do učení tak, jak je',
  filterDrafts: 'Jen koncepty',
  plainHint:
    'Nemusí to být JSON. Vlož klidně vlastní poznámky — „Pojem — význam" na řádek, tabulku z tabulkového editoru, nebo věty s {{vynechávkou}}. Karty z toho uděláme bez modelu.',
  plainDeckName: 'Vložené poznámky',
  errPlainNoCards: 'V textu jsem nenašel dvojice otázka–odpověď. Zkus je oddělit pomlčkou, tabulátorem nebo prázdným řádkem.',
  errUploadFailed: 'Soubor se nepodařilo nahrát.',
  errSourceFailed: 'Podklad se nepodařilo zpracovat.',
  // Učení: kalibrace, vlastní formulace, kroky
  confidenceName: 'Ptát se na jistotu',
  confidenceDesc:
    'Před odkrytím jedním klepnutím řekneš, jak si věříš. Ve statistikách pak vidíš, jak přesně se odhaduješ — a jistá chyba se ti vrátí ještě dnes.',
  confidenceQuestion: 'Jak si věříš?',
  confKnow: 'Vím',
  confUnsure: 'Tuším',
  confNo: 'Nevím',
  produceHint: 'Napiš pár slov vlastními slovy — pak se odpověď ukáže. Vybavování z hlavy drží líp než čtení.',
  producePlaceholder: 'Pár slov stačí…',
  nextStep: (shown: number, total: number) => `Další krok (${shown}/${total})`,
  remainingLeft: (n: number) => `ještě ${n}`,
  hyperHint: 'Byl sis jistý a nevyšlo to — tahle karta se dnes vrátí. Přesně takové chyby se opravují nejlíp.',
  // Slabá místa
  weakTitle: 'Slabá místa',
  weakEmpty: 'Zatím žádné chyby k řešení. 🌿',
  weakTopic: (topic: string, n: number) => `${topic} — ${n}× ${chyby(n)}`,
  weakNoTopic: 'Bez tématu',
  calibTitle: 'Odhad vlastních znalostí',
  calibEmpty: 'Zatím málo dat — po pár dnech učení tu uvidíš, jak přesně se odhaduješ.',
  calibSure: (pct: number) => `Když si věříš, vyjde to v ${pct} %.`,
  calibUnsure: (pct: number) => `Když tušíš, vyjde to v ${pct} %.`,
  calibOverconfident: 'Přeceňuješ se — to je nejčastější důvod, proč lidi u zkoušky překvapí.',
  calibHonest: 'Odhaduješ se poctivě. To je při přípravě k nezaplacení.',
  // Plán
  navPlan: 'Plán',
  planTitle: 'Plán do zkoušek',
  planEmpty: 'Nejdřív si založ balíček a nastav mu termín zkoušky.',
  planAvailableName: 'Kolik času denně mám',
  planAvailableDesc: 'Realisticky, ne jak by to bylo hezké. Plán se počítá proti tomuhle číslu.',
  planFits: (need: number, have: number) => `Vejde se to: potřebuješ ${need} min denně, máš ${have}.`,
  planTight: (need: number, have: number, over: number) =>
    `Nevejde se to: plán chce ${need} min denně, máš ${have} — o ${over} min víc, než je.`,
  planCutIntro: 'Nejmenší škoda — škrtej od nejvzdálenější zkoušky:',
  planCut: (cards: number, subject: string) => `${cards} ${karty(cards)} z předmětu ${subject}`,
  planNotEnough:
    'Ani to nestačí — nejbližší zkouška sama o sobě přeteče den. Buď si přidej čas, nebo z balíčku vyhoď, co u zkoušky nepotřebuješ.',
  planPerDay: (cards: number, minutes: number) => `${cards} nových/den · ~${minutes} min`,
  planRemaining: (n: number) => `zbývá ${n} ${karty(n)}`,
  planIntentionPlaceholder: 'Kdy a kde se tomu budu věnovat?',
  planIntentionHint:
    'Konkrétní věta („V úterý v 19:00 u kuchyňského stolu 25 minut práva") drží líp než dobrý úmysl — a přesně tohle ti přijde v připomínce.',
  // Zeigarnik + nová etapa
  noteToday: (topic: string) => `Dnes jsi skončil u tématu ${topic}. Až budeš mít chvíli, naváž tam.`,
  noteLater: (topic: string) => `Začni tématem ${topic} — tam jsi minule přestal.`,
  noteNoTopic: 'Minule jsi to nedokončil — naváž, kde jsi přestal.',
  freshMonday: 'Pondělí. Dobrý den na to začít novou etapu.',
  freshMonth: 'První den v měsíci — čistý štít, banka volných dní je zase plná.',
  freshAfterExam: 'Zkouška je za tebou. Nastav si termín další a jedeme dál.',
  freshDismiss: 'Díky, vím',
  // Hranice
  overdoingTitle: 'Dost pro dnešek',
  overdoingBody:
    'Dnešní dávku máš dávno za sebou. Přeučení před zkouškou výsledek spíš zhorší — zbytek si nech na zítra.',
  overdoingStop: 'Končím',
  overdoingMore: 'Ještě chvíli',
  examTomorrow: 'Zkouška je za dveřmi — dnes už jen opakování, žádné nové karty.',
  // Slepá mapa (image occlusion)
  newMapBtn: '+ Slepá mapa',
  occlusionTitle: 'Slepá mapa',
  occlusionPick: 'Vyber mapu nebo schéma',
  occlusionHint: 'Táhni prstem přes místo, které chceš zakrýt. Klepnutím na název ho přejmenuješ, křížkem smažeš.',
  occlusionLabelPlaceholder: 'Název místa (Dunaj, Alpy…)',
  occlusionAltLabel: 'Popis obrázku',
  occlusionAltPlaceholder: 'Slepá mapa Rakouska',
  occlusionModeLabel: 'Co se zakrývá',
  occlusionModeOne: 'Jen hledané místo',
  occlusionModeAll: 'Všechna místa',
  occlusionModeOneDesc: 'Zbytek mapy zůstane vidět — poznáváš podle okolí.',
  occlusionModeAllDesc: 'Zakryjí se všechna místa, sousedi nenapoví. Těžší a účinnější.',
  occlusionSave: (n: number) => `Vytvořit ${n} ${karty(n)}`,
  occlusionNeedLabels: 'Pojmenuj aspoň jedno zakryté místo — název je odpověď na kartě.',
  // ---- textbook (reading screen over the study materials) ----
  navReader: 'Učebnice',
  readerTitle: 'Učebnice',
  readerLead: 'Slide, pod ním výklad, pojmy a na konci otázky. Postup se pamatuje.',
  readerLectures: (n: number) => `${n} ${n === 1 ? 'přednáška' : n >= 2 && n <= 4 ? 'přednášky' : 'přednášek'}`,
  readerSlideCount: (n: number) => `${n} ${stran(n)}`,
  readerCardCount: (n: number) => `${n} ${karty(n)}`,
  readerContinue: (n: number) => `Pokračovat u ${n}. strany`,
  readerTerms: (n: number) => `Pojmy (${n})`,
  readerQuestions: (n: number) => `Otázky (${n})`,
  readerCoreOnly: 'jen jádro',
  readerEmpty: 'Na serveru zatím žádné podklady nejsou.',
  readerError: 'Podklady se nepodařilo načíst.',
  readerRead: (done: number, total: number) => `přečteno ${done} / ${total}`,
  readerSlideAlt: (title: string, n: number) => `${title} — strana ${n}`,
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
