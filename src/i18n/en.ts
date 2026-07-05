// English dictionary. Keys are enforced against the Czech source dictionary.
import type { Messages } from './cs'

/** English plural: 1 / everything else */
const cards = (n: number) => (n === 1 ? 'card' : 'cards')
const days = (n: number) => (n === 1 ? 'day' : 'days')
const subjects = (n: number) => (n === 1 ? 'subject' : 'subjects')

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const en: Messages = {
  // Common
  locale: 'en-GB',
  loading: 'Loading…',
  back: '← Back',
  backPlain: 'Back',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  delete: 'Delete',
  close: 'Close',
  edit: 'Edit',
  copy: 'Copy',
  copied: 'Copied ✓',
  weekdayShort: (day: number) => WEEKDAYS[day],

  // App shell
  navImport: 'Import',

  // Home
  navCards: 'Cards',
  navStats: 'Stats',
  navSettings: 'Settings',
  todayPlan: 'Today’s plan',
  toReview: 'to review',
  newCount: 'new',
  estMinutes: (min: number) => `~${min} min`,
  nothingTodayLeaf: 'Nothing waiting today 🌿',
  studyAll: 'Study all',
  heavyLoad: (n: number, minutes: number) =>
    `Today’s a bigger day (${n} ${cards(n)}, ~${minutes} min). Feel free to spread it out — no need to do it all at once. 🌱`,
  emptyNothingYet: 'Nothing here yet — and that’s perfectly fine.',
  emptyImportHint: 'Import your first deck and we can start at an easy pace.',
  importDeckBtn: 'Import a deck',

  // Study
  doneHeading: 'Done!',
  doneCram: (n: number) =>
    `You practised ${n} ${cards(n)} in a practice run — your review plan stayed untouched. 🌿`,
  doneStudy: (n: number) =>
    `You put in the care — you went through ${n} ${cards(n)}. Nice work. 🌿`,
  nothingToCram: 'Nothing to practise',
  nothingTodayPlain: 'Nothing waiting today',
  enjoyBreak: 'Enjoy the break — see you again whenever you like.',
  backToOverview: 'Back to overview',
  undoLast: '⌫ Undo last rating',
  endSession: 'End',
  undoTitle: 'Undo last rating (Z)',
  undoShort: '⌫ Undo',
  typeCram: 'practice',
  typeNew: 'new',
  typeReview: 'review',
  buryBtn: 'Postpone',
  buryTitle: 'Skip this card today — it comes back tomorrow',
  suspendBtn: 'Suspend',
  suspendTitle: 'Remove from reviews (restore it in Cards)',
  cramNote: 'Practice run — ratings won’t affect your scheduled reviews.',
  breakNudge: (min: number) =>
    `You’ve been studying for over ${min} minutes — how about a break? 🙂`,
  keepGoing: 'Keep going',
  leechHint:
    'This card keeps coming back. Rephrasing it or splitting it into smaller ones often helps.',
  keepCard: 'Keep',
  verdictCorrect: '✓ Correct',
  verdictClose: '≈ Almost — take a look at the difference',
  verdictWrong: 'Not quite — no worries, that’s what reviewing is for',
  yourAnswer: (a: string) => `your answer: “${a}”`,
  answerPlaceholder: 'Type your answer…',
  checkAnswer: 'Check',
  skipTypingTitle: 'Skip typing',
  justShow: 'Just show it',
  showAnswer: 'Show answer',

  // Rating buttons (Anki convention)
  rateAgain: 'Again',
  rateHard: 'Hard',
  rateGood: 'Good',
  rateEasy: 'Easy',
  intervalShort: (n: number) => (n <= 0 ? 'today' : n === 1 ? '1 day' : `${n} d`),

  // Subject card
  learnedRatio: (studied: number, total: number) => `learned ${studied} / ${total}`,
  readinessPillTitle:
    'An estimate of how much you’ll remember on exam day (FSRS forgetting curve)',
  readinessPercent: (p: number) => `readiness ${p} %`,
  subjectTodayCounts: (due: number, fresh: number) => `${due} to review · ${fresh} new`,
  doneForToday: 'done for today',
  cramBtn: 'Practise',

  // Browser
  filterAll: 'All',
  filterNew: 'New',
  filterLearning: 'Learning',
  filterSuspended: 'Suspended',
  filterLeech: 'Tricky',
  cardsCount: (n: number) => `${n} ${cards(n)}`,
  newCardBtn: '+ New card',
  searchPlaceholder: 'Search questions, answers and tags…',
  allSubjects: 'All subjects',
  noCardMatches: 'No card matches the filter.',
  editCardTitle: 'Edit card',
  chipSuspended: 'suspended',
  chipBuried: 'postponed',
  chipLeech: 'tricky',
  unburyTitle: 'Bring the postponed card back into today’s queue',
  unburyBtn: 'Bring back',
  resumeTitle: 'Return to reviews',
  suspendTitleShort: 'Remove from reviews',
  resumeBtn: 'Resume',

  // Login
  errTooManyAttempts: 'Too many attempts — try again in a moment.',
  errBadCredentials: 'The e-mail or access code doesn’t match.',
  errServer: 'Couldn’t reach the server — try again.',
  welcome: 'Welcome to StudyFlow',
  inviteOnly: 'The app is invite-only. Log in with your e-mail and the access code you received.',
  emailLabel: 'E-mail',
  accessCodeLabel: 'Access code',
  loggingIn: 'Logging in…',
  loginBtn: 'Log in',

  // Import
  importTitle: 'Import a deck',
  sharedBanner: 'Someone sent you a deck of cards 🎁 — check the contents below and confirm the import.',
  pasteHint: 'Paste deck JSON, or load the sample deck.',
  jsonPlaceholder: '{ "subject": "...", "examDate": "YYYY-MM-DD", "cards": [ ... ] }',
  loadSample: 'Load sample deck',
  importing: 'Importing…',
  importBtn: 'Import',
  aiHeading: 'Generate a deck with AI',
  aiHint: 'Copy the prompt into your favourite AI tool, fill in the topic and paste the resulting JSON above.',

  // Deck parsing errors
  errInvalidJson: (msg: string) => `Invalid JSON: ${msg}`,
  errRootObject: 'The root element must be a deck object.',
  errMissingSubject: 'Missing subject name ("subject").',
  errExamDateFormat: 'The "examDate" field must use the YYYY-MM-DD format.',
  errCardsArray: 'The "cards" field must be an array of cards.',
  errClozeCardNeedsBlank: (n: number) =>
    `Card #${n}: a cloze must contain at least one {{blanked word}}.`,
  errBasicCardNeedsBoth: (n: number) => `Card #${n}: a basic card needs both "front" and "back".`,
  errNoUsableCards: 'The deck contains no usable cards.',

  // Backup parsing errors (shown in Settings when a restore fails)
  errBackupNotJson: 'The file is not valid JSON.',
  errBackupForeign: 'This doesn’t look like a StudyFlow backup.',
  errBackupNewer: 'The backup comes from a newer version of the app.',
  errBackupMissingData: 'The backup is missing data (subjects / cards / reviews).',
  errBackupCorrupt: 'The backup contains corrupted records.',

  // Settings
  sectionAccount: 'Account & sync',
  lastSyncAt: (when: string) => `Last sync: ${when}`,
  notSyncedYet: 'Not synced yet.',
  syncAutoNote: 'Your data is backed up to the server automatically — just log in on another device.',
  syncing: 'Syncing…',
  syncNow: 'Sync now',
  logout: 'Log out',
  syncFailed: 'Sync didn’t go through — try again.',
  reminderName: 'Daily reminder',
  reminderDesc:
    'A push notification with the number of cards waiting for you that day. Works even when the app is closed (install it to your home screen).',
  reminderTimeLabel: 'Reminder time',
  reminderBlocked: 'Your browser blocked notifications — allow them in the site settings.',
  reminderFailed: 'Couldn’t turn on reminders — try again.',
  sectionLearning: 'Learning',
  retentionName: 'Target retention',
  retentionDesc:
    'What percentage of cards you want to have in your head when they come up. Higher value = more frequent reviews; 90 % is a sensible default.',
  previewsName: 'Interval previews',
  previewsDesc: 'The rating buttons show how soon the card will come back (like in Anki).',
  typedName: 'Typed answers',
  typedDesc:
    'For short answers you first type what you think — active recall is the strongest form of learning. Typos and diacritics are forgiven.',
  sectionPace: 'Pace & wellbeing',
  capName: 'Daily cap on new cards',
  capDesc:
    'A calmer pace before the exam — new cards are spread across more days instead of one big session. Reviews are never capped.',
  capMaxLabel: 'Max. new cards per day',
  breakAfterLabel: 'Suggest a break after (min)',
  sectionAppearance: 'Card appearance',
  fontSizeName: 'Font size',
  fontSmaller: 'Smaller',
  fontNormal: 'Normal',
  fontLarger: 'Larger',
  sansName: 'Sans-serif font',
  sansDesc:
    'Cards use a serif (book-style) font by default. If sans-serif suits you better, switch it on.',
  sectionLanguage: 'Jazyk / Language / Sprache',
  sectionData: 'Data',
  dataDesc:
    'Everything is stored only in this browser (offline). A backup carries your subjects, cards and full learning history to another device.',
  downloadBackup: 'Download backup',
  restoreFromBackup: 'Restore from backup',
  deleteAllData: 'Delete all data',
  confirmDeleteAll: 'Really delete all data (subjects, cards and history)?',
  confirmRestore: (nSubjects: number, nCards: number) =>
    `Replace all current data with the backup (${nSubjects} ${subjects(nSubjects)}, ${nCards} ${cards(nCards)})?`,
  backupFileName: (date: string) => `studyflow-backup-${date}.json`,

  // Admin users
  adminSection: 'Access (admin)',
  adminDesc:
    'Anyone listed here can log in. A new user gets an access code — it’s shown only once, so send it to them e.g. via WhatsApp.',
  loadUsersFailed: 'Couldn’t load the users.',
  emailExists: 'This e-mail already has access.',
  invalidEmail: 'That doesn’t look like an e-mail.',
  addFailed: 'Adding didn’t go through — try again.',
  confirmNewCode: (email: string) =>
    `Generate a new code for ${email}? The old one stops working and they’ll be logged out.`,
  confirmRemoveUser: (email: string) =>
    `Remove access for ${email}? Their backup on the server will be deleted too.`,
  issuedMessage: (email: string, code: string) =>
    `StudyFlow → https://study.dmarka.eu\nE-mail: ${email}\nAccess code: ${code}`,
  addBtn: 'Add',
  codeShownOnce: 'The code won’t be shown again — copy and send it now.',
  copyMessage: 'Copy message',
  lastLoginAt: (when: string) => `last seen ${when}`,
  notLoggedInYet: 'not logged in yet',
  newCodeBtn: 'New code',
  removeBtn: 'Remove',
  adminEmailPlaceholder: 'friend@email.com',

  // Card editor
  errSelectSubject: 'Pick a subject.',
  errClozeNeedsBlank: 'A cloze card must contain at least one {{blanked word}}.',
  errBasicNeedsBoth: 'A basic card needs both a question and an answer.',
  confirmDeleteCard: 'Delete this card along with its history?',
  newCardTitle: 'New card',
  subjectLabel: 'Subject',
  cardTypeLabel: 'Card type',
  typeBasic: 'Basic',
  typeCloze: 'Cloze',
  frontLabel: 'Front (question)',
  backLabel: 'Back (answer)',
  clozeFieldLabel: 'Text with {{blanked}} words — each {{...}} becomes a blank',
  clozePlaceholder: 'The Twelve Tables date from {{451 BC}}.',
  tagsLabel: 'Tags (comma-separated)',

  // Subject editor
  errSubjectNeedsName: 'The subject needs a name.',
  confirmDeleteSubject: (name: string) => `Delete the subject “${name}” and all its cards?`,
  editSubjectTitle: 'Edit subject',
  nameLabel: 'Name',
  examDateLabel: 'Exam date',
  reminderLabel: 'Reminder',
  subjectColorLabel: 'Subject colour',
  colorN: (n: number) => `Colour ${n}`,
  shareTooBig: 'The deck is too big for a link — use Export and send the file instead.',
  exportBtn: 'Export',
  linkCopied: 'Link copied ✓',
  shareLink: 'Share via link',

  // Stats
  statsTitle: 'Your progress',
  daysInRow: (n: number) => (n === 1 ? 'day in a row' : 'days in a row'),
  reviewsPer7: 'reviews / 7 days',
  learnedCardsLabel: 'cards learned',
  last7Days: 'Last 7 days',
  upcoming14: 'What’s ahead (14 days)',
  forecastNote:
    'Scheduled reviews day by day — new cards are added separately based on your exam dates.',
  forecastSparkLabel: 'Scheduled reviews for the next 14 days',
  last12Weeks: 'Last 12 weeks',
  readinessSection: 'Exam readiness',
  readinessNote:
    'An estimate from the forgetting curve (FSRS): how much you’d remember on exam day if you stopped studying today. It grows with every review.',
  statsKeepGoing: 'Consistency beats intensity. Keep it up. 🌿',
  statsFreshStart: 'Every day is a fresh start — feel free to come back today. 🌱',
  sparklineLabel: 'Reviews over the last 7 days',
  heatmapLabel: 'Review activity in recent weeks',

  // Dates / countdowns
  countdownNone: 'no deadline',
  countdownToday: 'today',
  countdownTomorrow: 'tomorrow',
  countdownIn: (n: number) => `in ${n} ${days(n)}`,
  countdownOverdue: (n: number) => `${n} ${days(n)} past the deadline`,

  // Encouragement (never punitive)
  encStart: 'Start with just one card — a few minutes is plenty. 🌱',
  encDoneToday: 'Today is done — nice work. 🌿',
  encNothingWaiting: 'Nothing waiting today. Enjoy the break. 🌿',
  encMissed: 'You skipped yesterday — no worries, onwards we go.',
  encStreak: (n: number) => `You’re on a streak of ${n} ${days(n)} — one step at a time. ✨`,

  // Sync conflict
  syncConflict:
    'The server has newer data (from another device), but you also have unsaved changes here.\n\nOK = load the server data (local changes are discarded)\nCancel = keep mine and overwrite the server',
}
