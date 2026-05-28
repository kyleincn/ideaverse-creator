/**
 * S2: 多模态AI生成调度模块
 * 功能：根据IntentObject编排调度AI服务，生成多类型资产
 *
 * Phase 1增强版：
 * - 真实AI服务集成框架
 * - 支持Text-to-3D、MiniMax TTS、UI生成
 * - 可配置API密钥和服务端点
 * - 模拟模式（无API Key时）
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { createDefaultIntentObject } from '../shared/types.js'
import { API_CONFIG } from '../config/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * AI服务配置
 * 使用 src/config/api.js 中的配置
 */
const AI_CONFIG = {
  // Text-to-3D 服务 (Meshy/Tripo3D)
  text_to_3d: {
    enabled: API_CONFIG.text_to_3d.enabled,
    api_key: API_CONFIG.text_to_3d.api_key,
    endpoint: API_CONFIG.text_to_3d.endpoint,
    model: API_CONFIG.text_to_3d.model
  },

  // MiniMax TTS
  tts_minimax: {
    enabled: API_CONFIG.tts_minimax.enabled,
    api_key: API_CONFIG.tts_minimax.api_key,
    group_id: API_CONFIG.tts_minimax.group_id,
    endpoint: API_CONFIG.tts_minimax.endpoint,
    model: API_CONFIG.tts_minimax.model,
    voice_id: API_CONFIG.tts_minimax.voice_id
  },

  // OpenAI TTS (备用)
  tts_openai: {
    enabled: API_CONFIG.tts.enabled,
    api_key: API_CONFIG.tts.api_key,
    endpoint: API_CONFIG.tts.endpoint,
    model: API_CONFIG.tts.model,
    voice: API_CONFIG.tts.voice
  },

  // UI生成服务
  ui_generation: {
    enabled: false, // Phase 1 暂不启用
    api_key: '',
    endpoint: ''
  },

  // ModelConverter v2.6
  model_converter: {
    version: API_CONFIG.model_converter.version,
    enabled: API_CONFIG.model_converter.enabled,
    path: API_CONFIG.model_converter.path
  }
}

/**
 * 预设资产映射表（模拟模式）
 * 键名格式：intentType:subject
 */
const PRESET_ASSETS = {
  'EDUCATION:可交互心脏结构教学场景': {
    model: 'heart_transparent.glb',
    audio: 'heart_explanation_zh_cn_15s.wav',
    labels: 'heart_anatomy_labels.json'
  },
  'EDUCATION:可交互心脏结构教学场景_tap': {
    model: 'heart_transparent.glb',
    audio: 'heart_explanation_zh_cn_15s.wav',
    labels: 'heart_anatomy_labels.json'
  },
  'DEMO:智能眼镜产品结构演示场景': {
    model: 'smart_glasses_exploded.glb',
    ui: 'glasses_component_cards.json'
  },
  'INTERACTION:设备维护流程培训场景': {
    model: 'valve_unit.glb',
    labels: 'maintenance_steps.json',
    animation: 'procedure_sequence.timeline'
  }
}

// 默认资产（兜底）
const DEFAULT_ASSETS = {
  model: 'default_cube.glb',
  labels: 'default_labels.json'
}

/**
 * 查询预设资产
 * @param {string} intentType
 * @param {string} subject
 * @returns {Object}
 */
function getPresetAssets(intentType, subject) {
  const key1 = `${intentType}:${subject}`
  if (PRESET_ASSETS[key1]) return PRESET_ASSETS[key1]

  for (const [key, assets] of Object.entries(PRESET_ASSETS)) {
    if (key.startsWith(intentType + ':')) return assets
  }

  return DEFAULT_ASSETS
}

/**
 * 调用Text-to-3D AI服务
 * @param {string} description - 3D模型描述
 * @returns {Promise<Object>} 生成结果
 */
async function callTextTo3DService(description) {
  if (!AI_CONFIG.text_to_3d.enabled) {
    console.log('[S2] Text-to-3D: Mock mode (no API key)')
    return { mock: true, model_url: 'placeholder://text-to-3d/' + description.slice(0, 20) }
  }

  console.log('[S2] Calling Text-to-3D service:', description.slice(0, 50) + '...')

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      prompt: description,
      style: 'realistic',
      model: AI_CONFIG.text_to_3d.model
    })

    const url = new URL(AI_CONFIG.text_to_3d.endpoint)
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.text_to_3d.api_key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const req = (url.protocol === 'https:' ? https : http).request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log('[S2] Text-to-3D result:', result.task_id || 'success')
          resolve({ task_id: result.task_id, status: 'queued' })
        } catch (err) {
          reject(err)
        }
      })
    })

    req.on('error', err => {
      console.warn('[S2] Text-to-3D API error, falling back to mock:', err.message)
      resolve({ mock: true, model_url: 'placeholder://text-to-3d/' + description.slice(0, 20) })
    })

    req.write(payload)
    req.end()
  })
}

