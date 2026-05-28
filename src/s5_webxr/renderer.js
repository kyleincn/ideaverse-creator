/**
 * S5 Web Renderer: 生成 Three.js/WebXR 场景配置
 * 功能：为 Web 浏览器生成 MR 场景配置
 *
 * Phase 1 Web版本：
 * - 生成 Three.js 兼容的场景配置
 * - 支持 WebXR 交互规范
 * - 替代 Unity 配置
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * S5模块状态
 */
export function getRenderStatus() {
  return {
    status: 'ready',
    phase: 'Phase 1 Web',
    engine: 'Three.js',
    engine_version: 'r160',
    webxr: true,
    platforms: ['WebGL2', 'WebXR'],
    features: {
      spatial_anchoring: true,
      gesture_tracking: true,
      gaze_detection: true,
      proximity_sensing: true,
      voice_commands: false
    }
  }
}

/**
 * 生成 WebXR 场景配置
 * @param {Object} intentObj - IntentObject
 * @param {Object} bundle - SceneLogicBundle
 * @param {Array} assetRecords - 资产记录
 * @returns {Object} WebXR场景配置
 */
export function generateWebXRSceneConfig(intentObj, bundle, assetRecords) {
  const config = {
    // 场景基本信息
    scene_name: `IV_Scene_${intentObj.intent_id}`,
    intent_id: intentObj.intent_id,
    created_at: new Date().toISOString(),
    version: '1.0.0',
    generator: 'IdeaVerse Creator Phase 1 Web',

    // 场景类型
    scene_type: intentObj.intent_type, // EDUCATION, DEMO, INTERACTION

    // 空间配置（用于 Three.js 定位）
    spatial: {
      anchor_type: intentObj.spatial_constraints.anchor,
      placement: intentObj.spatial_constraints.placement,
      height_offset_m: intentObj.spatial_constraints.height_offset_m || 0.35,
      scale: intentObj.spatial_constraints.scale || '1.2m',
      scale_value: parseFloat(intentObj.spatial_constraints.scale) || 1.2,
      orientation: intentObj.spatial_constraints.orientation || 'face_user',
      safe_distance_m: intentObj.spatial_constraints.safe_distance_m || 0.6,
      // Three.js-specific
      position: { x: 0, y: intentObj.spatial_constraints.height_offset_m || 0.35, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      bounding_box: {
        width: parseFloat(intentObj.spatial_constraints.scale) || 1.2,
        height: (parseFloat(intentObj.spatial_constraints.scale) || 1.2) * 0.8,
        depth: (parseFloat(intentObj.spatial_constraints.scale) || 1.2) * 0.6
      }
    },

    // 资产清单（Three.js 兼容格式）
    assets: assetRecords.map(r => ({
      id: r.id,
      type: r.type,
      filename: r.filename,
      path: r.path.replace(/^.*workspace/, 'workspace'),
      format: r.format,
      version: r.version,
      hash: r.hash,
      size_bytes: r.size_bytes || 0,
      // Three.js 加载配置
      loader_config: getLoaderConfigForType(r.type),
      // 场景对象配置
      object_config: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.0,
        visible: true
      }
    })),

    // 交互规则（WebXR 兼容格式）
    rules: bundle.rules.map(rule => {
      const triggerParse = parseTriggerExpression(rule.trigger)

      return {
        rule_id: rule.rule_id,
        // 原始触发
        trigger: rule.trigger,
        // 解析后的触发器
        trigger_parsed: {
          type: triggerParse.type,
          event: triggerParse.event, // click, hover, proximity, etc.
          target: triggerParse.target,
          params: triggerParse.params
        },
        trigger_asset_id: rule.trigger_asset_id || null,
        condition: rule.condition || 'true',
        condition_expression: rule.condition || 'true',
        processor: rule.processor || { type: 'default' },
        // 动作列表
        actions: rule.action.map((a, idx) => {
          if (typeof a === 'object' && a.type) {
            return {
              index: idx,
              type: a.type,
              target: a.target || a.asset_id || null,
              params: extractActionParams(a)
            }
          }
          // 字符串格式
          return {
            index: idx,
            type: a.toUpperCase().split('(')[0]?.replace(/[^A-Z_]/g, '') || 'UNKNOWN',
            target: a,
            params: {}
          }
        }),
        feedback: rule.feedback || 'none'
      }
    }),

    // 交互配置
    interaction: {
      enable_gesture: true,
      enable_gaze: true,
      enable_voice: false,
      enable_proximity: true,
      // WebXR 交互参数
      raycaster: {
        enabled: true,
        threshold: 0.05
      },
      gesture_config: {
        tap_threshold_ms: 200,
        hold_threshold_ms: 500,
        swipe_threshold_px: 50
      },
      gaze_config: {
        dwell_time_ms: 1000,
        fallback_time_ms: 3000
      },
      proximity_config: {
        near_threshold_m: 0.5,
        far_threshold_m: 1.5,
        trigger_distance_m: 0.8
      }
    },

    // WebXR 配置
    webxr: {
      mode: 'AR', // AR, VR, or BOTH
      session_options: {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor']
      },
      controllers: {
        left_hand: true,
        right_hand: true,
        hand_tracking: true
      }
    },

    // Three.js 配置
    threejs: {
      antialias: true,
      alpha: true,
      shadow_enabled: true,
      tone_mapping: 'ACESFilmicToneMapping',
      exposure: 1.0,
      background_color: '#111111'
    },

    // 调试信息
    debug: {
      pipeline_version: 'Phase 1 Web',
      generated_at: new Date().toISOString(),
      intent_type: intentObj.intent_type,
      subject: intentObj.subject,
      asset_count: assetRecords.length,
      rule_count: bundle.rules.length
    }
  }

  return config
}

