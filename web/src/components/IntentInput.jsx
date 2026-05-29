import { useState, useEffect } from 'react'
import { useStore } from '../store/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getTemplates, createTemplate } from '../api/auth.js'
import './IntentInput.css'

export default function IntentInput({ onSaveScene }) {
  const { runPipeline, loading, loadingText, clearError, addToast, templates, setTemplates } = useStore()
  const { isAuthenticated } = useAuth()
  const [text, setText] = useState('')
  const [intentType, setIntentType] = useState('EDUCATION')
  const [anchor, setAnchor] = useState('table_center')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [templateToSave, setTemplateToSave] = useState(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')
  const [previewTemplate, setPreviewTemplate] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      loadTemplates()
    }
  }, [isAuthenticated])

  const loadTemplates = async () => {
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('[IntentInput] Failed to load templates:', err)
    }
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    clearError()
    try {
      await runPipeline(text, { intentType, anchor })
    } catch (err) {
      // 错误已由 store 处理
    }
  }

  const handleTemplate = async (template) => {
    // 前端直接加载模板内容，无需调用后端 /use 接口
    setText(template.intent_template || template.intentTemplate)
    if (template.intent_type) setIntentType(template.intent_type)
    setShowTemplateModal(false)
    addToast({ type: 'info', message: `已加载模板: ${template.name}` })
  }

  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template)
    setShowTemplateModal(false)
  }

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !text.trim()) return

    try {
      await createTemplate({
        name: newTemplateName,
        description: newTemplateDesc,
        intentTemplate: text,
        intentType: intentType
      })
      addToast({ type: 'success', message: '模板保存成功' })
      setShowCreateDialog(false)
      setShowTemplateModal(false)
      setNewTemplateName('')
      setNewTemplateDesc('')
      loadTemplates()
    } catch (err) {
      addToast({ type: 'error', message: err.message })
    }
  }

  return (
    <div className="intent-input">
      <div className="section-header">
        <div>
          <h2>S1 意图语义解析</h2>
          <p>输入自然语言，生成可渲染的场景对象、资产与交互逻辑。</p>
        </div>
        <div className="header-actions">
          <span className="pill">UserIntent &rarr; IntentObject</span>
          <button
            className="template-manage-btn"
            onClick={() => setShowTemplateModal(true)}
            title="模板管理"
          >
            📋 {templates.length}
          </button>
        </div>
      </div>

      {loading && (
        <div className="pipeline-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
          <span className="progress-text">{loadingText || '处理中...'}</span>
        </div>
      )}

      <div className="input-group">
        <label>自然语言意图描述</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="描述你想要创建的 MR 场景..."
          disabled={loading}
        />
        <span className="char-count">{text.length} 字</span>
      </div>

      <div className="input-grid">
        <div className="control">
          <label>意图类型</label>
          <select
            value={intentType}
            onChange={(e) => setIntentType(e.target.value)}
            disabled={loading}
          >
            <option value="EDUCATION">EDUCATION</option>
            <option value="DEMO">DEMO</option>
            <option value="INTERACTION">INTERACTION</option>
          </select>
        </div>
        <div className="control">
          <label>空间锚点</label>
          <select
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            disabled={loading}
          >
            <option value="table_center">table_center</option>
            <option value="wall_anchor">wall_anchor</option>
            <option value="floor_plane">floor_plane</option>
          </select>
        </div>
      </div>

      <div className="button-group">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
        >
          {loading ? '解析中...' : '运行解析'}
        </button>
        {onSaveScene && isAuthenticated && (
          <button
            className="save-scene-btn"
            onClick={onSaveScene}
            disabled={loading}
          >
            Save Scene
          </button>
        )}
        {isAuthenticated && text.trim() && (
          <button
            className="save-template-btn"
            onClick={() => {
              setTemplateToSave({ intentTemplate: text, intentType: intentType })
              setShowCreateDialog(true)
            }}
            disabled={loading}
            title="保存为模板"
          >
            💾
          </button>
        )}
      </div>

      {/* 模板管理弹窗 */}
      {showTemplateModal && (
        <div className="template-modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>模板库</h3>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>×</button>
            </div>
            <div className="template-modal-body">
              {templates.length === 0 ? (
                <div className="empty-state">
                  <p>暂无模板</p>
                  <span>创建意图后可保存为模板</span>
                </div>
              ) : (
                <div className="template-grid">
                  {templates.map((t) => (
                    <div key={t.id} className="template-card">
                      <div className="template-card-header">
                        <span className={`template-badge ${t.is_system ? 'system' : 'user'}`}>
                          {t.is_system ? '系统' : '自定义'}
                        </span>
                        <span className="template-uses">👁 {t.use_count}</span>
                      </div>
                      <h4>{t.name}</h4>
                      <p className="template-desc">{t.description || '无描述'}</p>
                      <div className="template-preview-text">
                        {t.intent_template?.slice(0, 60)}...
                      </div>
                      <div className="template-actions">
                        <button
                          className="use-btn"
                          onClick={() => handleTemplate(t)}
                        >
                          使用
                        </button>
                        <button
                          className="preview-btn"
                          onClick={() => handlePreviewTemplate(t)}
                        >
                          预览
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 模板预览弹窗 */}
      {previewTemplate && (
        <div className="template-modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="template-modal template-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>{previewTemplate.name}</h3>
              <button className="close-btn" onClick={() => setPreviewTemplate(null)}>×</button>
            </div>
            <div className="template-modal-body">
              <div className="preview-section">
                <label>描述</label>
                <p>{previewTemplate.description || '无描述'}</p>
              </div>
              <div className="preview-section">
                <label>意图类型</label>
                <p>{previewTemplate.intent_type || previewTemplate.intentType}</p>
              </div>
              <div className="preview-section">
                <label>完整模板内容</label>
                <div className="preview-full-text">
                  {previewTemplate.intent_template || previewTemplate.intentTemplate}
                </div>
              </div>
              <div className="preview-section">
                <label>使用次数</label>
                <p>{previewTemplate.use_count} 次</p>
              </div>
              <div className="preview-actions">
                <button
                  className="submit-btn"
                  onClick={() => handleTemplate(previewTemplate)}
                >
                  使用此模板
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 保存模板弹窗 */}
      {showCreateDialog && (
        <div className="template-modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>保存为模板</h3>
              <button className="close-btn" onClick={() => setShowCreateDialog(false)}>×</button>
            </div>
            <div className="template-modal-body">
              <div className="form-group">
                <label>模板名称</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="给模板起个名字"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>描述（可选）</label>
                <textarea
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="简要描述这个模板的用途..."
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>模板内容预览</label>
                <div className="template-content-preview">
                  {templateToSave?.intentTemplate}
                </div>
              </div>
              <div className="dialog-actions">
                <button onClick={() => setShowCreateDialog(false)} className="cancel-btn">
                  取消
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  className="confirm-btn"
                  disabled={!newTemplateName.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}