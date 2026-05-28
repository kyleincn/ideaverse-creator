/**
 * S1: 意图语义解析模块
 * 功能：将自然语言输入转换为结构化IntentObject
 *
 * 核心步骤（对应产品规格书 Section 3）：
 * 1. Preprocess - 文本归一化与分词
 * 2. Classify - 意图分类（规则引擎 + 语义相似度）
 * 3. NER - 实体抽取（对象/属性/动作/空间）
 * 4. Map - 实体映射为生成参数
 * 5. Validate - Schema校验与输出封装
 *
 * Phase 1 增强版：
 * - 解析状态追踪（每步骤结果）
 * - 置信度评分
 * - 更丰富的实体识别
 * - 原型界面模板支持
 */

import { createDefaultIntentObject, IntentType, AnchorType, AssetProfile, Language, TEMPLATES, generateIntentId } from '../shared/types.js'

// 意图分类规则引擎 - 高精度关键词匹配
const INTENT_RULES = [
  {
    type: IntentType.EDUCATION,
    keywords: ['教学', '学习', '解剖', '讲解', '课程', '培训', '演示'],
    patterns: [/心脏|器官|人体|生物|医学/, /解剖|结构|标注|说明/]
  },
  {
    type: IntentType.DEMO,
    keywords: ['演示', '展示', '产品', '结构', '拆解', '爆炸'],
    patterns: [/眼镜|设备|产品|结构|拆解|部件/]
  },
  {
    type: IntentType.INTERACTION,
    keywords: ['交互', '流程', '操作', '维护', '步骤', '靠近'],
    patterns: [/阀门|设备|维护|流程|靠近|检查|操作/]
  }
]

// 空间实体关键词
const SPATIAL_KEYWORDS = {
  table_center: ['桌面中央', '桌子中间', '桌面中心'],
  wall_anchor: ['墙面', '墙上', '墙壁'],
  floor_plane: ['地面', '地板', '地上'],
  hand_tracking_space: ['手部', '手持', '手中']
}

// 对象实体关键词
const OBJECT_KEYWORDS = {
  '3d_model': ['模型', '3D', '物体'],
  'audio': ['音频', '讲解', '配音', '语音', '声音'],
  'label': ['标注', '标签', '说明', '注释'],
  'ui_panel': ['面板', '卡片', '信息卡', '说明卡'],
  'animation': ['动画', '演示', '序列']
}

// 动作实体关键词
const ACTION_KEYWORDS = {
  tap: ['点击', '触碰', '触摸', 'tap', '按下'],
  gaze: ['凝视', '注视', '盯着', 'gaze', '驻留'],
  proximity: ['靠近', '接近', '临近', 'proximity'],
  voice: ['语音', '说话', '语音命令', 'voice']
}

/**
 * 解析状态追踪
 * @typedef {Object} ParseState
 * @property {string} step - 当前步骤
 * @property {string} input - 输入内容
 * @property {Object} output - 输出结果
 * @property {number} confidence - 置信度 0-1
 */

/**
 * 解析结果
 * @typedef {Object} ParseResult
 * @property {IntentObject} intentObj - 解析后的IntentObject
 * @property {ParseState[]} steps - 各步骤状态
 * @property {number} confidence - 总置信度
 */

/**
 * 步骤1: 文本预处理
 * @param {string} rawText
 * @returns {Object} { normalized: string, tokens: string[] }
 */
function preprocess(rawText) {
  const normalized = rawText
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')

  // 简单分词（按标点和空格分割）
  const tokens = normalized.split(/[\s，。、；：""''（）]+/).filter(t => t.length > 0)

  return { normalized, tokens }
}

/**
 * 步骤2: 意图分类
 * @param {string} text
 * @returns {Object} { type: string, confidence: number, matched: string }
 */
function classifyIntent(text) {
  const scores = []

  for (const rule of INTENT_RULES) {
    let score = 0
    let matched = ''

    // 关键词匹配
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        score += 0.3
        matched = kw
      }
    }

    // 模式匹配
    for (const p of rule.patterns) {
      const match = text.match(p)
      if (match) {
        score += 0.4
        matched = match[0]
      }
    }

    if (score > 0) {
      scores.push({ type: rule.type, score, matched })
    }
  }

  // 选择得分最高的
  if (scores.length > 0) {
    scores.sort((a, b) => b.score - a.score)
    const best = scores[0]
    return {
      type: best.type,
      confidence: Math.min(best.score, 1),
      matched: best.matched
    }
  }

  return { type: IntentType.EDUCATION, confidence: 0.5, matched: '' }
}

/**
 * 步骤3: 实体抽取（简化版NER）
 * @param {string} text
 * @returns {Object} 包含objects, attributes, actions, spatial, entities
 */
