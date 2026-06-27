import { useState } from 'react'
import { Home } from './pages/Home'
import { Import } from './pages/Import'
import { Study } from './pages/Study'

type View = 'home' | 'import' | 'study'

function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={() => setView('home')}>
          <span className="brand-mark" aria-hidden="true" />
          StudyFlow
        </button>
        {view !== 'import' && (
          <button className="btn btn-ghost btn-small" onClick={() => setView('import')}>
            Import
          </button>
        )}
      </header>

      <main className="app-main">
        {view === 'home' && (
          <Home onImport={() => setView('import')} onStudy={() => setView('study')} />
        )}
        {view === 'import' && (
          <Import onDone={() => setView('home')} onCancel={() => setView('home')} />
        )}
        {view === 'study' && <Study onDone={() => setView('home')} />}
      </main>
    </div>
  )
}

export default App