/**
 * 调用TTS服务 (支持 MiniMax / OpenAI)
 * @param {string} text - 要转换的文本
 * @param {string} language - 语言代码
 * @returns {Promise<Object>} 生成结果
 */
async function callTTSService(text, language = 'zh-CN') {
  // 优先使用 MiniMax
  if (AI_CONFIG.tts_minimax.enabled) {
    return callMiniMaxTTS(text)
  }

  // 备用 OpenAI TTS
  if (AI_CONFIG.tts_openai.enabled) {
    return callOpenAITTS(text)
  }

  console.log('[S2] TTS: Mock mode (no API key)')
  return { mock: true, audio_url: 'placeholder://tts/' + text.slice(0, 20) }
}

/**
 * 调用 MiniMax TTS API
 * @param {string} text - 要转换的文本
 * @returns {Promise<Object>}
 */
async function callMiniMaxTTS(text) {
  console.log('[S2] Calling MiniMax TTS:', text.slice(0, 30) + '...')

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: AI_CONFIG.tts_minimax.model,
      text: text,
      stream: false,
      voice_setting: {
        voice_id: AI_CONFIG.tts_minimax.voice_id,
        speed: 1.0,
        volume: 1.0,
        pitch: 0
      },
      audio_setting: {
        audio_format: 'wav',
        sample_rate: 32000
      }
    })

    const url = new URL(AI_CONFIG.tts_minimax.endpoint)
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.tts_minimax.api_key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'GroupId': AI_CONFIG.tts_minimax.group_id
      }
    }

    const req = https.request(options, (res) => {
      const contentType = res.headers['content-type'] || ''

      if (contentType.includes('application/json')) {
        // Error response
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            console.warn('[S2] MiniMax TTS API error:', json.base_resp?.status_msg || data)
            resolve({ mock: true, audio_url: 'placeholder://tts/' + text.slice(0, 20) })
          } catch {
            console.warn('[S2] MiniMax TTS parse error')
            resolve({ mock: true, audio_url: 'placeholder://tts/' + text.slice(0, 20) })
          }
        })
      } else {
        // Audio response
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const audioData = Buffer.concat(chunks)
          console.log('[S2] MiniMax TTS result: received', audioData.length, 'bytes')
          resolve({ mock: false, audio_data: audioData, format: 'wav' })
        })
      }
    })

    req.on('error', err => {
      console.warn('[S2] MiniMax TTS API error:', err.message)
      resolve({ mock: true, audio_url: 'placeholder://tts/' + text.slice(0, 20) })
    })

    req.write(payload)
    req.end()
  })
}

/**
 * 调用 OpenAI TTS API
 * @param {string} text - 要转换的文本
 * @returns {Promise<Object>}
 */
async function callOpenAITTS(text) {
  console.log('[S2] Calling OpenAI TTS:', text.slice(0, 30) + '...')

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: AI_CONFIG.tts_openai.model,
      voice: AI_CONFIG.tts_openai.voice,
      input: text,
      response_format: 'wav'
    })

    const url = new URL(AI_CONFIG.tts_openai.endpoint)
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.tts_openai.api_key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const req = (url.protocol === 'https:' ? https : http).request(options, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        console.log('[S2] OpenAI TTS result: received', chunks.reduce((sum, c) => sum + c.length, 0), 'bytes')
        resolve({ mock: false, audio_data: Buffer.concat(chunks), format: 'wav' })
      })
    })

    req.on('error', err => {
      console.warn('[S2] OpenAI TTS API error:', err.message)
      resolve({ mock: true, audio_url: 'placeholder://tts/' + text.slice(0, 20) })
    })

    req.write(payload)
    req.end()
  })
}

/**
 * 主入口：调度资产生成
 * @param {IntentObject} intentObj
 * @returns {Promise<Object>} MultiAssetPackage
 */
export async function dispatchGeneration(intentObj) {
  const { intent_type, subject, target_assets, description } = intentObj

  console.log('[S2] Starting AI dispatch for:', intent_type, subject)
  console.log('[S2] AI Services config:', {
    text_to_3d: AI_CONFIG.text_to_3d.enabled ? 'enabled' : 'mock',
    tts_minimax: AI_CONFIG.tts_minimax.enabled ? 'enabled' : 'mock',
    tts_openai: AI_CONFIG.tts_openai.enabled ? 'enabled' : 'mock',
    model_converter: AI_CONFIG.model_converter.version
  })

  // 模拟AI生成延迟
  await simulateDelay(800)

  // 根据target_assets决定输出哪些资产
  const package_ = {
    intent_id: intentObj.intent_id,
    generated_at: new Date().toISOString(),
    assets: []
  }

  for (const assetSpec of target_assets) {
    const [type, param] = assetSpec.split(':')
    const assetInfo = await generateAsset(type, param, intentObj)
    if (assetInfo) {
      package_.assets.push(assetInfo)
    }
  }

  console.log('[S2] Generated', package_.assets.length, 'assets')
  return package_
}

