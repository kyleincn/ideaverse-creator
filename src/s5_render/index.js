/**
 * S5: MR引擎渲染模块
 * 功能：基于Unity3D实现MR场景的实时渲染
 *
 * Phase 1增强版：
 * - 提供Unity C#脚本框架
 * - 提供场景配置JSON（带完整asset元数据）
 * - 增强的空间约束描述
 * - 交互规则条件表达式
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
    phase: 'Phase 1',
    engine: 'Unity3D',
    engine_version: '2021.3.31f1c1',
    pipeline: 'URP',
    xr_enabled: true,
    platforms: ['StandaloneWindows64', 'iOS', 'Android'],
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
 * 生成Unity场景配置
 * @param {Object} intentObj - IntentObject
 * @param {Object} bundle - SceneLogicBundle
 * @param {Array} assetRecords - 资产记录
 * @returns {Object} Unity场景配置
 */
export function generateUnitySceneConfig(intentObj, bundle, assetRecords) {
  const assetMap = new Map(assetRecords.map(r => [r.type, r]))

  const config = {
    // 场景基本信息
    scene_name: `IV_Scene_${intentObj.intent_id}`,
    intent_id: intentObj.intent_id,
    created_at: new Date().toISOString(),
    version: '1.0.0',
    generator: 'IdeaVerse Creator Phase 1',

    // 空间配置
    spatial: {
      anchor_type: intentObj.spatial_constraints.anchor,
      placement: intentObj.spatial_constraints.placement,
      height_offset_m: intentObj.spatial_constraints.height_offset_m,
      scale: intentObj.spatial_constraints.scale,
      scale_value: parseFloat(intentObj.spatial_constraints.scale) || 1.2,
      orientation: intentObj.spatial_constraints.orientation,
      safe_distance_m: intentObj.spatial_constraints.safe_distance_m,
      // 额外的空间元数据
      bounding_box_m: {
        width: parseFloat(intentObj.spatial_constraints.scale) || 1.2,
        height: parseFloat(intentObj.spatial_constraints.scale) * 0.8 || 0.96,
        depth: parseFloat(intentObj.spatial_constraints.scale) * 0.6 || 0.72
      }
    },

    // 资产清单（带完整元数据）
    assets: assetRecords.map(r => ({
      id: r.id,
      type: r.type,
      filename: r.filename,
      path: r.path.replace(/^.*workspace/, 'workspace'),
      format: r.format,
      version: r.version,
      hash: r.hash,
      size_bytes: r.size_bytes || 0,
      // Unity预制件路径
      unity_prefab_path: `Prefabs/${r.type}/${r.filename.replace(/\.[^.]+$/, '')}.prefab`
    })),

    // 交互规则（增强）
    rules: bundle.rules.map(rule => {
      // 解析触发条件
      const triggerParse = parseTriggerExpression(rule.trigger)

      return {
        rule_id: rule.rule_id,
        // 原始触发描述
        trigger: rule.trigger,
        // 结构化触发器
        trigger_parsed: {
          type: triggerParse.type,
          target: triggerParse.target,
          condition: triggerParse.condition
        },
        trigger_asset_id: rule.trigger_asset_id || null,
        condition: rule.condition,
        condition_expression: rule.condition || 'true',
        processor: rule.processor || 'default',
        action: rule.action,
        action_count: rule.action.length,
        feedback: rule.feedback,
        feedback_type: rule.feedback ? rule.feedback.split('_')[0] : 'none'
      }
    }),

    // 交互配置
    interaction: {
      enable_gesture: true,
      enable_gaze: true,
      enable_voice: false,
      enable_proximity: true,
      // 手势识别配置
      gesture_config: {
        tap_threshold_ms: 200,
        hold_threshold_ms: 500,
        swipe_threshold_px: 50
      },
      // 注视配置
      gaze_config: {
        dwell_time_ms: 1000,
        fallback_time_ms: 3000
      },
      // 接近配置
      proximity_config: {
        near_threshold_m: 0.5,
        far_threshold_m: 1.5,
        trigger_distance_m: 0.8
      }
    },

    // MR平台配置
    platform: {
      target: 'Unity3D 2021.3.31f1',
      pipeline: 'URP',
      xrsdk: 'XR Interaction Toolkit',
      supported_platforms: ['StandaloneWindows64', 'iOS', 'Android'],
      shading_quality: 'High'
    },

    // 调试信息
    debug: {
      pipeline_version: 'Phase 1',
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
 * 解析触发表达式
 * @param {string} trigger - 触发表达式
 * @returns {Object}
 */
function parseTriggerExpression(trigger) {
  // 格式: user_tap(target: primary_object) 或 user_gaze(target: xxx, dwell: 1000ms)
  const result = { type: 'unknown', target: null, condition: null }

  if (!trigger) return result

  // 提取触发类型
  const typeMatch = trigger.match(/^(user_\w+)/)
  if (typeMatch) {
    result.type = typeMatch[1].replace('user_', '')
  }

  // 提取target参数
  const targetMatch = trigger.match(/target:\s*(\w+)/)
  if (targetMatch) {
    result.target = targetMatch[1]
  }

  // 提取条件
  const condMatch = trigger.match(/,\s*(\w+):\s*[\w]+/)
  if (condMatch) {
    result.condition = condMatch[1]
  }

  return result
}

/**
 * 保存Unity场景配置到文件
 * @param {Object} config
 * @returns {string} 配置文件路径
 */
export function saveSceneConfig(config) {
  const configDir = path.resolve(__dirname, '../../workspace/registry')
  const configPath = path.join(configDir, `${config.scene_name}.json`)

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  console.log('[S5] Scene config saved:', configPath)

  return configPath
}

/**
 * 运行模拟渲染（Phase 1增强版）
 * @param {Object} intentObj
 * @param {Object} bundle
 * @param {Array} assetRecords
 */
export function simulateRender(intentObj, bundle, assetRecords) {
  console.log('[S5] === Unity MR Scene Generation (Phase 1) ===')
  console.log('[S5] Scene:', intentObj.subject)
  console.log('[S5] Intent ID:', intentObj.intent_id)
  console.log('[S5] Intent Type:', intentObj.intent_type)
  console.log('[S5] Spatial anchor:', intentObj.spatial_constraints.anchor)
  console.log('[S5] Scale:', intentObj.spatial_constraints.scale)
  console.log('[S5] Loading', assetRecords.length, 'assets into MR scene...')

  for (const asset of assetRecords) {
    console.log('[S5]   → Asset:', asset.type, asset.filename)
    console.log('[S5]      Path:', asset.path)
    console.log('[S5]      Hash:', asset.hash ? asset.hash.slice(0, 16) + '...' : 'N/A')
    console.log('[S5]      Size:', (asset.size_bytes || 0), 'bytes')
  }

  console.log('[S5] Binding', bundle.rules.length, 'interaction rules...')
  for (const rule of bundle.rules) {
    console.log('[S5]   → Rule:', rule.rule_id)
    console.log('[S5]       Trigger:', rule.trigger)
    console.log('[S5]       Condition:', rule.condition || 'none')
    console.log('[S5]       Actions:', rule.action.length, 'items')
    console.log('[S5]       Feedback:', rule.feedback || 'none')
  }

  console.log('[S5] XR Interaction enabled:')
  console.log('[S5]   - Gesture tracking: ON')
  console.log('[S5]   - Gaze detection: ON')
  console.log('[S5]   - Proximity sensing: ON')
  console.log('[S5]   - Voice commands: OFF (Phase 2)')
  console.log('[S5] Target Platform: Unity 2021.3.31f1 (URP)')
  console.log('[S5] === MR Scene Ready for Deployment ===')

  const config = generateUnitySceneConfig(intentObj, bundle, assetRecords)
  saveSceneConfig(config)

  console.log('[S5] Scene config includes:')
  console.log('[S5]   -', config.assets.length, 'assets with metadata')
  console.log('[S5]   -', config.rules.length, 'rules with parsed triggers')
  console.log('[S5]   - Platform:', config.platform.target)
  console.log('[S5]   - Pipeline:', config.platform.pipeline)

  return config
}

export default { getRenderStatus, generateUnitySceneConfig, saveSceneConfig, simulateRender }