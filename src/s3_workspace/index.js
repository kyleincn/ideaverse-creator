/**
 * S3: 本地工作区资产同步模块
 * 功能：管理资产的本地存储、版本控制和实时同步
 *
 * Phase 1增强版：
 * - 文件系统监听（chokidar）
 * - 真实SHA256哈希计算
 * - 资产变更自动检测
 * - 持久化注册表（JSON文件）
 */

import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import chokidar from 'chokidar'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 工作区根目录
 */
const WORKSPACE_ROOT = path.resolve(__dirname, '../../workspace')
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'registry/asset_registry.json')
const ASSETS_ROOT = path.join(WORKSPACE_ROOT, 'assets')

/**
 * 内存中的资产注册表（单例）
 */
let assetRegistry = new Map()

/**
 * 文件监听器
 */
let fileWatcher = null

/**
 * AssetRecord工厂函数
 * @param {Object} assetInfo
 * @returns {AssetRecord}
 */
function createAssetRecord(assetInfo) {
  const now = new Date().toISOString()
  return {
    id: assetInfo.id || uuidv4(),
    path: assetInfo.path,
    version: assetInfo.version || '1.0.0',
    hash: assetInfo.hash || computeFileHash(assetInfo.path),
    generation_params: assetInfo.intent_id || null,
    created_at: assetInfo.created_at || now,
    updated_at: now,
    // 扩展字段
    type: assetInfo.type,
    filename: assetInfo.filename,
    format: assetInfo.format,
    size_bytes: assetInfo.size_bytes || getFileSize(assetInfo.path),
    metadata: assetInfo.metadata || {}
  }
}

/**
 * 计算文件SHA256哈希
 * @param {string} filePath
 * @returns {string}
 */
function computeFileHash(filePath) {
  try {
    const absolutePath = path.resolve(filePath)
    if (!fs.existsSync(absolutePath)) {
      console.warn('[S3] File not found for hashing:', absolutePath)
      return 'file_not_found'
    }
    const buffer = fs.readFileSync(absolutePath)
    return crypto.createHash('sha256').update(buffer).digest('hex')
  } catch (err) {
    console.warn('[S3] Hash computation failed:', err.message)
    return 'hash_error'
  }
}

/**
 * 获取文件大小
 * @param {string} filePath
 * @returns {number}
 */
function getFileSize(filePath) {
  try {
    const absolutePath = path.resolve(filePath)
    if (fs.existsSync(absolutePath)) {
      return fs.statSync(absolutePath).size
    }
  } catch (err) {}
  return 0
}

/**
 * 递增版本号
 * @param {string} version
 * @returns {string}
 */
function bumpVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

/**
 * 从磁盘加载注册表
 */
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
      for (const [id, record] of Object.entries(data)) {
        assetRegistry.set(id, record)
      }
      console.log('[S3] Registry loaded:', assetRegistry.size, 'assets')
    }
  } catch (err) {
    console.warn('[S3] Registry load failed:', err.message)
  }
}

/**
 * 保存注册表到磁盘
 */
function saveRegistry() {
  try {
    const data = Object.fromEntries(assetRegistry)
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf-8')
    console.log('[S3] Registry saved:', assetRegistry.size, 'assets')
  } catch (err) {
    console.error('[S3] Registry save failed:', err.message)
  }
}

/**
 * 确保目录存在
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * 注册资产到工作区
 * @param {Object} assetInfo
 * @returns {AssetRecord}
 */
function registerAsset(assetInfo) {
  const absolutePath = path.resolve(assetInfo.path)

  // 检查是否已存在（基于路径）
  for (const [id, record] of assetRegistry) {
    if (record.path === absolutePath || record.path === assetInfo.path) {
      // 检查文件哈希是否变化
      const currentHash = computeFileHash(assetInfo.path)
      if (record.hash !== currentHash) {
        // 文件已更改，递增版本
        record.version = bumpVersion(record.version)
        record.hash = currentHash
        record.updated_at = new Date().toISOString()
        record.size_bytes = getFileSize(assetInfo.path)
        console.log('[S3] Asset changed:', record.filename, '-> v' + record.version, '(hash changed)')
        saveRegistry()
        return record
      }
      return record
    }
  }

  // 新增记录
  const record = createAssetRecord(assetInfo)
  assetRegistry.set(record.id, record)
  console.log('[S3] Registered asset:', record.filename, '(' + record.id + ')')
  saveRegistry()
  return record
}

/**
 * 主入口：同步资产到工作区
 * @param {Object} multiAssetPackage - S2输出的资产包
 * @returns {Array<AssetRecord>} 已注册的资产记录列表
 */
export async function syncAssets(multiAssetPackage) {
  console.log('[S3] Starting asset sync for intent:', multiAssetPackage.intent_id)

  // 确保工作区目录存在
  ensureDir(ASSETS_ROOT)
  ensureDir(path.join(ASSETS_ROOT, 'models'))
  ensureDir(path.join(ASSETS_ROOT, 'audio'))
  ensureDir(path.join(ASSETS_ROOT, 'ui'))

  // 加载已有注册表
  loadRegistry()

  const registeredAssets = []

  for (const asset of multiAssetPackage.assets) {
    // 如果文件不存在，创建空占位文件（Phase 1演示用）
    const absolutePath = path.resolve(asset.path)
    if (!fs.existsSync(absolutePath)) {
      ensureDir(path.dirname(absolutePath))
      // 创建占位文件
      if (asset.type === 'MODEL_3D') {
        fs.writeFileSync(absolutePath, '{}', 'utf-8') // 空的GLB占位
      } else if (asset.type === 'AUDIO') {
        fs.writeFileSync(absolutePath, '', 'binary') // 空白音频
      } else {
        fs.writeFileSync(absolutePath, '{}', 'utf-8')
      }
      console.log('[S3] Created placeholder:', absolutePath)
    }

    const record = registerAsset({
      ...asset,
      intent_id: multiAssetPackage.intent_id
    })
    registeredAssets.push(record)
  }

  console.log('[S3] Synced', registeredAssets.length, 'assets')
  return registeredAssets
}

