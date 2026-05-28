import { useState, useEffect } from 'react'
import { useStore } from '../store/index.js'
import { getAssets, deleteAsset, createAsset } from '../api/auth.js'
import './AssetManager.css'

const ASSET_TYPES = [
  { id: '3D Model', name: '3D 模型', icon: '🎮' },
  { id: 'Texture', name: '纹理贴图', icon: '🖼️' },
  { id: 'Audio', name: '音频', icon: '🔊' },
  { id: 'Video', name: '视频', icon: '🎬' },
  { id: 'Label', name: '标签', icon: '🏷️' }
]

export default function AssetManager({ sceneId }) {
  const { isAuthenticated, addToast, assets, setAssets, selectedAsset, setSelectedAsset, setPreviewAsset, setActiveTab } = useStore()
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAsset, setNewAsset] = useState({ name: '', type: '3D Model', url: '', description: '' })

  useEffect(() => {
    if (isAuthenticated) {
      loadAssets()
    }
  }, [isAuthenticated, sceneId])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const data = await getAssets({ sceneId })
      setAssets(data)
    } catch (err) {
      console.error('[AssetManager] Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('确定要删除这个资产吗？')) return

    try {
      await deleteAsset(assetId)
      setAssets(assets.filter(a => a.id !== assetId))
      addToast({ type: 'success', message: '资产已删除' })
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null)
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message })
    }
  }

  const handleCreateAsset = async () => {
    if (!newAsset.name.trim() || !newAsset.url.trim()) {
      addToast({ type: 'error', message: '请填写名称和URL' })
      return
    }

    try {
      const created = await createAsset({
        name: newAsset.name,
        type: newAsset.type,
        url: newAsset.url,
        metadata: { description: newAsset.description }
      })
      setAssets([created, ...assets])
      setShowCreateDialog(false)
      setNewAsset({ name: '', type: '3D Model', url: '', description: '' })
      addToast({ type: 'success', message: '资产创建成功' })
    } catch (err) {
      addToast({ type: 'error', message: err.message })
    }
  }

  const filteredAssets = filterType === 'all'
    ? assets
    : assets.filter(a => a.type === filterType)

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAssetIcon = (type) => {
    return ASSET_TYPES.find(t => t.id === type)?.icon || '📦'
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '未知'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (!isAuthenticated) {
    return (
      <div className="asset-manager">
        <div className="section-header">
          <h2>资产管理</h2>
        </div>
        <div className="empty-state">
          <p>请登录以管理资产</p>
        </div>
      </div>
    )
  }

  return (
    <div className="asset-manager">
      <div className="section-header">
        <h2>资产管理</h2>
        <div className="header-actions">
          <span className="asset-count">{assets.length} 个资产</span>
          <button className="add-asset-btn" onClick={() => setShowCreateDialog(true)}>
            + 添加资产
          </button>
        </div>
      </div>

      <div className="asset-filters">
        <button
          className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          全部 ({assets.length})
        </button>
        {ASSET_TYPES.map(type => {
          const count = assets.filter(a => a.type === type.id).length
          return (
            <button
              key={type.id}
              className={`filter-btn ${filterType === type.id ? 'active' : ''}`}
              onClick={() => setFilterType(type.id)}
            >
              {type.icon} {type.name} ({count})
            </button>
          )
        })}
      </div>

      {loading && assets.length === 0 ? (
        <div className="loading-state">加载资产中...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="empty-state">
          <p>暂无资产</p>
          <span>点击上方「添加资产」按钮创建新资产</span>
        </div>
      ) : (
        <div className="assets-list">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className={`asset-card ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="asset-icon">{getAssetIcon(asset.type)}</div>
              <div className="asset-info">
                <span className="asset-name">{asset.name}</span>
                <span className="asset-meta">
                  {asset.type} · v{asset.version} · {formatDate(asset.updated_at)}
                </span>
              </div>
              <div className="asset-actions">
                <button
                  className="preview-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewAsset(asset)
                    setActiveTab('intent')
                  }}
                  title="预览"
                >
                  👁
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteAsset(asset.id)
                  }}
                  title="删除资产"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 资产详情面板 */}
      {selectedAsset && (
        <div className="asset-detail-panel">
          <div className="detail-header">
            <h3>{selectedAsset.name}</h3>
            <button className="close-btn" onClick={() => setSelectedAsset(null)}>×</button>
          </div>
          <div className="detail-body">
            <div className="detail-row">
              <label>类型</label>
              <span className="type-badge">{selectedAsset.type}</span>
            </div>
            <div className="detail-row">
              <label>版本</label>
              <span>v{selectedAsset.version}</span>
            </div>
            <div className="detail-row">
              <label>URL</label>
              <div className="detail-url">{selectedAsset.url}</div>
            </div>
            <div className="detail-row">
              <label>创建时间</label>
              <span>{formatDate(selectedAsset.created_at)}</span>
            </div>
            <div className="detail-row">
              <label>更新时间</label>
              <span>{formatDate(selectedAsset.updated_at)}</span>
            </div>
            {selectedAsset.metadata && Object.keys(selectedAsset.metadata).length > 0 && (
              <div className="detail-row">
                <label>元数据</label>
                <pre className="detail-meta">
                  {JSON.stringify(selectedAsset.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="detail-actions">
            <button
              className="action-btn danger"
              onClick={() => handleDeleteAsset(selectedAsset.id)}
            >
              删除资产
            </button>
          </div>
        </div>
      )}

      {/* 添加资产弹窗 */}
      {showCreateDialog && (
        <div className="template-modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>添加新资产</h3>
              <button className="close-btn" onClick={() => setShowCreateDialog(false)}>×</button>
            </div>
            <div className="template-modal-body">
              <div className="form-group">
                <label>资产名称</label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="例如：心脏3D模型"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>资产类型</label>
                <select
                  value={newAsset.type}
                  onChange={(e) => setNewAsset({ ...newAsset, type: e.target.value })}
                >
                  {ASSET_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>资源 URL</label>
                <input
                  type="text"
                  value={newAsset.url}
                  onChange={(e) => setNewAsset({ ...newAsset, url: e.target.value })}
                  placeholder="https://example.com/model.glb"
                />
              </div>
              <div className="form-group">
                <label>描述（可选）</label>
                <textarea
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                  placeholder="简要描述这个资产的用途..."
                  rows={2}
                />
              </div>
              <div className="dialog-actions">
                <button onClick={() => setShowCreateDialog(false)} className="cancel-btn">
                  取消
                </button>
                <button
                  onClick={handleCreateAsset}
                  className="confirm-btn"
                  disabled={!newAsset.name.trim() || !newAsset.url.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}