/**
 * 生成单个资产
 * @param {string} type - 资产类型
 * @param {string} param - 资产参数
 * @param {IntentObject} intentObj - 意图对象
 * @returns {Promise<Object>}
 */
async function generateAsset(type, param, intentObj) {
  const workspaceRoot = path.resolve(__dirname, '../../workspace/assets')

  switch (type) {
    case 'MODEL_3D': {
      // 调用Text-to-3D服务或使用预设
      const preset = getPresetAssets(intentObj.intent_type, intentObj.subject)
      const modelFile = preset.model || param || DEFAULT_ASSETS.model

      // 如果配置了真实服务
      if (AI_CONFIG.text_to_3d.enabled && intentObj.description) {
        const result = await callTextTo3DService(intentObj.description)
        if (!result.mock) {
          // 真实服务返回，需要下载模型
          console.log('[S2] Would download model from:', result.task_id)
        }
      }

      return {
        type: 'MODEL_3D',
        filename: modelFile,
        path: path.join(workspaceRoot, 'models', modelFile),
        format: 'GLB'
      }
    }

    case 'AUDIO': {
      const preset = getPresetAssets(intentObj.intent_type, intentObj.subject)
      const audioFile = preset.audio || param

      // 如果配置了真实TTS服务
      if ((AI_CONFIG.tts_minimax.enabled || AI_CONFIG.tts_openai.enabled) && intentObj.description) {
        // 生成描述文本的语音版本
        const descriptionText = `这是一个关于${intentObj.subject}的教学内容。`
        const result = await callTTSService(descriptionText)
        if (!result.mock && result.audio_data) {
          console.log('[S2] TTS audio generated, size:', result.audio_data.length, 'bytes')
          // 保存真实音频文件
          const audioPath = path.join(workspaceRoot, 'audio', audioFile || 'narration.wav')
          const fs = await import('fs')
          const audioDir = path.dirname(audioPath)
          if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true })
          }
          fs.writeFileSync(audioPath, result.audio_data)
          console.log('[S2] TTS audio saved to:', audioPath)
        }
      }

      return {
        type: 'AUDIO',
        filename: audioFile || 'narration.wav',
        path: path.join(workspaceRoot, 'audio', audioFile || 'narration.wav'),
        format: 'WAV',
        duration_s: 15
      }
    }

    case 'UI_LABEL': {
      const preset = getPresetAssets(intentObj.intent_type, intentObj.subject)
      const labelFile = preset.labels || param || DEFAULT_ASSETS.labels

      return {
        type: 'UI_LABEL',
        filename: labelFile,
        path: path.join(workspaceRoot, 'ui', labelFile),
        format: 'JSON'
      }
    }

    case 'UI_PANEL': {
      const preset = getPresetAssets(intentObj.intent_type, intentObj.subject)
      const uiFile = preset.ui || param

      return {
        type: 'UI_PANEL',
        filename: uiFile || 'panel.json',
        path: path.join(workspaceRoot, 'ui', uiFile || 'panel.json'),
        format: 'JSON'
      }
    }

    case 'ANIMATION': {
      const preset = getPresetAssets(intentObj.intent_type, intentObj.subject)

      return {
        type: 'ANIMATION',
        filename: preset.animation || 'animation.timeline',
        path: path.join(workspaceRoot, 'models', preset.animation || 'animation.timeline'),
        format: 'TIMELINE'
      }
    }

    default:
      console.warn('[S2] Unknown asset type:', type)
      return null
  }
}

/**
 * 模拟AI生成延迟
 * @param {number} ms
 */
async function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取调度状态
 * @returns {Object}
 */
export function getDispatchStatus() {
  return {
    status: 'ready',
    mode: AI_CONFIG.text_to_3d.enabled ? 'production' : 'mock',
    available_services: [
      AI_CONFIG.text_to_3d.enabled ? 'text_to_3d_meshy' : 'text_to_3d_mock',
      AI_CONFIG.tts_minimax.enabled ? 'tts_minimax' : 'tts_mock',
      AI_CONFIG.tts_openai.enabled ? 'tts_openai' : null,
      'model_converter_v2.6'
    ].filter(Boolean),
    config: {
      text_to_3d_endpoint: AI_CONFIG.text_to_3d.endpoint,
      tts_minimax_endpoint: AI_CONFIG.tts_minimax.endpoint,
      tts_openai_endpoint: AI_CONFIG.tts_openai.endpoint,
      model_converter_version: AI_CONFIG.model_converter.version
    }
  }
}

export default { dispatchGeneration, getDispatchStatus }