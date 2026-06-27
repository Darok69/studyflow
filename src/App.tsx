import { useState } from 'react'
import { Home } from './pages/Home'
import { Import } from './pages/Import'
import { Study } from './pages/Study'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'

type View = 'home' | 'import' | 'study' | 'stats' | 'settings'

function App() {
  const [view, setView] = useState<View>('home')
  const goHome = () => setView('home')

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
            onStudy={() => setView('study')}
            onStats={() => setView('stats')}
            onSettings={() => setView('settings')}
          />
        )}
        {view === 'import' && <Import onDone={goHome} onCancel={goHome} />}
        {view === 'study' && <Study onDone={goHome} />}
        {view === 'stats' && <Stats onBack={goHome} />}
        {view === 'settings' && <Settings onBack={goHome} onReset={goHome} />}
      </main>
    </div>
  )
}

export default App