function extractEntities(text) {
  const entities = {
    objects: [],
    attributes: [],
    actions: [],
    spatial: []
  }

  // 抽取对象实体
  for (const [type, keywords] of Object.entries(OBJECT_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        if (!entities.objects.includes(type)) {
          entities.objects.push(type)
        }
      }
    }
  }

  // 抽取动作实体
  for (const [type, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        if (!entities.actions.includes(type)) {
          entities.actions.push(type)
        }
      }
    }
  }

  // 抽取空间实体
  for (const [type, keywords] of Object.entries(SPATIAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        if (!entities.spatial.includes(type)) {
          entities.spatial.push(type)
        }
      }
    }
  }

  // 抽取属性实体
  if (text.includes('透明')) entities.attributes.push('transparent')
  if (text.includes('可交互')) entities.attributes.push('interactive')
  if (text.includes('悬浮')) entities.attributes.push('floating')
  if (text.includes('高亮')) entities.attributes.push('highlight')
  if (text.includes('播放')) entities.attributes.push('playable')
  if (text.includes('中文')) entities.attributes.push('chinese')
  if (text.includes('英语') || text.includes('英文')) entities.attributes.push('english')

  // 抽取数量实体
  const timeMatch = text.match(/(\d+)\s*秒/)
  if (timeMatch) {
    entities.duration = parseInt(timeMatch[1])
  }

  // 抽取距离实体
  const distanceMatch = text.match(/(\d+\.?\d*)\s*米/)
  if (distanceMatch) {
    entities.distance = parseFloat(distanceMatch[1])
  }

  // 默认值
  if (entities.objects.length === 0) entities.objects.push('3d_model')
  if (entities.actions.length === 0) entities.actions.push('tap')
  if (entities.spatial.length === 0) entities.spatial.push('table_center')

  return entities
}

/**
 * 步骤4: 实体映射为生成参数
 * @param {Object} entities
 * @param {string} intentType
 * @param {string} assetProfile
 * @returns {Object}
 */
function mapToParams(entities, intentType, assetProfile) {
  const targetAssets = []

  // 根据对象实体映射资产类型
  if (entities.objects.includes('3d_model')) {
    // 根据 intentType 选择不同的模型预设
    let modelFile = 'generated_model.glb'
    if (intentType === IntentType.EDUCATION && entities.attributes.includes('transparent')) {
      modelFile = 'transparent_heart_model.glb'
    } else if (intentType === IntentType.DEMO) {
      modelFile = 'product_exploded_model.glb'
    } else if (intentType === IntentType.INTERACTION) {
      modelFile = 'equipment_valve_model.glb'
    }
    targetAssets.push(`MODEL_3D: ${modelFile}`)
  }
  if (entities.objects.includes('audio')) {
    let audioFile = 'narration.wav'
    if (entities.attributes.includes('chinese')) {
      audioFile = entities.duration ? `heart_explanation_zh_cn_${entities.duration}s.wav` : 'heart_explanation_zh_cn_15s.wav'
    }
    targetAssets.push(`AUDIO: ${audioFile}`)
  }
  if (entities.objects.includes('label')) {
    let labelFile = 'labels.json'
    if (intentType === IntentType.EDUCATION) {
      labelFile = 'aorta_ventricle_labels.json'
    }
    targetAssets.push(`UI_LABEL: ${labelFile}`)
  }
  if (entities.objects.includes('ui_panel')) {
    targetAssets.push('UI_PANEL: component_info_cards.json')
  }
  if (entities.objects.includes('animation')) {
    targetAssets.push('ANIMATION: step_guidance_sequence.timeline')
  }

  // 根据动作实体生成交互规则
  const interactionRules = []
  if (entities.actions.includes('tap')) {
    interactionRules.push({
      rule_id: 'rule_tap_object_reveal',
      trigger: 'user_tap(target: primary_object)',
      condition: 'object_has_annotation == true',
      processor: { type: 'DELAY', delay_ms: 200 },
      action: [
        { type: 'HIGHLIGHT', target: 'primary_object' },
        { type: 'SHOW_LABEL', target: 'primary_object' }
      ],
      feedback: 'visual_emphasis'
    })
  }
  if (entities.actions.includes('proximity')) {
    const distance = entities.distance || 0.6
    interactionRules.push({
      rule_id: 'rule_proximity_show_prompt',
      trigger: `user_proximity(distance < ${distance}m)`,
      condition: 'current_step_in_training',
      processor: { type: 'STATE_CHECK', check: 'proximity_check' },
      action: [
        { type: 'SHOW_PROMPT', content: 'check_instruction' }
      ],
      feedback: 'tooltip_display'
    })
  }
  if (entities.actions.includes('gaze')) {
    interactionRules.push({
      rule_id: 'rule_gaze_dwell_reveal',
      trigger: 'user_gaze(target: primary_object, dwell: 1000ms)',
      condition: 'object_has_annotation == true',
      processor: { type: 'DELAY', delay_ms: 0 },
      action: [
        { type: 'SHOW_LABEL', target: 'primary_object' }
      ],
      feedback: 'visual_emphasis'
    })
  }

  return {
    target_assets: targetAssets,
    interaction_rules: interactionRules
  }
}