/**
 * 根据资产类型获取 Three.js loader 配置
 * @param {string} type
 * @returns {Object}
 */
function getLoaderConfigForType(type) {
  const loaders = {
    MODEL_3D: {
      loader: 'GLTFLoader',
      format: 'glb',
      options: {
        load_materials: true,
        apply_skinning: false
      }
    },
    AUDIO: {
      loader: 'AudioLoader',
      format: 'wav',
      options: {
        loop: false,
        autoplay: false
      }
    },
    UI_LABEL: {
      loader: 'SpriteLoader',
      format: 'canvas',
      options: {}
    },
    UI_PANEL: {
      loader: 'PlaneGeometry',
      format: 'json',
      options: {}
    },
    ANIMATION: {
      loader: 'AnimationMixer',
      format: 'glb',
      options: {}
    }
  }
  return loaders[type] || { loader: 'unknown' }
}

/**
 * 解析触发表达式
 * @param {string} trigger
 * @returns {Object}
 */
function parseTriggerExpression(trigger) {
  const result = { type: 'unknown', event: 'click', target: null, params: {} }

  if (!trigger) return result

  // 触发类型映射
  const triggerMap = {
    'user_tap': { type: 'tap', event: 'click' },
    'user_click': { type: 'click', event: 'click' },
    'user_gaze': { type: 'gaze', event: 'hover' },
    'user_hover': { type: 'hover', event: 'hover' },
    'user_proximity': { type: 'proximity', event: 'proximity' }
  }

  // 提取触发类型
  const typeMatch = trigger.match(/^(user_\w+)/)
  if (typeMatch) {
    const mapped = triggerMap[typeMatch[1]] || { type: typeMatch[1], event: 'click' }
    result.type = mapped.type
    result.event = mapped.event
  }

  // 提取 target
  const targetMatch = trigger.match(/target:\s*(\w+)/)
  if (targetMatch) {
    result.target = targetMatch[1]
  }

  // 提取距离参数
  const distanceMatch = trigger.match(/distance\s*<?\s*(\d+\.?\d*)/)
  if (distanceMatch) {
    result.params.distance = parseFloat(distanceMatch[1])
  }

  // 提取驻留时间
  const dwellMatch = trigger.match(/dwell:\s*(\d+)(ms|s)?/)
  if (dwellMatch) {
    const value = parseInt(dwellMatch[1])
    const unit = dwellMatch[2] || 'ms'
    result.params.dwell = unit === 's' ? value * 1000 : value
  }

  return result
}

