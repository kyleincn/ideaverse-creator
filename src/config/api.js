/**
 * API 配置文件
 * 用于管理 AI 服务的 API 密钥和配置
 *
 * 支持两种配置方式：
 * 1. 直接在此文件中配置（不推荐提交到 Git）
 * 2. 环境变量 / .env 文件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.resolve(__dirname, '../../.env')

/**
 * 加载 .env 文件
 */
function loadEnvFile() {
  try {
    if (fs.existsSync(ENV_FILE)) {
      const content = fs.readFileSync(ENV_FILE, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim()
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[API Config] .env file load failed:', err.message)
  }
}

// 加载 .env 文件
loadEnvFile()

export const API_CONFIG = {
  // Text-to-3D 服务 (Meshy AI)
  // 申请地址: https://meshy.ai/
  text_to_3d: {
    enabled: process.env.TEXT_TO_3D_API_KEY != null && process.env.TEXT_TO_3D_API_KEY !== '',
    api_key: process.env.TEXT_TO_3D_API_KEY || '',
    endpoint: process.env.TEXT_TO_3D_ENDPOINT || 'https://api.meshy.ai/v1/text-to-3d',
    model: process.env.TEXT_TO_3D_MODEL || 'meshy-stable',
    poll: {
      interval_ms: 2000,
      max_attempts: 60,
      timeout_ms: 120000
    }
  },

  // Text-to-3D 服务 (Tripo3D)
  text_to_3d_tripo: {
    enabled: process.env.TRIPO3D_API_KEY != null && process.env.TRIPO3D_API_KEY !== '',
    api_key: process.env.TRIPO3D_API_KEY || '',
    endpoint: process.env.TRIPO3D_ENDPOINT || 'https://api.tripo3d.com/v1/text-to-3d',
    model: 'tripo-stable'
  },

  // MiniMax TTS
  // 申请地址: https://www.minimax.io/
  tts_minimax: {
    enabled: process.env.MINIMAX_API_KEY != null && process.env.MINIMAX_API_KEY !== '',
    api_key: process.env.MINIMAX_API_KEY || '',
    group_id: process.env.MINIMAX_GROUP_ID || '',
    endpoint: 'https://api.minimax.io/v1/t2a_v2',
    model: 'speech-02-hd',
    voice_id: 'male-qn-qingse',
    language: 'zh-CN'
  },

  // TTS 服务 (OpenAI)
  tts: {
    enabled: process.env.OPENAI_API_KEY != null && process.env.OPENAI_API_KEY !== '',
    api_key: process.env.OPENAI_API_KEY || '',
    endpoint: process.env.OPENAI_TTS_ENDPOINT || 'https://api.openai.com/v1/audio/speech',
    model: 'tts-1',
    voice: 'alloy',
    language: 'zh-CN'
  },

  // Azure TTS
  tts_azure: {
    enabled: process.env.AZURE_TTS_KEY != null && process.env.AZURE_TTS_KEY !== '',
    key: process.env.AZURE_TTS_KEY || '',
    region: process.env.AZURE_TTS_REGION || 'eastus',
    voice: 'zh-CN-XiaoxiaoNeural'
  },

  // ModelConverter (本地)
  model_converter: {
    enabled: process.env.MODEL_CONVERTER_PATH != null && process.env.MODEL_CONVERTER_PATH !== '',
    path: process.env.MODEL_CONVERTER_PATH || '/Applications/ModelConverter.app',
    version: '2.6'
  }
}

/**
 * 获取活跃的 Text-to-3D 提供商
 */
export function getActiveTextTo3DProvider() {
  if (API_CONFIG.text_to_3d.enabled && API_CONFIG.text_to_3d.api_key) {
    return { provider: 'meshy', config: API_CONFIG.text_to_3d }
  }
  if (API_CONFIG.text_to_3d_tripo.enabled && API_CONFIG.text_to_3d_tripo.api_key) {
    return { provider: 'tripo', config: API_CONFIG.text_to_3d_tripo }
  }
  return { provider: 'mock', config: null }
}

/**
 * 获取活跃的 TTS 提供商
 */
export function getActiveTTSProvider() {
  if (API_CONFIG.tts_minimax.enabled && API_CONFIG.tts_minimax.api_key) {
    return { provider: 'minimax', config: API_CONFIG.tts_minimax }
  }
  if (API_CONFIG.tts.enabled && API_CONFIG.tts.api_key) {
    return { provider: 'openai', config: API_CONFIG.tts }
  }
  if (API_CONFIG.tts_azure.enabled && API_CONFIG.tts_azure.key) {
    return { provider: 'azure', config: API_CONFIG.tts_azure }
  }
  return { provider: 'mock', config: null }
}

/**
 * 检查是否启用了任何真实 AI 服务
 */
export function isProductionMode() {
  return (
    API_CONFIG.text_to_3d.enabled ||
    API_CONFIG.text_to_3d_tripo.enabled ||
    API_CONFIG.tts.enabled ||
    API_CONFIG.tts_azure.enabled ||
    API_CONFIG.tts_minimax.enabled
  )
}

/**
 * 获取配置状态摘要
 */
export function getConfigStatus() {
  return {
    text_to_3d: {
      meshy: API_CONFIG.text_to_3d.enabled,
      tripo: API_CONFIG.text_to_3d_tripo.enabled,
      mock: !API_CONFIG.text_to_3d.enabled && !API_CONFIG.text_to_3d_tripo.enabled
    },
    tts: {
      minimax: API_CONFIG.tts_minimax.enabled,
      openai: API_CONFIG.tts.enabled,
      azure: API_CONFIG.tts_azure.enabled,
      mock: !API_CONFIG.tts.enabled && !API_CONFIG.tts_azure.enabled && !API_CONFIG.tts_minimax.enabled
    },
    model_converter: API_CONFIG.model_converter.enabled,
    production_mode: isProductionMode()
  }
}

export default { API_CONFIG, getActiveTextTo3DProvider, getActiveTTSProvider, isProductionMode, getConfigStatus }