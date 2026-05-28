/**
 * 场景管理器
 * Phase 1: 场景的保存、加载、历史记录、导入导出
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(__dirname, '../../workspace')
const REGISTRY_DIR = path.join(WORKSPACE_ROOT, 'registry')
const SCENE_HISTORY_FILE = path.join(REGISTRY_DIR, 'scene_history.json')

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 加载场景历史
 */
function loadHistory() {
  try {
    if (fs.existsSync(SCENE_HISTORY_FILE)) {
      const data = fs.readFileSync(SCENE_HISTORY_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.warn('[SceneManager] History load failed:', err.message)
  }
  return { scenes: [], lastUpdated: null }
}

/**
 * 保存场景历史
 */
function saveHistory(history) {
  try {
    ensureDir(REGISTRY_DIR)
    history.lastUpdated = new Date().toISOString()
    fs.writeFileSync(SCENE_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('[SceneManager] History save failed:', err.message)
    return false
  }
}

/**
 * 添加场景到历史
 */
export function addToHistory(sceneConfig) {
  const history = loadHistory()

  // 检查是否已存在
  const existingIndex = history.scenes.findIndex(s => s.intent_id === sceneConfig.intent_id)

  const entry = {
    intent_id: sceneConfig.intent_id,
    scene_name: sceneConfig.scene_name,
    subject: sceneConfig.debug?.subject || 'Unknown',
    intent_type: sceneConfig.scene_type || sceneConfig.debug?.intent_type || 'EDUCATION',
    asset_count: sceneConfig.debug?.asset_count || sceneConfig.assets?.length || 0,
    created_at: sceneConfig.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (existingIndex >= 0) {
    history.scenes[existingIndex] = { ...history.scenes[existingIndex], ...entry }
  } else {
    history.scenes.unshift(entry) // 添加到开头
  }

  // 限制历史记录数量
  if (history.scenes.length > 50) {
    history.scenes = history.scenes.slice(0, 50)
  }

  saveHistory(history)
  return entry
}

/**
 * 获取历史记录
 */
export function getHistory(limit = 20) {
  const history = loadHistory()
  return history.scenes.slice(0, limit)
}

/**
 * 清除历史记录
 */
export function clearHistory() {
  saveHistory({ scenes: [], lastUpdated: new Date().toISOString() })
  return true
}

/**
 * 获取单个场景
 */
export function getScene(intentId) {
  const configPath = path.join(REGISTRY_DIR, `IV_Scene_${intentId}.webxr.json`)

  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('[SceneManager] Load scene failed:', err.message)
  }
  return null
}

/**
 * 获取所有场景
 */
export function getAllScenes() {
  ensureDir(REGISTRY_DIR)

  const files = fs.readdirSync(REGISTRY_DIR)
    .filter(f => f.endsWith('.webxr.json'))

  const scenes = []
  for (const file of files) {
    try {
      const filePath = path.join(REGISTRY_DIR, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const config = JSON.parse(data)
      scenes.push({
        intent_id: config.intent_id,
        scene_name: config.scene_name,
        subject: config.debug?.subject || 'Unknown',
        intent_type: config.scene_type || config.debug?.intent_type || 'EDUCATION',
        asset_count: config.debug?.asset_count || config.assets?.length || 0,
        created_at: config.created_at
      })
    } catch (err) {
      console.warn('[SceneManager] Failed to read:', file)
    }
  }

  // 按时间排序
  scenes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return scenes
}

/**
 * 导出场景到指定路径
 */
export function exportScene(intentId, exportPath) {
  const scene = getScene(intentId)
  if (!scene) {
    console.error('[SceneManager] Scene not found:', intentId)
    return false
  }

  try {
    // 确保目录存在
    const dir = path.dirname(exportPath)
    ensureDir(dir)

    fs.writeFileSync(exportPath, JSON.stringify(scene, null, 2), 'utf-8')
    console.log('[SceneManager] Exported scene to:', exportPath)
    return true
  } catch (err) {
    console.error('[SceneManager] Export failed:', err.message)
    return false
  }
}

/**
 * 导入场景
 */
export function importScene(importPath) {
  try {
    if (!fs.existsSync(importPath)) {
      console.error('[SceneManager] Import file not found:', importPath)
      return null
    }

    const data = fs.readFileSync(importPath, 'utf-8')
    const scene = JSON.parse(data)

    // 验证场景配置
    if (!scene.intent_id || !scene.scene_name) {
      console.error('[SceneManager] Invalid scene config')
      return null
    }

    // 保存到注册表
    const configPath = path.join(REGISTRY_DIR, `${scene.scene_name}.json`)
    fs.writeFileSync(configPath, JSON.stringify(scene, null, 2), 'utf-8')

    // 添加到历史
    addToHistory(scene)

    console.log('[SceneManager] Imported scene:', scene.scene_name)
    return scene
  } catch (err) {
    console.error('[SceneManager] Import failed:', err.message)
    return null
  }
}

/**
 * 删除场景
 */
export function deleteScene(intentId) {
  const configPath = path.join(REGISTRY_DIR, `IV_Scene_${intentId}.webxr.json`)
  const backupPath = path.join(REGISTRY_DIR, `IV_Scene_${intentId}.webxr.json.bak`)

  try {
    if (fs.existsSync(configPath)) {
      // 移动到备份
      fs.renameSync(configPath, backupPath)

      // 从历史中移除
      const history = loadHistory()
      history.scenes = history.scenes.filter(s => s.intent_id !== intentId)
      saveHistory(history)

      console.log('[SceneManager] Deleted scene:', intentId)
      return true
    }
  } catch (err) {
    console.error('[SceneManager] Delete failed:', err.message)
  }
  return false
}

/**
 * 获取场景管理器状态
 */
export function getSceneManagerStatus() {
  const scenes = getAllScenes()
  const history = loadHistory()

  return {
    total_scenes: scenes.length,
    history_count: history.scenes.length,
    registry_dir: REGISTRY_DIR,
    last_updated: history.lastUpdated
  }
}

export default {
  addToHistory,
  getHistory,
  clearHistory,
  getScene,
  getAllScenes,
  exportScene,
  importScene,
  deleteScene,
  getSceneManagerStatus
}