/**
 * 从动作对象提取参数
 * @param {Object} action
 * @returns {Object}
 */
function extractActionParams(action) {
  const params = {}
  if (action.target) params.target = action.target
  if (action.asset_id) params.asset_id = action.asset_id
  if (action.asset_path) params.asset_path = action.asset_path
  if (action.content) params.content = action.content
  return params
}

/**
 * 保存 WebXR 场景配置
 * @param {Object} config
 * @returns {string} 配置文件路径
 */
export function saveSceneConfig(config) {
  const configDir = path.resolve(__dirname, '../../workspace/registry')
  const configPath = path.join(configDir, `${config.scene_name}.webxr.json`)

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  console.log('[S5 Web] Scene config saved:', configPath)

  return configPath
}

/**
 * 运行模拟渲染
 * @param {Object} intentObj
 * @param {Object} bundle
 * @param {Array} assetRecords
 */
export function simulateRender(intentObj, bundle, assetRecords) {
  console.log('[S5 Web] === WebXR Scene Generation (Phase 1) ===')
  console.log('[S5 Web] Scene:', intentObj.subject)
  console.log('[S5 Web] Intent ID:', intentObj.intent_id)
  console.log('[S5 Web] Intent Type:', intentObj.intent_type)
  console.log('[S5 Web] Spatial anchor:', intentObj.spatial_constraints.anchor)
  console.log('[S5 Web] Scale:', intentObj.spatial_constraints.scale)
  console.log('[S5 Web] Loading', assetRecords.length, 'assets into WebXR scene...')

  for (const asset of assetRecords) {
    console.log('[S5 Web]   → Asset:', asset.type, asset.filename)
    console.log('[S5 Web]      Path:', asset.path)
    console.log('[S5 Web]      Hash:', asset.hash ? asset.hash.slice(0, 16) + '...' : 'N/A')
  }

  console.log('[S5 Web] Binding', bundle.rules.length, 'interaction rules...')
  for (const rule of bundle.rules) {
    console.log('[S5 Web]   → Rule:', rule.rule_id)
    console.log('[S5 Web]       Trigger:', rule.trigger)
    console.log('[S5 Web]       Condition:', rule.condition || 'none')
    console.log('[S5 Web]       Actions:', rule.action.length, 'items')
  }

  console.log('[S5 Web] Interaction enabled:')
  console.log('[S5 Web]   - Gesture tracking: ON (via raycaster)')
  console.log('[S5 Web]   - Gaze detection: ON')
  console.log('[S5 Web]   - Proximity sensing: ON')
  console.log('[S5 Web]   - Voice commands: OFF (Phase 2)')
  console.log('[S5 Web] WebXR mode: AR with hand-tracking')
  console.log('[S5 Web] === WebXR Scene Ready ===')

  const config = generateWebXRSceneConfig(intentObj, bundle, assetRecords)
  saveSceneConfig(config)

  console.log('[S5 Web] Scene config includes:')
  console.log('[S5 Web]   -', config.assets.length, 'assets with Three.js loader config')
  console.log('[S5 Web]   -', config.rules.length, 'rules with WebXR event mapping')
  console.log('[S5 Web]   - Engine: Three.js r160')
  console.log('[S5 Web]   - WebXR: AR mode with hand-tracking')

  return config
}

export default { getRenderStatus, generateWebXRSceneConfig, saveSceneConfig, simulateRender }