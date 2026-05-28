import { useState, useEffect } from 'react'
import { useStore } from '../store/index.js'
import { getScenes, createScene, deleteScene } from '../api/auth.js'
import './SceneManager.css'

export default function SceneManager({ onLoadScene }) {
  const { isAuthenticated, user } = useStore()
  const { scenes, setScenes, addScene, deleteScene: removeScene } = useStore()
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [sceneName, setSceneName] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')

  const { intentResult, assetPackage, sceneBundle } = useStore()

  useEffect(() => {
    if (isAuthenticated) {
      loadScenes()
    }
  }, [isAuthenticated])

  const loadScenes = async () => {
    try {
      setLoading(true)
      const data = await getScenes()
      setScenes(data)
    } catch (err) {
      console.error('[SceneManager] Failed to load scenes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveScene = async () => {
    if (!sceneName.trim()) return

    try {
      const scene = await createScene({
        name: sceneName,
        description: sceneDescription,
        intentObject: intentResult,
        sceneBundle: sceneBundle,
        assets: assetPackage?.assets || []
      })

      addScene(scene)
      setShowSaveDialog(false)
      setSceneName('')
      setSceneDescription('')
    } catch (err) {
      console.error('[SceneManager] Failed to save scene:', err)
    }
  }

  const handleDeleteScene = async (sceneId) => {
    if (!confirm('Are you sure you want to delete this scene?')) return

    try {
      await deleteScene(sceneId)
      removeScene(sceneId)
    } catch (err) {
      console.error('[SceneManager] Failed to delete scene:', err)
    }
  }

  const handleLoadScene = (scene) => {
    if (onLoadScene) {
      onLoadScene(scene)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="scene-manager">
        <div className="section-header">
          <h2>Scene Manager</h2>
        </div>
        <div className="empty-state">
          <p>Please sign in to save and manage your scenes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="scene-manager">
      <div className="section-header">
        <h2>Scene Manager</h2>
        {intentResult && (
          <button className="save-btn" onClick={() => setShowSaveDialog(true)}>
            + Save Current
          </button>
        )}
      </div>

      {loading && scenes.length === 0 ? (
        <div className="loading-state">Loading scenes...</div>
      ) : scenes.length === 0 ? (
        <div className="empty-state">
          <p>No saved scenes yet</p>
          <span>Create an intent and save it to see it here</span>
        </div>
      ) : (
        <div className="scenes-list">
          {scenes.map((scene) => (
            <div key={scene.id} className="scene-card">
              <div className="scene-info">
                <span className="scene-name">{scene.name}</span>
                <span className="scene-date">{formatDate(scene.updated_at)}</span>
              </div>
              <div className="scene-actions">
                <button
                  className="load-btn"
                  onClick={() => handleLoadScene(scene)}
                  title="Load scene"
                >
                  ▶
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteScene(scene.id)}
                  title="Delete scene"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSaveDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Save Scene</h3>
            <div className="form-group">
              <label>Scene Name</label>
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="My MR Scene"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="Describe this scene..."
                rows={3}
              />
            </div>
            <div className="dialog-actions">
              <button onClick={() => setShowSaveDialog(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleSaveScene} className="confirm-btn" disabled={!sceneName.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}