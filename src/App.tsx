import { lazy, Suspense, useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Study, type StudyMode } from './pages/Study'
import { Login } from './pages/Login'
// Secondary screens load on demand — keeps the startup bundle (login → home →
// study) small; the PWA precache still makes the chunks instant when offline.
const Import = lazy(() => import('./pages/Import').then((m) => ({ default: m.Import })))
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Browser = lazy(() => import('./pages/Browser').then((m) => ({ default: m.Browser })))
const Sources = lazy(() => import('./pages/Sources').then((m) => ({ default: m.Sources })))
const Plan = lazy(() => import('./pages/Plan').then((m) => ({ default: m.Plan })))
const Reader = lazy(() => import('./pages/Reader').then((m) => ({ default: m.Reader })))
const SubjectPage = lazy(() => import('./pages/Subject').then((m) => ({ default: m.Subject })))
import { decodeDeckPayload, payloadFromHash } from './lib/sharelink'
import { AUTH_EXPIRED_EVENT, getMe, SERVER_MODE, type Account } from './lib/api'
import { initSync, startSyncListener } from './lib/sync'
import { t } from './i18n'

type View =
  | 'home'
  | 'subject'
  | 'import'
  | 'sources'
  | 'reader'
  | 'plan'
  | 'study'
  | 'browser'
  | 'stats'
  | 'settings'
type AuthState = 'checking' | 'login' | 'ready'

