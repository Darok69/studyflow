// German dictionary (informal "du"). Keys are enforced against the Czech source dictionary.
import type { Messages } from './cs'

/** German plural: 1 / everything else */
const karten = (n: number) => (n === 1 ? 'Karte' : 'Karten')
const tage = (n: number) => (n === 1 ? 'Tag' : 'Tage')
const tagen = (n: number) => (n === 1 ? 'Tag' : 'Tagen')
const faecher = (n: number) => (n === 1 ? 'Fach' : 'Fächer')

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export const de: Messages = {
  // Common
  locale: 'de-DE',
  loading: 'Lade…',
  back: '← Zurück',
  backPlain: 'Zurück',
  cancel: 'Abbrechen',
  save: 'Speichern',
  saving: 'Speichere…',
  delete: 'Löschen',
  close: 'Schließen',
  edit: 'Bearbeiten',
  copy: 'Kopieren',
  copied: 'Kopiert ✓',
  weekdayShort: (day: number) => WEEKDAYS[day],

  // App shell
  navImport: 'Import',

  // Home
  navCards: 'Karten',
  navStats: 'Statistik',
  navSettings: 'Einstellungen',
  todayPlan: 'Dein Plan für heute',
  toReview: 'zu wiederholen',
  newCount: 'neue',
  estMinutes: (min: number) => `~${min} Min.`,
  nothingTodayLeaf: 'Heute wartet nichts auf dich 🌿',
  studyAll: 'Alles lernen',
  heavyLoad: (n: number, minutes: number) =>
    `Heute ist etwas mehr los (${n} ${karten(n)}, ~${minutes} Min.). Verteil es ruhig über den Tag — du musst nicht alles auf einmal schaffen. 🌱`,
  emptyNothingYet: 'Hier ist noch nichts — und das ist völlig okay.',
  emptyImportHint: 'Importiere dein erstes Deck und wir legen ganz entspannt los.',
  importDeckBtn: 'Deck importieren',

  // Study
  doneHeading: 'Geschafft!',
  doneCram: (n: number) =>
    `Du hast ${n} ${karten(n)} im Probelauf geübt — dein Wiederholungsplan bleibt unberührt. 🌿`,
  doneStudy: (n: number) =>
    `Du hast dir Mühe gegeben — du bist ${n} ${karten(n)} durchgegangen. Gute Arbeit. 🌿`,
  nothingToCram: 'Nichts zum Üben',
  nothingTodayPlain: 'Heute wartet nichts auf dich',
  enjoyBreak: 'Genieß die Pause — wir sehen uns wieder, wann immer du magst.',
  backToOverview: 'Zurück zur Übersicht',
  undoLast: '⌫ Letzte Bewertung zurücknehmen',
  endSession: 'Beenden',
  undoTitle: 'Letzte Bewertung zurücknehmen (Z)',
  undoShort: '⌫ Zurück',
  typeCram: 'Übung',
  typeNew: 'neu',
  typeReview: 'Wiederholung',
  buryBtn: 'Zurückstellen',
  buryTitle: 'Karte heute überspringen — sie kommt morgen wieder',
  suspendBtn: 'Aussetzen',
  suspendTitle: 'Aus den Wiederholungen nehmen (unter „Karten" wieder aktivierbar)',
  cramNote: 'Probelauf — Bewertungen beeinflussen deine geplanten Wiederholungen nicht.',
  breakNudge: (min: number) =>
    `Du lernst schon über ${min} Minuten — wie wär’s mit einer Pause? 🙂`,
  keepGoing: 'Weitermachen',
  leechHint:
    'Diese Karte kommt immer wieder. Oft hilft es, sie umzuformulieren oder in kleinere Karten aufzuteilen.',
  keepCard: 'So lassen',
  verdictCorrect: '✓ Richtig',
  verdictClose: '≈ Fast — schau dir den Unterschied an',
  verdictWrong: 'Anders — kein Problem, genau dafür wiederholen wir',
  yourAnswer: (a: string) => `deine Antwort: „${a}“`,
  answerPlaceholder: 'Schreib deine Antwort…',
  checkAnswer: 'Prüfen',
  skipTypingTitle: 'Tippen überspringen',
  justShow: 'Einfach zeigen',
  showAnswer: 'Antwort zeigen',

  // Rating buttons (Anki convention)
  rateAgain: 'Nochmal',
  rateHard: 'Schwer',
  rateGood: 'Gut',
  rateEasy: 'Einfach',
  intervalShort: (n: number) => (n <= 0 ? 'heute' : n === 1 ? '1 Tag' : `${n} T`),

  // Subject card
  learnedRatio: (studied: number, total: number) => `gelernt ${studied} / ${total}`,
  readinessPillTitle:
    'Schätzung, wie viel du am Prüfungstag noch weißt (FSRS-Vergessenskurve)',
  readinessPercent: (p: number) => `Bereitschaft ${p} %`,
  subjectTodayCounts: (due: number, fresh: number) => `${due} zu wiederholen · ${fresh} neue`,
  doneForToday: 'für heute geschafft',
  cramBtn: 'Üben',
  subjectOpenTitle: 'Antippen, um das heutige Lernen für dieses Fach zu starten',

  // Browser
  filterAll: 'Alle',
  filterNew: 'Neu',
  filterLearning: 'Im Lernen',
  filterSuspended: 'Ausgesetzt',
  filterLeech: 'Knifflig',
  cardsCount: (n: number) => `${n} ${karten(n)}`,
  newCardBtn: '+ Neue Karte',
  searchPlaceholder: 'In Fragen, Antworten und Tags suchen…',
  allSubjects: 'Alle Fächer',
  noCardMatches: 'Keine Karte passt zum Filter.',
  editCardTitle: 'Karte bearbeiten',
  chipSuspended: 'ausgesetzt',
  chipBuried: 'zurückgestellt',
  chipLeech: 'knifflig',
  unburyTitle: 'Zurückgestellte Karte zurück in die heutige Warteschlange holen',
  unburyBtn: 'Zurückholen',
  resumeTitle: 'Zurück in die Wiederholungen',
  suspendTitleShort: 'Aus den Wiederholungen nehmen',
  resumeBtn: 'Fortsetzen',

  // Login
  errTooManyAttempts: 'Zu viele Versuche — probier es gleich noch einmal.',
  errBadCredentials: 'E-Mail oder Zugangscode passt nicht.',
  errServer: 'Der Server war nicht erreichbar — versuch es noch einmal.',
  welcome: 'Willkommen bei StudyFlow',
  introTagline: 'Schlaue Karteikarten fürs Langzeitgedächtnis.',
  introPoint1:
    'Die Wiederholungen plant der FSRS-Algorithmus — du lernst genau dann, wenn du zu vergessen beginnen würdest.',
  introPoint2: 'Prüfungsbereitschaft: du siehst, wie viel % des Stoffs du am Prüfungstag wirklich wüsstest.',
  introPoint3: 'Funktioniert offline als App auf Handy und Computer. Deine Daten bleiben bei dir.',
  inviteOnly:
    'Die App ist nur auf Einladung. Melde dich mit deiner E-Mail und dem Zugangscode an, den du bekommen hast.',
  emailLabel: 'E-Mail',
  accessCodeLabel: 'Zugangscode',
  loggingIn: 'Melde an…',
  loginBtn: 'Anmelden',

  // Import
  importTitle: 'Deck importieren',
  sharedBanner:
    'Jemand hat dir ein Kartendeck geschickt 🎁 — schau dir den Inhalt unten an und bestätige den Import.',
  pasteHint: 'Füge das JSON mit Karten ein oder lade das Beispieldeck.',
  jsonPlaceholder: '{ "subject": "...", "examDate": "JJJJ-MM-TT", "cards": [ ... ] }',
  loadSample: 'Beispieldeck laden',
  importing: 'Importiere…',
  importBtn: 'Importieren',
  aiHeading: 'Deck mit KI erstellen',
  aiHint: 'Kopiere den Prompt in dein liebstes KI-Tool, ergänze das Thema und füge das fertige JSON oben ein.',

  // Deck parsing errors
  errInvalidJson: (msg: string) => `Ungültiges JSON: ${msg}`,
  errRootObject: 'Das Wurzelelement muss ein Deck-Objekt sein.',
  errMissingSubject: 'Der Fachname fehlt ("subject").',
  errExamDateFormat: 'Das Feld "examDate" muss das Format YYYY-MM-DD haben.',
  errCardsArray: 'Das Feld "cards" muss ein Array von Karten sein.',
  errClozeCardNeedsBlank: (n: number) =>
    `Karte #${n}: Ein Lückentext muss mindestens eine {{Lücke}} enthalten.`,
  errBasicCardNeedsBoth: (n: number) =>
    `Karte #${n}: Eine Basiskarte braucht "front" und "back".`,
  errNoUsableCards: 'Das Deck enthält keine verwendbaren Karten.',

  // Backup parsing errors (shown in Settings when a restore fails)
  errBackupNotJson: 'Die Datei ist kein gültiges JSON.',
  errBackupForeign: 'Das sieht nicht wie ein StudyFlow-Backup aus.',
  errBackupNewer: 'Das Backup stammt aus einer neueren Version der App.',
  errBackupMissingData: 'Dem Backup fehlen Daten (subjects / cards / reviews).',
  errBackupCorrupt: 'Das Backup enthält beschädigte Einträge.',

  // Settings
  sectionAccount: 'Konto & Synchronisierung',
  lastSyncAt: (when: string) => `Letzte Synchronisierung: ${when}`,
  notSyncedYet: 'Noch nicht synchronisiert.',
  syncAutoNote:
    'Deine Daten werden automatisch auf dem Server gesichert — auf einem anderen Gerät musst du dich nur anmelden.',
  syncing: 'Synchronisiere…',
  syncNow: 'Jetzt synchronisieren',
  logout: 'Abmelden',
  syncFailed: 'Die Synchronisierung hat nicht geklappt — versuch es noch einmal.',
  reminderName: 'Tägliche Erinnerung',
  reminderDesc:
    'Eine Push-Benachrichtigung mit der Anzahl der Karten, die an dem Tag auf dich warten. Funktioniert auch bei geschlossener App (installiere sie auf deinem Startbildschirm).',
  reminderTimeLabel: 'Erinnerungszeit',
  reminderBlocked: 'Dein Browser hat Benachrichtigungen blockiert — erlaube sie in den Seiteneinstellungen.',
  reminderFailed: 'Die Erinnerungen ließen sich nicht aktivieren — versuch es noch einmal.',
  reminderConfirmNote: 'Direkt nach dem Einschalten kommt eine Bestätigungs-Benachrichtigung — so weißt du, dass es funktioniert.',
  pushTestBtn: 'Test-Benachrichtigung senden',
  pushTestSending: 'Sende…',
  pushTestSent: 'Gesendet — die Benachrichtigung kommt gleich 🔔',
  pushTestFailed: 'Senden fehlgeschlagen — schalte die Erinnerung aus und wieder ein.',
  pushInstallHint:
    'Auf iPhone/iPad funktionieren Benachrichtigungen nur aus der installierten App: in Safari auf Teilen → „Zum Home-Bildschirm“ tippen und StudyFlow von dort öffnen — dann lässt sich die tägliche Erinnerung hier einschalten.',
  sectionLearning: 'Lernen',
  retentionName: 'Ziel-Behaltensquote',
  retentionDesc:
    'Wie viel Prozent der Karten du im Kopf haben willst, wenn sie dran sind. Höherer Wert = häufigere Wiederholungen; 90 % ist ein vernünftiger Standard.',
  previewsName: 'Intervall-Vorschau',
  previewsDesc: 'Auf den Bewertungs-Buttons siehst du, wann die Karte wiederkommt (wie in Anki).',
  typedName: 'Getippte Antworten',
  typedDesc:
    'Bei kurzen Antworten tippst du zuerst, was du denkst — aktives Abrufen ist die stärkste Form des Lernens. Tippfehler und Sonderzeichen werden verziehen.',
  sectionPace: 'Tempo & Wohlbefinden',
  capName: 'Tageslimit für neue Karten',
  capDesc:
    'Ein ruhigeres Tempo vor der Prüfung — neue Karten verteilen sich auf mehrere Tage statt auf eine große Sitzung. Wiederholungen werden nie begrenzt.',
  capMaxLabel: 'Max. neue Karten pro Tag',
  breakAfterLabel: 'Pause vorschlagen nach (Min.)',
  sectionAppearance: 'Kartendarstellung',
  fontSizeName: 'Schriftgröße',
  fontSmaller: 'Kleiner',
  fontNormal: 'Normal',
  fontLarger: 'Größer',
  sansName: 'Serifenlose Schrift',
  sansDesc:
    'Karten werden standardmäßig in einer Serifenschrift (Buchschrift) angezeigt. Wenn dir serifenlos besser liegt, schalte um.',
  sectionLanguage: 'Jazyk / Language / Sprache',
  sectionData: 'Daten',
  dataDesc:
    'Alles wird nur in diesem Browser gespeichert (offline). Ein Backup überträgt Fächer, Karten und die ganze Lernhistorie auf ein anderes Gerät.',
  downloadBackup: 'Backup herunterladen',
  restoreFromBackup: 'Aus Backup wiederherstellen',
  deleteAllData: 'Alle Daten löschen',
  confirmDeleteAll: 'Wirklich alle Daten löschen (Fächer, Karten und Historie)?',
  confirmRestore: (nSubjects: number, nCards: number) =>
    `Alle aktuellen Daten durch das Backup ersetzen (${nSubjects} ${faecher(nSubjects)}, ${nCards} ${karten(nCards)})?`,
  backupFileName: (date: string) => `studyflow-sicherung-${date}.json`,

  // Admin users
  adminSection: 'Zugänge (Admin)',
  adminDesc:
    'Wer hier steht, kann sich anmelden. Neue Nutzer bekommen einen Zugangscode — er wird nur einmal angezeigt, schick ihn z. B. per WhatsApp.',
  loadUsersFailed: 'Die Nutzer konnten nicht geladen werden.',
  emailExists: 'Diese E-Mail hat schon Zugang.',
  invalidEmail: 'Das sieht nicht wie eine E-Mail aus.',
  addFailed: 'Das Hinzufügen hat nicht geklappt — versuch es noch einmal.',
  confirmNewCode: (email: string) =>
    `Neuen Code für ${email} erzeugen? Der alte wird ungültig und die Person wird abgemeldet.`,
  confirmRemoveUser: (email: string) =>
    `Zugang für ${email} entfernen? Auch das Backup auf dem Server wird gelöscht.`,
  issuedMessage: (email: string, code: string) =>
    `StudyFlow → https://study.dmarka.eu\nE-Mail: ${email}\nZugangscode: ${code}`,
  addBtn: 'Hinzufügen',
  codeShownOnce: 'Der Code wird nicht noch einmal angezeigt — kopiere und verschicke ihn jetzt.',
  copyMessage: 'Nachricht kopieren',
  lastLoginAt: (when: string) => `zuletzt ${when}`,
  notLoggedInYet: 'noch nicht angemeldet',
  newCodeBtn: 'Neuer Code',
  removeBtn: 'Entfernen',
  adminEmailPlaceholder: 'freund@email.de',

  // Card editor
  errSelectSubject: 'Wähle ein Fach.',
  errClozeNeedsBlank: 'Ein Lückentext muss mindestens eine {{Lücke}} enthalten.',
  errBasicNeedsBoth: 'Eine Basiskarte braucht Frage und Antwort.',
  confirmDeleteCard: 'Diese Karte samt ihrer Historie löschen?',
  newCardTitle: 'Neue Karte',
  subjectLabel: 'Fach',
  cardTypeLabel: 'Kartentyp',
  typeBasic: 'Basis',
  typeCloze: 'Lückentext',
  frontLabel: 'Vorderseite (Frage)',
  backLabel: 'Rückseite (Antwort)',
  clozeFieldLabel: 'Text mit {{ausgelassenen}} Wörtern — jedes {{...}} wird zur Lücke',
  clozePlaceholder: 'Die Zwölftafeln stammen aus dem Jahr {{451 v. Chr.}}.',
  tagsLabel: 'Tags (durch Komma getrennt)',

  // Subject editor
  errSubjectNeedsName: 'Das Fach braucht einen Namen.',
  confirmDeleteSubject: (name: string) => `Das Fach „${name}“ und alle seine Karten löschen?`,
  editSubjectTitle: 'Fach bearbeiten',
  nameLabel: 'Name',
  examDateLabel: 'Prüfungsdatum',
  reminderLabel: 'Erinnerung',
  dailyNewLabel: 'Neue Karten pro Tag',
  dailyNewAuto: 'auto',
  dailyNewHint: 'Leer = automatisch nach Prüfungstermin. 0 = keine neuen Karten.',
  subjectColorLabel: 'Fachfarbe',
  colorN: (n: number) => `Farbe ${n}`,
  shareTooBig: 'Das Deck ist zu groß für einen Link — nutze Exportieren und schick die Datei.',
  exportBtn: 'Exportieren',

  // New deck (manual, in-app)
  newDeckBtn: '+ Neues Deck',
  newDeckTitle: 'Neues Deck',
  newDeckHint: 'Erstelle ein Deck von Hand — Karten (gern mit Fotos) fügst du gleich im nächsten Schritt hinzu.',
  createDeckBtn: 'Erstellen & Karten hinzufügen',

  // Card photos
  photoFrontLabel: 'Foto zur Frage',
  photoBackLabel: 'Foto zur Antwort',
  addPhoto: '\U0001F4F7 Foto hinzufügen',
  removePhoto: 'Foto entfernen',
  photoTooBig: 'Das Foto ist auch nach dem Verkleinern zu groß — versuch einen kleineren Ausschnitt.',
  photoUnreadable: 'Diese Datei ließ sich nicht als Bild laden.',
  linkCopied: 'Link kopiert ✓',
  shareLink: 'Per Link teilen',

  // Stats
  statsTitle: 'Dein Fortschritt',
  daysInRow: (n: number) => (n === 1 ? 'Tag in Folge' : 'Tage in Folge'),
  reviewsPer7: 'Wiederholungen / 7 Tage',
  learnedCardsLabel: 'gelernte Karten',
  last7Days: 'Letzte 7 Tage',
  upcoming14: 'Was dich erwartet (14 Tage)',
  forecastNote:
    'Geplante Wiederholungen Tag für Tag — neue Karten kommen je nach Prüfungsterminen separat dazu.',
  forecastSparkLabel: 'Geplante Wiederholungen für die nächsten 14 Tage',
  last12Weeks: 'Letzte 12 Wochen',
  readinessSection: 'Prüfungsbereitschaft',
  readinessNote:
    'Eine Schätzung aus der Vergessenskurve (FSRS): wie viel du am Prüfungstag noch wüsstest, wenn du ab heute nicht mehr lernst. Sie wächst mit jeder Wiederholung.',
  statsKeepGoing: 'Beständigkeit schlägt Leistung. Mach schön weiter. 🌿',
  statsFreshStart: 'Jeder Tag ist ein neuer Anfang — komm gern heute zurück. 🌱',
  sparklineLabel: 'Wiederholungen der letzten 7 Tage',
  heatmapLabel: 'Wiederholungsaktivität der letzten Wochen',

  // Dates / countdowns
  countdownNone: 'kein Termin',
  countdownToday: 'heute',
  countdownTomorrow: 'morgen',
  countdownIn: (n: number) => `in ${n} ${tagen(n)}`,
  countdownOverdue: (n: number) => `${n} ${tage(n)} nach dem Termin`,

  // Encouragement (never punitive)
  encStart: 'Fang ruhig mit einer Karte an — ein paar Minuten reichen. 🌱',
  encDoneToday: 'Für heute bist du fertig — gute Arbeit. 🌿',
  encNothingWaiting: 'Für heute wartet nichts. Genieß die Pause. 🌿',
  encMissed: 'Gestern hast du ausgesetzt — macht nichts, weiter geht’s.',
  encStreak: (n: number) =>
    `Du hast eine Serie von ${n} ${tagen(n)} — schön Schritt für Schritt. ✨`,

  // Sync conflict
  syncConflict:
    'Auf dem Server sind neuere Daten (von einem anderen Gerät), aber auch hier hast du ungespeicherte Änderungen.\n\nOK = Daten vom Server laden (lokale Änderungen gehen verloren)\nAbbrechen = meine behalten und den Server überschreiben',

  // Unterlagen → Gliederung → Karten
  navSources: 'Unterlagen',
  sourcesTitle: 'Unterlagen',
  sourcesIntro:
    'Lade ein Skript, ein Foto deiner Notizen oder eigenen Text hoch. Zuerst entsteht eine Gliederung zum Bestätigen, erst danach die Karten.',
  sourcesNeedDeck: 'Lege zuerst ein Deck an — Unterlagen gehören immer zu einem Fach.',
  sourcesDeckLabel: 'Deck',
  sourcesUpload: 'Datei hochladen',
  sourcesUploadHint: 'PDF, Text oder ein Foto der Seite.',
  sourcesPaste: 'Text einfügen',
  sourcesPasteHint: 'Kopiere den Text aus der Vorlesung oder dem Skript.',
  sourcesUploading: 'Lade hoch…',
  sourcesEmpty: 'Hier ist noch nichts.',
  sourcesOffline: 'Ohne Verbindung lassen sich Unterlagen nicht verarbeiten. Das Lernen läuft weiter.',
  sourceStatusUploaded: 'Hochgeladen',
  sourceStatusExtracting: 'Lese die Unterlage…',
  sourceStatusExtracted: (pages: number, blocks: number) =>
    `${pages} ${pages === 1 ? 'Seite' : 'Seiten'} · ${blocks} ${blocks === 1 ? 'Block' : 'Blöcke'}`,
  sourceStatusOutlined: 'Gliederung bereit',
  sourceStatusGenerating: 'Erstelle Karten…',
  sourceStatusGenerated: 'Karten bereit',
  sourceStatusDone: 'Fertig',
  sourceStatusError: 'Fehlgeschlagen',
  sourceExtract: 'Verarbeiten',
  sourceOutlineBtn: 'Gliederung vorschlagen',
  sourceOutlineWorking: 'Bereite die Gliederung vor…',
  sourceApprove: 'Bestätigen und Karten erstellen',
  sourceGenerating: (done: number, total: number) => `Erstelle… ${done} von ${total}`,
  sourceImportBtn: (n: number) => `${n} ${n === 1 ? 'Karte' : 'Karten'} zum Deck hinzufügen`,
  sourceImported: (n: number) => `${n} ${n === 1 ? 'Karte' : 'Karten'} hinzugefügt.`,
  sourceReviewBtn: 'Mit dem Modell prüfen',
  sourceReviewTitle: 'Optionaler zweiter Durchgang: das Modell prüft die fertigen Karten gegen die Unterlage (kostet extra)',
  sourceReviewed: (drafts: number) =>
    drafts === 0 ? 'Prüfung fertig, alles bestanden.' : `Prüfung fertig — ${drafts} ${drafts === 1 ? 'Karte' : 'Karten'} zu überarbeiten.`,
  sourceDelete: 'Unterlage löschen',
  sourceDeleteConfirm:
    'Unterlage samt erzeugten Karten löschen? Bereits ins Deck übernommene Karten bleiben.',
  sourceEstimate: (usd: string) => `Geschätzte Kosten: ${usd}`,
  sourceSpent: (spent: string, budget: string) => `Diesen Monat ausgegeben: ${spent} von ${budget}`,
  sectionAi: 'Kartenerstellung',
  aiBudgetName: 'Monatslimit',
  aiBudgetDesc:
    'Wie viel die Kartenerstellung pro Monat kosten darf. Ist es aufgebraucht, übernimmt der regelbasierte Generator — und sagt es.',
  sourceModelUnavailable: 'Kein Modell verfügbar — es läuft der regelbasierte Generator.',
  sourceModelOff: 'Kein Modell verfügbar — die Karten stammen aus Regeln.',
  modelOffName: 'Kostenlos, nach Regeln',
  modelOffDesc:
    'Karten entstehen aus Mustern im Text — Definitionen, Merkmale, Paragrafen, Prozesse, Jahreszahlen und Zahlen. Kostet nichts und geht offline.',
  modelOnName: 'Mit Modell (kostenpflichtig)',
  modelOnDesc:
    'Das Modell liest die Unterlage und schreibt Karten auch dort, wo Regeln nicht reichen. Die Schätzung steht vorher an der Unterlage.',
  sourceReasonChoice: 'du hast die Regeln gewählt',
  sourceReasonNoKey: 'kein API-Schlüssel',
  sourceReasonBudget: 'Monatsbudget aufgebraucht',
  sourceReasonApiError: 'die API hat nicht geantwortet',
  sourceReasonOffline: 'offline',
  sourceNeedsModel: 'Ein Foto lässt sich ohne Modell nicht lesen.',
  outlineTitle: 'Gliederung zum Bestätigen',
  outlineHint: 'Benenne Themen um oder hake ab, was du nicht lernen willst. Die Karten kommen danach.',
  outlineTopicMeta: (cards: number, minutes: number) =>
    `${cards} ${cards === 1 ? 'Karte' : 'Karten'} · ${minutes} Min.`,
  outlineNoneSelected: 'Wähle mindestens ein Thema.',
  draftBadge: 'Entwurf',
  draftReasonEmpty: 'leere Karte',
  draftReasonTooLong: 'die Antwort ist länger als drei Sätze',
  draftReasonEcho: 'die Antwort steht schon in der Frage',
  draftReasonCloze: 'Lückentext ohne Lücke',
  draftReasonImage: 'das Bild, nach dem die Karte fragt, fehlt',
  draftReasonDuplicate: 'Dublette',
  draftReasonSource: 'die Antwort stand nicht in der Unterlage',
  draftApproveBtn: 'Übernehmen',
  draftApproveTitle: 'Die Karte so ins Lernen übernehmen',
  filterDrafts: 'Nur Entwürfe',
  plainHint:
    'Es muss kein JSON sein. Füg deine eigenen Notizen ein — „Begriff — Bedeutung" pro Zeile, eine Tabelle aus der Tabellenkalkulation oder Sätze mit einer {{Lücke}}. Karten entstehen daraus ohne Modell.',
  plainDeckName: 'Eingefügte Notizen',
  errPlainNoCards: 'Ich habe keine Frage-Antwort-Paare gefunden. Trenne sie mit Gedankenstrich, Tabulator oder Leerzeile.',
  errUploadFailed: 'Die Datei konnte nicht hochgeladen werden.',
  errSourceFailed: 'Die Unterlage konnte nicht verarbeitet werden.',
  // Lernen: Kalibrierung, eigene Worte, Schritte
  confidenceName: 'Nach der Sicherheit fragen',
  confidenceDesc:
    'Ein Tipp vor dem Aufdecken. In der Statistik siehst du dann, wie gut du dich einschätzt — und ein sicherer Fehler kommt noch heute zurück.',
  confidenceQuestion: 'Wie sicher bist du?',
  confKnow: 'Weiß ich',
  confUnsure: 'Ahnung',
  confNo: 'Keine Ahnung',
  produceHint: 'Schreib ein paar Worte in eigenen Worten — dann kommt die Antwort. Abrufen schlägt Nachlesen.',
  producePlaceholder: 'Ein paar Worte reichen…',
  nextStep: (shown: number, total: number) => `Nächster Schritt (${shown}/${total})`,
  remainingLeft: (n: number) => `noch ${n}`,
  hyperHint: 'Du warst sicher und es ging daneben — diese Karte kommt heute wieder. Genau solche Fehler sitzen danach am besten.',
  // Schwachstellen
  weakTitle: 'Schwachstellen',
  weakEmpty: 'Noch keine Fehler zum Aufarbeiten. 🌿',
  weakTopic: (topic: string, n: number) => `${topic} — ${n} ${n === 1 ? 'Fehler' : 'Fehler'}`,
  weakNoTopic: 'Ohne Thema',
  calibTitle: 'Selbsteinschätzung',
  calibEmpty: 'Noch zu wenig Daten — nach ein paar Lerntagen siehst du hier, wie gut du dich einschätzt.',
  calibSure: (pct: number) => `Wenn du sicher bist, stimmt es zu ${pct} %.`,
  calibUnsure: (pct: number) => `Wenn du ahnst, stimmt es zu ${pct} %.`,
  calibOverconfident: 'Du überschätzt dich — der häufigste Grund, warum Prüfungen überraschen.',
  calibHonest: 'Du schätzt dich ehrlich ein. Das ist in der Vorbereitung viel wert.',
  // Plan
  navPlan: 'Plan',
  planTitle: 'Plan bis zu den Prüfungen',
  planEmpty: 'Lege zuerst ein Deck an und gib ihm einen Prüfungstermin.',
  planAvailableName: 'Zeit, die ich täglich habe',
  planAvailableDesc: 'Realistisch, nicht schöngerechnet. Der Plan misst sich an dieser Zahl.',
  planFits: (need: number, have: number) => `Es passt: du brauchst ${need} Min. täglich und hast ${have}.`,
  planTight: (need: number, have: number, over: number) =>
    `Es passt nicht: der Plan will ${need} Min. täglich, du hast ${have} — ${over} Min. zu viel.`,
  planCutIntro: 'Geringster Schaden — streiche bei der fernsten Prüfung zuerst:',
  planCut: (cards: number, subject: string) => `${cards} ${cards === 1 ? 'Karte' : 'Karten'} aus ${subject}`,
  planNotEnough:
    'Auch das reicht nicht — die nächste Prüfung sprengt den Tag allein. Entweder mehr Zeit einplanen oder aus dem Deck streichen, was die Prüfung nicht braucht.',
  planPerDay: (cards: number, minutes: number) => `${cards} neue/Tag · ~${minutes} Min.`,
  planRemaining: (n: number) => `noch ${n}`,
  planIntentionPlaceholder: 'Wann und wo mache ich das?',
  planIntentionHint:
    'Ein konkreter Satz („Dienstag 19:00, Küchentisch, 25 Minuten Recht") trägt weiter als guter Wille — und genau das steht in deiner Erinnerung.',
  // Zeigarnik + Neuanfang
  noteToday: (topic: string) => `Heute hast du bei ${topic} aufgehört. Knüpf dort an, wenn du Zeit hast.`,
  noteLater: (topic: string) => `Fang mit ${topic} an — dort hast du aufgehört.`,
  noteNoTopic: 'Letztes Mal nicht fertig geworden — mach dort weiter, wo du aufgehört hast.',
  freshMonday: 'Montag. Ein guter Tag für einen neuen Abschnitt.',
  freshMonth: 'Erster des Monats — reiner Tisch, die Freitage sind wieder voll.',
  freshAfterExam: 'Die Prüfung ist geschafft. Setz den nächsten Termin und weiter geht’s.',
  freshDismiss: 'Danke, weiß ich',
  // Grenzen
  overdoingTitle: 'Genug für heute',
  overdoingBody:
    'Du bist weit über dem heutigen Pensum. Überlernen vor der Prüfung verschlechtert das Ergebnis eher — lass den Rest für morgen.',
  overdoingStop: 'Ich höre auf',
  overdoingMore: 'Noch kurz',
  examTomorrow: 'Die Prüfung steht vor der Tür — heute nur Wiederholung, keine neuen Karten.',
  // Stumme Karte (Image Occlusion)
  newMapBtn: '+ Stumme Karte',
  occlusionTitle: 'Stumme Karte',
  occlusionPick: 'Karte oder Schema wählen',
  occlusionHint: 'Zieh mit dem Finger über die Stelle, die verdeckt werden soll. Tippe den Namen zum Umbenennen, das Kreuz zum Löschen.',
  occlusionLabelPlaceholder: 'Name des Ortes (Donau, Alpen…)',
  occlusionAltLabel: 'Bildbeschreibung',
  occlusionAltPlaceholder: 'Stumme Karte von Österreich',
  occlusionModeLabel: 'Was verdeckt wird',
  occlusionModeOne: 'Nur der gefragte Ort',
  occlusionModeAll: 'Alle Orte',
  occlusionModeOneDesc: 'Der Rest der Karte bleibt sichtbar — du erkennst es an der Umgebung.',
  occlusionModeAllDesc: 'Alles ist verdeckt, die Nachbarn verraten nichts. Schwerer und wirksamer.',
  occlusionSave: (n: number) => `${n} ${n === 1 ? 'Karte' : 'Karten'} erstellen`,
  occlusionNeedLabels: 'Benenne mindestens einen verdeckten Ort — der Name ist die Antwort auf der Karte.',
}