/**
 * 启动文件监听
 * @param {Function} onChange - 资产变更回调
 */
export function startFileWatcher(onChange) {
  if (fileWatcher) {
    console.log('[S3] File watcher already running')
    return
  }

  // 监听资产目录
  const watchPaths = [
    path.join(ASSETS_ROOT, 'models'),
    path.join(ASSETS_ROOT, 'audio'),
    path.join(ASSETS_ROOT, 'ui')
  ].filter(p => fs.existsSync(p))

  if (watchPaths.length === 0) {
    console.log('[S3] No asset directories to watch')
    return
  }

  fileWatcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  })

  fileWatcher
    .on('add', filePath => {
      console.log('[S3] File added:', filePath)
      const record = registerAssetFromFile(filePath)
      if (record && onChange) onChange('add', record)
    })
    .on('change', filePath => {
      console.log('[S3] File changed:', filePath)
      const record = registerAssetFromFile(filePath)
      if (record && onChange) onChange('change', record)
    })
    .on('unlink', filePath => {
      console.log('[S3] File removed:', filePath)
      removeAssetByPath(filePath)
      if (onChange) onChange('unlink', { path: filePath })
    })

  console.log('[S3] File watcher started on:', watchPaths)
}

/**
 * 从文件路径注册资产
 * @param {string} filePath
 * @returns {AssetRecord|null}
 */
function registerAssetFromFile(filePath) {
  const filename = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()

  let type = 'UNKNOWN'
  let format = ext.slice(1).toUpperCase()

  if (['.glb', '.gltf'].includes(ext)) type = 'MODEL_3D'
  else if (['.wav', '.mp3', '.ogg'].includes(ext)) type = 'AUDIO'
  else if (['.json'].includes(ext)) type = 'UI_LABEL'
  else if (['.fbx', '.obj'].includes(ext)) type = 'MODEL_3D'

  const record = registerAsset({
    path: filePath,
    filename,
    type,
    format,
    hash: computeFileHash(filePath),
    size_bytes: getFileSize(filePath)
  })

  return record
}

/**
 * 根据路径移除资产记录
 * @param {string} filePath
 */
function removeAssetByPath(filePath) {
  const absolutePath = path.resolve(filePath)
  for (const [id, record] of assetRegistry) {
    if (record.path === absolutePath) {
      assetRegistry.delete(id)
      console.log('[S3] Asset removed:', record.filename)
      saveRegistry()
      return
    }
  }
}

/**
 * 停止文件监听
 */
export function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
    console.log('[S3] File watcher stopped')
  }
}

/**
 * 获取所有已注册的资产
 * @returns {Array<AssetRecord>}
 */
export function getAllAssets() {
  return Array.from(assetRegistry.values())
}

/**
 * 根据ID查找资产
 * @param {string} id
 * @returns {AssetRecord|null}
 */
export function getAssetById(id) {
  return assetRegistry.get(id) || null
}

/**
 * 根据类型查找资产
 * @param {string} type
 * @returns {Array<AssetRecord>}
 */
export function getAssetsByType(type) {
  return Array.from(assetRegistry.values()).filter(r => r.type === type)
}

/**
 * 根据intent_id查找资产
 * @param {string} intentId
 * @returns {Array<AssetRecord>}
 */
export function getAssetsByIntentId(intentId) {
  return Array.from(assetRegistry.values()).filter(r => r.generation_params === intentId)
}

/**
 * 获取工作区状态
 * @returns {Object}
 */
export function getWorkspaceStatus() {
  return {
    total_assets: assetRegistry.size,
    by_type: countByType(),
    status: 'ready',
    watch_enabled: fileWatcher !== null,
    registry_persisted: fs.existsSync(REGISTRY_PATH),
    workspace_root: WORKSPACE_ROOT
  }
}

/**
 * 统计各类型资产数量
 * @returns {Object}
 */
function countByType() {
  const counts = {}
  for (const record of assetRegistry.values()) {
    counts[record.type] = (counts[record.type] || 0) + 1
  }
  return counts
}

/**
 * 验证资产完整性
 * @param {string} assetId
 * @returns {Object} 验证结果
 */
export function verifyAssetIntegrity(assetId) {
  const record = assetRegistry.get(assetId)
  if (!record) {
    return { valid: false, reason: 'asset_not_found' }
  }

  const currentHash = computeFileHash(record.path)
  const isValid = record.hash === currentHash

  return {
    valid: isValid,
    asset_id: assetId,
    expected_hash: record.hash,
    actual_hash: currentHash,
    path: record.path
  }
}

export default {
  syncAssets,
  startFileWatcher,
  stopFileWatcher,
  getAllAssets,
  getAssetById,
  getAssetsByType,
  getWorkspaceStatus,
  verifyAssetIntegrity
}