import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext.jsx'
import { useStore } from './store/index.js'
import IntentInput from './components/IntentInput.jsx'
import Viewer3D from './components/Viewer3D.jsx'
import LogicPanel from './components/LogicPanel.jsx'
import SceneManager from './components/SceneManager.jsx'
import AssetManager from './components/AssetManager.jsx'
import AuthModal from './components/AuthModal.jsx'
import Toast from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import MobileNav from './components/MobileNav.jsx'
import './App.css'

function AppContent() {
  const {
    isAuthenticated,
    user,
    logout,
    showAuthModal,
    closeAuthModal,
    activeTab,
    setActiveTab,
    intentResult,
    assetPackage,
    sceneBundle,
    loading,
    setIntentResult,
    setAssetPackage,
    setSceneBundle
  } = useStore()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        useStore.getState().setAuth(user, token)
      } catch {
        useStore.getState().clearAuth()
      }
    }
  }, [])

  const handleSaveScene = () => {
    setActiveTab('scenes')
  }

  const handleLoadScene = (scene) => {
    if (scene.intentObject) setIntentResult(scene.intentObject)
    if (scene.assets) setAssetPackage({ assets: scene.assets })
    if (scene.sceneBundle) setSceneBundle(scene.sceneBundle)
    setActiveTab('intent')
  }

  const pipelineStatus = [
    { id: 'intent', label: 'S1', text: 'Intent', done: !!intentResult },
    { id: 'dispatch', label: 'S2', text: 'Assets', done: !!assetPackage },
    { id: 'workspace', label: 'S3', text: 'Sync', done: !!assetPackage?.assets?.length },
    { id: 'binding', label: 'S4', text: 'Logic', done: !!sceneBundle },
    { id: 'render', label: 'S5', text: 'Preview', done: !!assetPackage?.modelUrl || !!sceneBundle }
  ]

  const completedSteps = pipelineStatus.filter(step => step.done).length
  const ruleCount = sceneBundle?.rules?.length || intentResult?.interaction_rules?.length || 0
  const assetCount = assetPackage?.assets?.length || 0

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand-mark">IV</div>
          <div className="brand-copy">
            <h1>IdeaVerse Creator</h1>
            <span className="subtitle">意图驱动的 MR 内容生成平台</span>
          </div>
        </div>

        <div className="pipeline-status" aria-label="Pipeline status">
          {pipelineStatus.map((step) => (
            <div
              key={step.id}
              className={`pipeline-step ${step.done ? 'done' : ''} ${loading && !step.done ? 'pending' : ''}`}
              title={`${step.label} ${step.text}`}
            >
              <span className="pipeline-step-label">{step.label}</span>
              <span className="pipeline-step-text">{step.text}</span>
            </div>
          ))}
        </div>

        <div className="header-right">
          <div className="header-metrics" aria-label="Current scene metrics">
            <span><strong>{completedSteps}</strong>/5</span>
            <span><strong>{assetCount}</strong> assets</span>
            <span><strong>{ruleCount}</strong> rules</span>
          </div>
          {isAuthenticated ? (
            <div className="user-info">
              <span className="user-name">{user?.username || user?.email}</span>
              <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <button className="login-btn" onClick={() => useStore.getState().openAuthModal()}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <ErrorBoundary>
          <div className="panel left">
            <div className="panel-tabs">
              <button
                className={`tab-btn ${activeTab === 'intent' ? 'active' : ''}`}
                onClick={() => setActiveTab('intent')}
              >
                Intent Input
              </button>
              <button
                className={`tab-btn ${activeTab === 'scenes' ? 'active' : ''}`}
                onClick={() => setActiveTab('scenes')}
              >
                Scenes
              </button>
              <button
                className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveTab('assets')}
              >
                Assets
              </button>
            </div>
            {activeTab === 'intent' ? (
              <IntentInput onSaveScene={handleSaveScene} />
            ) : activeTab === 'scenes' ? (
              <SceneManager onLoadScene={handleLoadScene} />
            ) : (
              <AssetManager />
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="panel center">
            <Viewer3D />
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="panel right">
            <LogicPanel />
          </div>
        </ErrorBoundary>
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />

      <AuthModal isOpen={showAuthModal} onClose={closeAuthModal} />
      <Toast />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
