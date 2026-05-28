import { useState, useEffect } from 'react'
import { useStore } from '../store/index.js'
import './LogicPanel.css'

const TRIGGERS = [
  { value: 'user_tap', label: '点击 (Tap)' },
  { value: 'user_gaze', label: '凝视 (Gaze)' },
  { value: 'user_proximity', label: '接近 (Proximity)' },
  { value: 'voice_command', label: '语音 (Voice)' }
]

const ACTIONS = [
  { value: 'show_label', label: '显示标注' },
  { value: 'highlight_path', label: '高亮路径' },
  { value: 'play_audio', label: '播放音频' },
  { value: 'play_animation', label: '播放动画' },
  { value: 'jump_scene', label: '跳转场景' }
]

// Demo rules for the education example
const DEMO_RULES = [
  {
    rule_id: 'rule_tap_reveal_heart',
    trigger: 'user_tap(target: heart_model)',
    condition: 'scene_state == anatomy_lesson',
    processor: { type: 'DELAY', delay_ms: 200 },
    action: [
      { type: 'show_label', content: '心脏 - 左心室', position: 'left' },
      { type: 'highlight_path', path: 'blood_flow' }
    ],
    feedback: 'visual_emphasis'
  },
  {
    rule_id: 'rule_tap_rotate_view',
    trigger: 'user_tap(target: rotate_control)',
    condition: 'true',
    processor: { type: 'DELAY', delay_ms: 100 },
    action: [{ type: 'play_animation', name: 'orbit_rotate' }],
    feedback: 'rotation_animation'
  },
  {
    rule_id: 'rule_gaze_info_panel',
    trigger: 'user_gaze(target: info_marker, duration: 2s)',
    condition: 'current_step >= 1',
    processor: { type: 'STATE_CHECK', check: 'gaze_timer' },
    action: [
      { type: 'show_label', content: '冠状动脉 - 向心肌供血' },
      { type: 'play_audio', name: 'coronary_artery_desc' }
    ],
    feedback: 'tooltip_display'
  }
]

export default function LogicPanel() {
  const { intentResult, assetPackage, sceneBundle, addToast } = useStore()
  const [rules, setRules] = useState([])
  const [selectedTrigger, setSelectedTrigger] = useState('')
  const [selectedActions, setSelectedActions] = useState([])
  const [condition, setCondition] = useState('true')
  const [activeRule, setActiveRule] = useState(null)

  useEffect(() => {
    if (sceneBundle?.rules?.length > 0) {
      setRules(sceneBundle.rules)
    } else if (intentResult?.interaction_rules?.length > 0) {
      setRules(intentResult.interaction_rules)
    } else {
      // Use demo rules if no rules from pipeline
      setRules(DEMO_RULES)
    }
  }, [intentResult, sceneBundle])

  const triggerRule = (rule) => {
    setActiveRule(rule.rule_id)
    addToast({ type: 'info', message: `触发: ${rule.rule_id}` })
    setTimeout(() => setActiveRule(null), 2000)
  }

  const loadDemoRules = () => {
    setRules(DEMO_RULES)
    addToast({ type: 'success', message: '已加载演示规则' })
  }

  const addRule = () => {
    if (!selectedTrigger) return

    const newRule = {
      rule_id: `rule_${Date.now()}`,
      trigger: selectedTrigger,
      condition: condition,
      action: selectedActions.map(a => ({ type: a })),
      feedback: '用户交互触发'
    }

    setRules([...rules, newRule])
    setSelectedTrigger('')
    setSelectedActions([])
    setCondition('true')
  }

  const deleteRule = (ruleId) => {
    setRules(rules.filter(r => r.rule_id !== ruleId))
  }

  const toggleAction = (actionValue) => {
    setSelectedActions(prev =>
      prev.includes(actionValue)
        ? prev.filter(a => a !== actionValue)
        : [...prev, actionValue]
    )
  }

  return (
    <div className="logic-panel">
      <div className="section-header">
        <div>
          <h2>S4 视觉逻辑绑定</h2>
          <p>把触发器、条件和动作整理成可验证的交互规则。</p>
        </div>
        <span className="pill">When-How-Then</span>
      </div>

      <button className="demo-btn" onClick={loadDemoRules}>
        📚 加载演示案例
      </button>

      <div className="rule-editor">
        <div className="editor-row">
          <label>触发条件 (WHEN)</label>
          <select
            value={selectedTrigger}
            onChange={(e) => setSelectedTrigger(e.target.value)}
            className="trigger-select"
          >
            <option value="">选择触发器...</option>
            {TRIGGERS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="editor-row">
          <label>条件判断 (HOW)</label>
          <input
            type="text"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g., scene_state == anatomy_lesson"
            className="condition-input"
          />
        </div>

        <div className="editor-row">
          <label>执行动作 (THEN)</label>
          <div className="action-toggles">
            {ACTIONS.map(a => (
              <button
                key={a.value}
                className={`action-toggle ${selectedActions.includes(a.value) ? 'active' : ''}`}
                onClick={() => toggleAction(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="add-rule-btn"
          onClick={addRule}
          disabled={!selectedTrigger || selectedActions.length === 0}
        >
          + 添加规则
        </button>
      </div>

      <div className="rules-list">
        <label>交互规则 ({rules.length})</label>
        {rules.length === 0 ? (
          <div className="empty-state">
            暂无交互规则，请配置上方规则或运行意图解析
          </div>
        ) : (
          rules.map((rule, idx) => (
            <div
              key={rule.rule_id || idx}
              className={`rule-card ${activeRule === rule.rule_id ? 'rule-active' : ''}`}
            >
              <div className="rule-header">
                <span className="rule-id">{rule.rule_id || `rule_${idx}`}</span>
                <button className="trigger-btn" onClick={() => triggerRule(rule)} title="模拟触发">▶</button>
                <button className="delete-btn" onClick={() => deleteRule(rule.rule_id || idx)} title="删除">×</button>
              </div>
              <div className="rule-body">
                <div className="rule-col when">
                  <span className="col-label">WHEN</span>
                  <span className="col-value">{rule.trigger}</span>
                </div>
                <div className="rule-col how">
                  <span className="col-label">HOW</span>
                  <span className="col-value">{rule.condition || 'true'}</span>
                </div>
                <div className="rule-col then">
                  <span className="col-label">THEN</span>
                  <span className="col-value">
                    {Array.isArray(rule.action)
                      ? rule.action.map(a => a.type || a).join(', ')
                      : rule.action}
                  </span>
                </div>
              </div>
              {rule.feedback && (
                <div className="rule-feedback">
                  <span>反馈: </span>{rule.feedback}
                </div>
              )}
              {activeRule === rule.rule_id && (
                <div className="rule-triggered-indicator">
                  <span className="pulse"></span>
                  <span>触发中...</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="assets-info">
        <label>资产包 ({assetPackage?.assets?.length || 0})</label>
        <div className="asset-list">
          {assetPackage?.assets?.length > 0 ? (
            assetPackage.assets.map((asset, idx) => (
              <div key={idx} className="asset-item">
                <span className="asset-type">{asset.type}</span>
                <span className="asset-name">{asset.filename || asset.name}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">暂无资产</div>
          )}
        </div>
      </div>
    </div>
  )
}
