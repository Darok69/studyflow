import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Import } from './pages/Import'
import { Study, type StudyMode } from './pages/Study'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { Browser } from './pages/Browser'
import { Login } from './pages/Login'
import { decodeDeckPayload, payloadFromHash } from './lib/sharelink'
import { AUTH_EXPIRED_EVENT, getMe, SERVER_MODE, type Account } from './lib/api'
import { initSync, startSyncListener } from './lib/sync'

type View = 'home' | 'import' | 'study' | 'browser' | 'stats' | 'settings'
type AuthState = 'checking' | 'login' | 'ready'

function App() {
  const [view, setView] = useState<View>('home')
  const [studyMode, setStudyMode] = useState<StudyMode>({ kind: 'today' })
  const [sharedDeck, setSharedDeck] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>(SERVER_MODE ? 'checking' : 'ready')
  const [account, setAccount] = useState<Account | null>(null)
  const goHome = () => setView('home')

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
        <div className="page center muted">Načítám…</div>
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
            Import
          </button>
        )}
      </header>

      <main className="app-main">
        {view === 'home' && (
          <Home
            onImport={() => setView('import')}
            onStudy={() => startStudy({ kind: 'today' })}
            onCram={(subjectId) => startStudy({ kind: 'cram', subjectId })}
            onBrowser={() => setView('browser')}
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
        {view === 'study' && <Study onDone={goHome} mode={studyMode} />}
        {view === 'browser' && <Browser onBack={goHome} />}
        {view === 'stats' && <Stats onBack={goHome} />}
        {view === 'settings' && (
          <Settings
            onBack={goHome}
            onReset={goHome}
            account={account}
            onLoggedOut={() => setAuth('login')}
          />
        )}
      </main>
    </div>
  )
}

export default App