function App() {
  const [view, setView] = useState<View>('home')
  const [studyMode, setStudyMode] = useState<StudyMode>({ kind: 'today' })
  // Set when a hand-made deck was just created → Browser opens ready to add cards.
  const [freshDeckId, setFreshDeckId] = useState<string | null>(null)
  const [sharedDeck, setSharedDeck] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>(SERVER_MODE ? 'checking' : 'ready')
  const [account, setAccount] = useState<Account | null>(null)
  // The subject screen is a hub: studying, the textbook and the card browser can
  // all be opened from it, and each of them has to come back to it rather than
  // drop the user on the home list.
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null)
  const [returnView, setReturnView] = useState<View>('home')
  const [readerAt, setReaderAt] = useState<{ lectureId: string | null; course: string | null }>({
    lectureId: null,
    course: null,
  })
  const [browserTopic, setBrowserTopic] = useState<string | null>(null)
  // Which deck the card browser opens on. Separate from freshDeckId, which
  // means "just created — open the new-card editor straight away".
  const [browserSubjectId, setBrowserSubjectId] = useState<string | null>(null)
  const goHome = () => {
    setReturnView('home')
    setView('home')
  }
  const goBack = () => setView(returnView)

  function openSubject(subjectId: string) {
    setOpenSubjectId(subjectId)
    setReturnView('home')
    setView('subject')
  }

  // Server mode: resolve the session, then reconcile local data with the
  // server snapshot BEFORE any view loads from IndexedDB.
  useEffect(() => {
    if (!SERVER_MODE) return
    startSyncListener()
    getMe()
      .then(async (me) => {
        setAccount(me)
        await initSync()
        setAuth('ready')
      })
      .catch(() => setAuth('login'))

    const onExpired = () => setAuth('login')
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  // A shared-deck link (#deck=...) opens the Import screen pre-filled.
  useEffect(() => {
    const payload = payloadFromHash(window.location.hash)
    if (!payload) return
    void decodeDeckPayload(payload).then((json) => {
      if (json) {
        setSharedDeck(json)
        setView('import')
      }
      // Drop the fragment so a reload doesn't re-offer the import.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    })
  }, [])

  function startStudy(mode: StudyMode) {
    setStudyMode(mode)
    setView('study')
  }

  async function handleLoggedIn(me: Account) {
    setAccount(me)
    setAuth('checking')
    await initSync()
    setAuth('ready')
  }

  if (auth === 'checking') {
    return (
      <div className="app">
        <div className="page center muted">{t('loading')}</div>
      </div>
    )
  }

  if (auth === 'login') {
    return (
      <div className="app">
        <Login onLoggedIn={(me) => void handleLoggedIn(me)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={goHome}>
          <span className="brand-mark" aria-hidden="true" />
          StudyFlow
        </button>
        {view === 'home' && (
          <button className="btn btn-ghost btn-small" onClick={() => setView('import')}>
            {t('navImport')}
          </button>
        )}
      </header>

      <main className="app-main">
        <Suspense fallback={<div className="page center muted">{t('loading')}</div>}>
        {view === 'home' && (
          <Home
            onImport={() => setView('import')}
            onStudy={() => startStudy({ kind: 'today' })}
            onOpenSubject={openSubject}
            onCram={(subjectId) => {
              setReturnView('home')
              startStudy({ kind: 'cram', subjectId })
            }}
            onBrowser={() => {
              setFreshDeckId(null)
              setBrowserSubjectId(null)
              setBrowserTopic(null)
              setReturnView('home')
              setView('browser')
            }}
            onDeckCreated={(subjectId) => {
              setFreshDeckId(subjectId)
              setBrowserSubjectId(subjectId)
              setBrowserTopic(null)
              setReturnView('home')
              setView('browser')
            }}
            onSources={() => setView('sources')}
            onReader={() => {
              setReaderAt({ lectureId: null, course: null })
              setReturnView('home')
              setView('reader')
            }}
            hasMaterials={account?.materials === true}
            onPlan={() => setView('plan')}
            onStats={() => setView('stats')}
            onSettings={() => setView('settings')}
          />
        )}
        {view === 'import' && (
          <Import
            initialText={sharedDeck ?? undefined}
            shared={sharedDeck !== null}
            onDone={() => {
              setSharedDeck(null)
              goHome()
            }}
            onCancel={() => {
              setSharedDeck(null)
              goHome()
            }}
          />
        )}
        {view === 'subject' && openSubjectId && (
          <SubjectPage
            subjectId={openSubjectId}
            hasMaterials={account?.materials === true}
            onBack={goHome}
            onStudy={() => {
              setReturnView('subject')
              startStudy({ kind: 'subject', subjectId: openSubjectId })
            }}
            onCram={() => {
              setReturnView('subject')
              startStudy({ kind: 'cram', subjectId: openSubjectId })
            }}
            onStudyTopic={(topic) => {
              setReturnView('subject')
              startStudy({ kind: 'topic', subjectId: openSubjectId, topic })
            }}
            onCramTopic={(topic) => {
              setReturnView('subject')
              startStudy({ kind: 'cram', subjectId: openSubjectId, topic })
            }}
            onRead={(lectureId, course) => {
              setReaderAt({ lectureId, course })
              setReturnView('subject')
              setView('reader')
            }}
            onBrowse={(topic) => {
              setFreshDeckId(null)
              setBrowserSubjectId(openSubjectId)
              setBrowserTopic(topic)
              setReturnView('subject')
              setView('browser')
            }}
          />
        )}
        {view === 'sources' && <Sources onBack={goHome} />}
        {view === 'reader' && (
          <Reader
            onBack={goBack}
            initialLectureId={readerAt.lectureId}
            courseCode={readerAt.course}
          />
        )}
        {view === 'plan' && <Plan onBack={goHome} />}
        {view === 'study' && <Study onDone={goBack} mode={studyMode} />}
        {view === 'browser' && (
          <Browser
            onBack={goBack}
            initialSubjectId={browserSubjectId ?? undefined}
            startNewCard={!!freshDeckId}
            initialTopic={browserTopic}
          />
        )}
        {view === 'stats' && <Stats onBack={goHome} />}
        {view === 'settings' && (
          <Settings
            onBack={goHome}
            onReset={goHome}
            account={account}
            onLoggedOut={() => setAuth('login')}
          />
        )}
        </Suspense>
      </main>
    </div>
  )
}

export default App
