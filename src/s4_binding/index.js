/**
 * S4: 句式化视觉逻辑绑定模块
 * 功能：将交互规则与资产对象绑定，生成SceneLogicBundle
 *
 * 核心概念（对应产品规格书 Section 6）：
 * - When-How-Then 三元句式结构
 * - condition (WHEN): 触发条件
 * - processor (HOW): 处理逻辑
 * - action (THEN): 执行动作
 *
 * Phase 0简化版：
 * - 硬编码规则模板
 * - FSM有限状态机实现
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * 触发条件类型（WHEN）
 */
export const TriggerType = {
  TOUCH: 'TOUCH',       // 用户点击/触碰
  GAZE: 'GAZE',         // 凝视超时
  PROXIMITY: 'PROXIMITY', // 空间接近
  VOICE: 'VOICE',       // 语音触发
  TIMER: 'TIMER'        // 计时器
}

/**
 * 处理逻辑类型（HOW）
 */
export const ProcessorType = {
  DELAY: 'DELAY',
  BRANCH: 'BRANCH',
  COUNT: 'COUNT',
  STATE_CHECK: 'STATE_CHECK'
}

/**
 * 执行动作类型（THEN）
 */
export const ActionType = {
  PLAY_ANIMATION: 'PLAY_ANIMATION',
  PLAY_AUDIO: 'PLAY_AUDIO',
  SHOW_LABEL: 'SHOW_LABEL',
  HIGHLIGHT_PATH: 'HIGHLIGHT_PATH',
  JUMP_SCENE: 'JUMP_SCENE'
}

/**
 * InteractionRule工厂函数
 * @param {Object} config
 * @returns {Object}
 */
function createRule(config) {
  return {
    rule_id: config.rule_id || `rule_${uuidv4().slice(0, 8)}`,
    trigger: config.trigger,
    condition: config.condition || 'true',
    processor: config.processor || { type: ProcessorType.DELAY, delay_ms: 0 },
    action: config.action || [],
    feedback: config.feedback || 'none'
  }
}

/**
 * 从IntentObject的interaction_rules生成SceneLogicBundle
 * @param {Array} interactionRules - IntentObject.interaction_rules
 * @param {Array} assetRecords - S3注册的资产记录
 * @returns {Object} SceneLogicBundle
 */
export function bindRules(interactionRules, assetRecords) {
  console.log('[S4] Binding', interactionRules.length, 'rules with', assetRecords.length, 'assets')

  const boundRules = []
  const assetMap = new Map(assetRecords.map(r => [r.type, r]))

  for (const rule of interactionRules) {
    const boundRule = bindRuleAssets(rule, assetMap)
    boundRules.push(boundRule)
  }

  const bundle = {
    bundle_id: `SLB-${Date.now()}`,
    created_at: new Date().toISOString(),
    rules: boundRules,
    version: '1.0'
  }

  console.log('[S4] Generated SceneLogicBundle:', bundle.bundle_id)
  return bundle
}

/**
 * 绑定单条规则的资产引用
 * @param {Object} rule
 * @param {Map} assetMap
 * @returns {Object}
 */
function bindRuleAssets(rule, assetMap) {
  const boundRule = { ...rule }

  // 绑定trigger中的资产引用
  if (boundRule.trigger.includes('target:')) {
    const targetType = extractTargetType(boundRule.trigger)
    const matchedAsset = assetMap.get(targetType)
    if (matchedAsset) {
      boundRule.trigger_asset_id = matchedAsset.id
      boundRule.trigger_asset_path = matchedAsset.path
    }
  }

  // 绑定action中的资产引用
  boundRule.action = boundRule.action.map(a => {
    // 处理字符串格式的动作
    if (typeof a === 'string') {
      if (a.includes('play_audio') || a.includes('play_animation') || a.includes('show_label')) {
        const assetType = extractAssetTypeFromAction(a)
        const matchedAsset = assetMap.get(assetType)
        if (matchedAsset) {
          return {
            type: 'ACTION_STRING',
            original: a,
            asset_id: matchedAsset.id,
            asset_path: matchedAsset.path
          }
        }
      }
      return a
    }
    // 处理对象格式的动作
    if (typeof a === 'object' && a.type) {
      // 根据动作类型推断资产类型并绑定
      const assetType = inferAssetTypeFromActionType(a.type)
      const matchedAsset = assetMap.get(assetType)
      if (matchedAsset) {
        return {
          ...a,
          asset_id: matchedAsset.id,
          asset_path: matchedAsset.path
        }
      }
    }
    return a
  })

  return boundRule
}

