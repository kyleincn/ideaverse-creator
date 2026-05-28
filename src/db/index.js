/**
 * 数据库初始化
 * 创建 users 和 scenes 表
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../../data/ideaVerse.db')

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(DB_PATH)

// 启用 WAL 模式，提升并发性能
db.pragma('journal_mode = WAL')

/**
 * 初始化数据库表
 */
export function initDatabase() {
  // 创建 users 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'editor',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // 创建 scenes 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      intent_object TEXT,
      scene_bundle TEXT,
      assets TEXT,
      thumbnail TEXT,
      is_public INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // 创建 scenes 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scenes_user_id ON scenes(user_id)
  `)

  // 创建 templates 表（用户自定义模板）
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      intent_template TEXT NOT NULL,
      intent_type TEXT DEFAULT 'EDUCATION',
      is_system INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)
  `)

  // 创建 assets 表（资产版本管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scene_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail TEXT,
      metadata TEXT,
      version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (scene_id) REFERENCES scenes(id)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_scene_id ON assets(scene_id)
  `)

  console.log('[DB] Database initialized at:', DB_PATH)
  console.log('[DB] Tables: users, scenes')
}

/**
 * 用户相关操作
 */
export const userDB = {
  // 创建用户
  create(email, username, passwordHash) {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, password_hash)
      VALUES (?, ?, ?, ?)
    `)
    try {
      stmt.run(id, email, username, passwordHash)
      return { id, email, username, role: 'editor' }
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed: users.email')) {
        throw new Error('Email already exists')
      }
      throw err
    }
  },

  // 根据邮箱查找用户
  findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    return stmt.get(email)
  },

  // 根据 ID 查找用户
  findById(id) {
    const stmt = db.prepare('SELECT id, email, username, role, created_at FROM users WHERE id = ?')
    return stmt.get(id)
  },

  // 更新用户
  update(id, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    const stmt = db.prepare(`UPDATE users SET ${fields}, updated_at = datetime('now') WHERE id = ?`)
    return stmt.run(...values, id)
  }
}

/**
 * 场景相关操作
 */
export const sceneDB = {
  // 创建场景
  create(userId, data) {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO scenes (id, user_id, name, description, intent_object, scene_bundle, assets, thumbnail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      userId,
      data.name || 'Untitled Scene',
      data.description || '',
      JSON.stringify(data.intentObject || {}),
      JSON.stringify(data.sceneBundle || {}),
      JSON.stringify(data.assets || []),
      data.thumbnail || ''
    )
    return this.findById(id)
  },

  // 获取用户所有场景
  findByUserId(userId) {
    const stmt = db.prepare(`
      SELECT id, name, description, thumbnail, is_public, created_at, updated_at
      FROM scenes WHERE user_id = ? ORDER BY updated_at DESC
    `)
    return stmt.all(userId)
  },

  // 根据 ID 查找场景
  findById(id) {
    const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?')
    return stmt.get(id)
  },

  // 更新场景
  update(id, userId, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    const stmt = db.prepare(`
      UPDATE scenes SET ${fields}, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `)
    return stmt.run(...values, id, userId)
  },

  // 删除场景
  delete(id, userId) {
    const stmt = db.prepare('DELETE FROM scenes WHERE id = ? AND user_id = ?')
    return stmt.run(id, userId)
  },

  // 检查用户是否有权访问场景
  canAccess(id, userId) {
    const scene = this.findById(id)
    if (!scene) return false
    return scene.user_id === userId || scene.is_public === 1
  }
}

/**
 * 模板相关操作
 */
