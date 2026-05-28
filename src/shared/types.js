/**
 * IdeaVerse Creator - 共享类型定义
 * 对应专利规格书 Section 11 接口与数据规范
 */

/**
 * IntentObject - S1模块输出，S2-S5模块的核心输入
 * @typedef {Object} IntentObject
 */

/**
 * Intent类型枚举
 * @type {Object}
 */
export const IntentType = {
  EDUCATION: 'EDUCATION',
  DEMO: 'DEMO',
  INTERACTION: 'INTERACTION'
}

/**
 * 空间锚点类型
 * @type {Object}
 */
export const AnchorType = {
  TABLE_CENTER: 'table_center',
  WALL_ANCHOR: 'wall_anchor',
  FLOOR_PLANE: 'floor_plane',
  HAND_TRACKING_SPACE: 'hand_tracking_space'
}

/**
 * 资产生成配置类型
 * @type {Object}
 */
export const AssetProfile = {
  MODEL_WITH_LABELS_AUDIO: '3D Model + Labels + Audio',
  MODEL_WITH_UI_PANEL: '3D Model + UI Panel',
  ANIMATION_WITH_RULES: 'Animation + Interaction Rule'
}

/**
 * 语言枚举
 * @type {Object}
 */
export const Language = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US',
  JA_JP: 'ja-JP'
}

/**
 * 模板配置预设
 * @type {Object}
 */
export const TEMPLATES = {
  medical: {
    name: '医学教学',
    description: '模型标注、路径高亮、语音讲解',
    text: '创建一个用于心脏解剖教学的混合现实场景：在桌面中央悬浮显示透明心脏模型，标注主动脉和心室；学生点击主动脉时高亮血流路径，并播放 15 秒中文讲解音频。',
    type: 'EDUCATION',
    anchor: 'table_center',
    assetProfile: '3D Model + Labels + Audio',
    language: 'zh-CN'
  },
  product: {
    name: '产品演示',
    description: '结构拆解、部件说明、交互热点',
    text: '生成一个智能眼镜产品演示场景：在展台上方展示可拆解 3D 模型，点击镜腿时展开传感器说明卡片，并播放佩戴方式动画。',
    type: 'DEMO',
    anchor: 'table_center',
    assetProfile: '3D Model + UI Panel',
    language: 'zh-CN'
  },
  training: {
    name: '流程培训',
    description: '步骤引导、任务检查、动作反馈',
    text: '创建设备维护流程培训：在真实设备旁按步骤显示操作指引，学员靠近阀门时提示检查压力，完成后给出绿色反馈。',
    type: 'INTERACTION',
    anchor: 'floor_plane',
    assetProfile: 'Animation + Interaction Rule',
    language: 'zh-CN'
  }
}

/**
 * 生成默认的IntentObject结构
 * @returns {IntentObject}
 */
export function createDefaultIntentObject() {
  return {
    intent_id: generateIntentId(),
    intent_type: IntentType.EDUCATION,
    subject: '',
    target_assets: [],
    spatial_constraints: {
      anchor: AnchorType.TABLE_CENTER,
      placement: 'float_above_table_center',
      height_offset_m: 0.35,
      scale: '1.2m',
      orientation: 'face_user',
      safe_distance_m: 0.6
    },
    interaction_rules: []
  }
}

/**
 * 生成意图ID，格式：IV-S1-YYYYMMDD-NNNN
 * @returns {string}
 */
export function generateIntentId() {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `IV-S1-${dateStr}-${seq}`
}

/**
 * AssetRecord - 资产注册记录
 * @typedef {Object} AssetRecord
 * @property {string} id - UUID v4
 * @property {string} path - 资产路径
 * @property {string} version - 语义化版本 e.g. 1.0.0
 * @property {string} hash - SHA256
 * @property {IntentObject} generation_params - 生成时使用的IntentObject
 * @property {string} created_at - ISO 8601
 * @property {string} updated_at - ISO 8601
 */

/**
 * SceneLogicBundle - S4模块输出，S5模块直接使用
 * @typedef {Object} SceneLogicBundle
 */

/**
 * 多类型资产包 - S2模块输出
 * @typedef {Object} MultiAssetPackage
 */