/**
 * 从trigger字符串提取目标资产类型
 * @param {string} trigger
 * @returns {string}
 */
function extractTargetType(trigger) {
  // 简单解析：提取trigger中的资产类型
  if (trigger.includes('primary_object')) return 'MODEL_3D'
  if (trigger.includes('audio')) return 'AUDIO'
  if (trigger.includes('label')) return 'UI_LABEL'
  return 'MODEL_3D'
}

/**
 * 从action字符串提取资产类型
 * @param {string} action
 * @returns {string}
 */
function extractAssetTypeFromAction(action) {
  if (action.includes('audio')) return 'AUDIO'
  if (action.includes('animation')) return 'ANIMATION'
  if (action.includes('label')) return 'UI_LABEL'
  return 'MODEL_3D'
}

/**
 * 从action类型推断资产类型
 * @param {string} actionType
 * @returns {string}
 */
function inferAssetTypeFromActionType(actionType) {
  if (actionType.includes('AUDIO')) return 'AUDIO'
  if (actionType.includes('ANIMATION')) return 'ANIMATION'
  if (actionType.includes('LABEL')) return 'UI_LABEL'
  if (actionType.includes('PROMPT')) return 'UI_LABEL'
  return 'MODEL_3D'
}

/**
 * 创建预定义的规则模板（Phase 0演示用）
 * @param {string} intentType
 * @param {string} subject
 * @returns {Array<Object>}
 */
export function getPresetRules(intentType, subject) {
  const templates = {
    EDUCATION: [
      createRule({
        rule_id: 'rule_tap_reveal_annotation',
        trigger: 'user_tap(target: model_3d)',
        condition: 'scene_state == anatomy_lesson',
        processor: { type: ProcessorType.DELAY, delay_ms: 200 },
        action: ['show_label(target: annotation)', 'highlight_path(target: blood_flow)'],
        feedback: 'visual_emphasis'
      })
    ],
    DEMO: [
      createRule({
        rule_id: 'rule_tap_explode_component',
        trigger: 'user_tap(target: component)',
        condition: 'scene_state == product_demo',
        processor: { type: ProcessorType.DELAY, delay_ms: 300 },
        action: ['play_animation(segment: explode)', 'show_ui_panel(target: component_info)'],
        feedback: 'panel_reveal'
      })
    ],
    INTERACTION: [
      createRule({
        rule_id: 'rule_proximity_show_step',
        trigger: 'user_proximity(target: step_marker, distance < 0.6m)',
        condition: 'current_step_valid',
        processor: { type: ProcessorType.STATE_CHECK, check: 'proximity_check' },
        action: ['show_prompt(content: step_instruction)', 'enable_step_completion'],
        feedback: 'tooltip_display'
      })
    ]
  }

  return templates[intentType] || templates.EDUCATION
}

/**
 * 获取S4模块状态
 * @returns {Object}
 */
export function getBindingStatus() {
  return {
    status: 'ready',
    engine_type: 'FSM',
    supported_triggers: Object.values(TriggerType),
    supported_processors: Object.values(ProcessorType),
    supported_actions: Object.values(ActionType)
  }
}

export default { bindRules, getPresetRules, getBindingStatus }