export const templateDB = {
  // 创建模板
  create(userId, data) {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO templates (id, user_id, name, description, intent_template, intent_type, is_system)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      userId,
      data.name || 'Untitled Template',
      data.description || '',
      data.intentTemplate || '',
      data.intentType || 'EDUCATION',
      data.isSystem ? 1 : 0
    )
    return this.findById(id)
  },

  // 获取用户所有模板（包括系统模板）
  findByUserId(userId) {
    const stmt = db.prepare(`
      SELECT * FROM templates
      WHERE user_id = ? OR user_id IS NULL OR is_system = 1
      ORDER BY is_system ASC, use_count DESC, created_at DESC
    `)
    return stmt.all(userId)
  },

  // 获取系统模板
  findSystemTemplates() {
    const stmt = db.prepare('SELECT * FROM templates WHERE is_system = 1 ORDER BY use_count DESC')
    return stmt.all()
  },

  // 根据 ID 查找模板
  findById(id) {
    const stmt = db.prepare('SELECT * FROM templates WHERE id = ?')
    return stmt.get(id)
  },

  // 更新模板使用次数
  incrementUseCount(id) {
    const stmt = db.prepare('UPDATE templates SET use_count = use_count + 1, updated_at = datetime(\'now\') WHERE id = ?')
    return stmt.run(id)
  },

  // 删除模板（仅用户模板）
  delete(id, userId) {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ? AND is_system = 0')
    return stmt.run(id, userId)
  }
}

/**
 * 资产相关操作
 */
export const assetDB = {
  // 创建资产
  create(userId, data) {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO assets (id, user_id, scene_id, name, type, url, thumbnail, metadata, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      userId,
      data.sceneId || null,
      data.name || 'Untitled Asset',
      data.type || 'unknown',
      data.url || '',
      data.thumbnail || '',
      JSON.stringify(data.metadata || {}),
      data.version || 1
    )
    return this.findById(id)
  },

  // 获取用户所有资产
  findByUserId(userId, options = {}) {
    let sql = 'SELECT * FROM assets WHERE user_id = ?'
    const params = [userId]

    if (options.sceneId) {
      sql += ' AND scene_id = ?'
      params.push(options.sceneId)
    }

    if (options.type) {
      sql += ' AND type = ?'
      params.push(options.type)
    }

    sql += ' ORDER BY updated_at DESC'

    const stmt = db.prepare(sql)
    return stmt.all(...params)
  },

  // 根据 ID 查找资产
  findById(id) {
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ?')
    const asset = stmt.get(id)
    if (asset && asset.metadata) {
      asset.metadata = JSON.parse(asset.metadata)
    }
    return asset
  },

  // 获取场景的最新资产版本
  findLatestBySceneId(sceneId) {
    const stmt = db.prepare(`
      SELECT a.* FROM assets a
      INNER JOIN (
        SELECT name, type, MAX(version) as max_version
        FROM assets
        WHERE scene_id = ? AND is_active = 1
        GROUP BY name, type
      ) latest ON a.name = latest.name AND a.type = latest.type AND a.version = latest.max_version
      WHERE a.scene_id = ? AND a.is_active = 1
    `)
    const assets = stmt.all(sceneId, sceneId)
    return assets.map(a => ({
      ...a,
      metadata: a.metadata ? JSON.parse(a.metadata) : {}
    }))
  },

  // 创建新版本资产
  createVersion(userId, assetId, newUrl) {
    const oldAsset = this.findById(assetId)
    if (!oldAsset) throw new Error('Asset not found')

    // 先停用旧版本
    const deactivateStmt = db.prepare('UPDATE assets SET is_active = 0 WHERE id = ?')
    deactivateStmt.run(assetId)

    // 创建新版本
    return this.create(userId, {
      sceneId: oldAsset.scene_id,
      name: oldAsset.name,
      type: oldAsset.type,
      url: newUrl,
      thumbnail: oldAsset.thumbnail,
      metadata: oldAsset.metadata,
      version: oldAsset.version + 1
    })
  },

  // 删除资产（软删除）
  delete(id, userId) {
    const stmt = db.prepare('UPDATE assets SET is_active = 0 WHERE id = ? AND user_id = ?')
    return stmt.run(id, userId)
  }
}

export default db