/**
 * 步骤5: 校验与封装
 * @param {Object} intentObj
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validate(intentObj) {
  const errors = []

  if (!intentObj.intent_id) errors.push('Missing intent_id')
  if (!intentObj.intent_type) errors.push('Missing intent_type')
  if (!intentObj.subject) errors.push('Missing subject')
  if (!intentObj.target_assets || intentObj.target_assets.length === 0) {
    errors.push('No target_assets specified')
  }
  if (!intentObj.spatial_constraints) errors.push('Missing spatial_constraints')

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 根据意图文本推断主题
 * @param {string} text
 * @returns {string}
 */
function inferSubject(text) {
  if (text.includes('心脏')) return '可交互心脏结构教学场景'
  if (text.includes('眼镜')) return '智能眼镜产品结构演示场景'
  if (text.includes('维护') || text.includes('设备')) return '设备维护流程培训场景'
  if (text.includes('教学')) return '混合现实教学内容场景'
  if (text.includes('演示')) return '混合现实产品演示场景'
  if (text.includes('培训')) return '混合现实培训流程场景'
  return '混合现实内容生成场景'
}

/**
 * 主入口：解析用户意图
 * @param {string} text - 自然语言意图描述
 * @param {Object} options - 可选配置
 * @param {string} options.intentType - 意图类型
 * @param {string} options.anchor - 空间锚点
 * @param {string} options.assetProfile - 资产生成配置
 * @param {string} options.language - 语言
 * @returns {ParseResult}
 */
export function parseIntent(text, options = {}) {
  const {
    intentType = null,
    anchor = AnchorType.TABLE_CENTER,
    assetProfile = AssetProfile.MODEL_WITH_LABELS_AUDIO,
    language = Language.ZH_CN
  } = options

  const steps = []
  let totalConfidence = 0

  // Step 1: 预处理
  const preResult = preprocess(text)
  steps.push({
    step: 'Preprocess',
    input: text.slice(0, 50),
    output: { normalized: preResult.normalized.slice(0, 50), tokenCount: preResult.tokens.length },
    confidence: 1.0
  })

  // Step 2: 意图分类
  const classifyResult = classifyIntent(preResult.normalized)
  steps.push({
    step: 'Classify',
    input: preResult.normalized.slice(0, 30),
    output: { type: classifyResult.type, matched: classifyResult.matched },
    confidence: classifyResult.confidence
  })
  totalConfidence += classifyResult.confidence

  // Step 3: 实体抽取
  const entities = extractEntities(preResult.normalized)
  steps.push({
    step: 'NER',
    input: preResult.normalized.slice(0, 30),
    output: {
      objects: entities.objects,
      actions: entities.actions,
      spatial: entities.spatial,
      attributes: entities.attributes
    },
    confidence: 0.85
  })
  totalConfidence += 0.85

  // Step 4: 参数映射
  const inferredType = intentType || classifyResult.type
  const params = mapToParams(entities, inferredType, assetProfile)
  steps.push({
    step: 'Map',
    input: 'entities',
    output: { targetAssets: params.target_assets, ruleCount: params.interaction_rules.length },
    confidence: 0.9
  })
  totalConfidence += 0.9

  // Step 5: 组装IntentObject
  const intentObj = createDefaultIntentObject()
  intentObj.intent_id = generateIntentId()
  intentObj.intent_type = inferredType
  intentObj.subject = inferSubject(preResult.normalized)
  intentObj.target_assets = params.target_assets
  intentObj.spatial_constraints.anchor = entities.spatial[0] || anchor
  intentObj.interaction_rules = params.interaction_rules

  // Step 6: 校验
  const validationResult = validate(intentObj)
  steps.push({
    step: 'Validate',
    input: 'intentObj',
    output: { valid: validationResult.valid, errors: validationResult.errors },
    confidence: validationResult.valid ? 1.0 : 0.5
  })
  totalConfidence += validationResult.valid ? 1.0 : 0.5

  // 计算平均置信度
  const avgConfidence = totalConfidence / steps.length

  return {
    intentObj,
    steps,
    confidence: avgConfidence
  }
}

/**
 * 获取模板列表
 * @returns {Object[]}
 */
export function getTemplates() {
  return Object.entries(TEMPLATES).map(([key, value]) => ({
    id: key,
    ...value
  }))
}

/**
 * 使用模板解析
 * @param {string} templateId
 * @returns {ParseResult}
 */
export function parseFromTemplate(templateId) {
  const template = TEMPLATES[templateId]
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }
  return parseIntent(template.text, {
    intentType: template.type,
    anchor: template.anchor,
    assetProfile: template.assetProfile,
    language: template.language
  })
}

/**
 * 获取解析状态
 * @returns {Object}
 */
export function getIntentParserStatus() {
  return {
    status: 'ready',
    version: 'Phase 1.1',
    supportedTypes: Object.values(IntentType),
    supportedAnchors: Object.values(AnchorType),
    templates: Object.keys(TEMPLATES),
    features: [
      'preprocess',
      'classify',
      'ner',
      'map',
      'validate',
      'confidence_scoring',
      'template_support'
    ]
  }
}

export default { parseIntent, getTemplates, parseFromTemplate, getIntentParserStatus }