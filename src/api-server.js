/**
 * IdeaVerse Creator - Web API Server
 * 提供 REST API 给 Web 前端调用 S1-S5 流水线
 */

import http from 'http'
import url from 'url'
import { parseIntent, getIntentParserStatus } from './s1_intent/index.js'
import { dispatchGeneration, getDispatchStatus } from './s2_dispatch/index.js'
import { syncAssets, getWorkspaceStatus } from './s3_workspace/index.js'
import { bindRules, getPresetRules, getBindingStatus } from './s4_binding/index.js'
import { simulateRender, getRenderStatus } from './s5_webxr/renderer.js'
import { initDatabase, userDB, sceneDB, templateDB, assetDB } from './db/index.js'
import { hashPassword, verifyPassword, generateToken, verifyToken, extractToken, requireAuth, authMiddleware } from './auth/index.js'

const PORT = 3000

// 初始化数据库
initDatabase()

/**
 * 创建 HTTP 响应
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  })
  res.end(JSON.stringify(data, null, 2))
}

/**
 * 解析请求体
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * 运行完整流水线
 */
async function runPipeline(userIntent, options = {}) {
  const result = {
    success: true,
    steps: [],
    intentObject: null,
    assetPackage: null,
    assetRecords: [],
    sceneBundle: null,
    webxrConfig: null,
    error: null
  }

  try {
    // S1: 意图解析
    const s1Result = parseIntent(userIntent, options)
    result.intentObject = s1Result.intentObj
    result.steps.push({
      step: 'S1',
      name: 'Intent Parsing',
      status: 'success',
      confidence: s1Result.confidence,
      output: s1Result.intentObj.intent_id
    })

    // S2: AI调度
    const assetPackage = await dispatchGeneration(s1Result.intentObj)
    result.assetPackage = assetPackage
    result.steps.push({
      step: 'S2',
      name: 'AI Dispatch',
      status: 'success',
      output: `${assetPackage.assets.length} assets generated`
    })

    // S3: 资产同步
    const assetRecords = await syncAssets(assetPackage)
    result.assetRecords = assetRecords
    result.steps.push({
      step: 'S3',
      name: 'Asset Sync',
      status: 'success',
      output: `${assetRecords.length} assets registered`
    })

    // S4: 规则绑定
    const rules = s1Result.intentObj.interaction_rules.length > 0
      ? s1Result.intentObj.interaction_rules
      : getPresetRules(s1Result.intentObj.intent_type, s1Result.intentObj.subject)
    const sceneBundle = bindRules(rules, assetRecords)
    result.sceneBundle = sceneBundle
    result.steps.push({
      step: 'S4',
      name: 'Rule Binding',
      status: 'success',
      output: `${rules.length} rules bound`
    })

    // S5: WebXR渲染
    const webxrConfig = simulateRender(s1Result.intentObj, sceneBundle, assetRecords)
    result.webxrConfig = webxrConfig
    result.steps.push({
      step: 'S5',
      name: 'WebXR Render',
      status: 'success',
      output: webxrConfig.scene_name
    })

  } catch (err) {
    result.success = false
    result.error = err.message
    console.error('[API] Pipeline error:', err)
  }

  return result
}

/**
 * 路由处理
 */
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  // CORS 预检
  if (method === 'OPTIONS') {
    sendJSON(res, 204, {})
    return
  }

  try {
    // ========== 认证相关 ==========

    // POST /api/auth/register - 用户注册
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req)

      if (!body.email || !body.password || !body.username) {
        sendJSON(res, 400, { error: 'Missing required fields: email, password, username' })
        return
      }

      if (body.password.length < 6) {
        sendJSON(res, 400, { error: 'Password must be at least 6 characters' })
        return
      }

      const passwordHash = await hashPassword(body.password)
      try {
        const user = userDB.create(body.email, body.username, passwordHash)
        const token = generateToken({ userId: user.id, email: user.email, role: user.role })
        sendJSON(res, 201, { user, token })
      } catch (err) {
        sendJSON(res, 400, { error: err.message })
      }
      return
    }

    // POST /api/auth/login - 用户登录
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req)

      if (!body.email || !body.password) {
        sendJSON(res, 400, { error: 'Missing email or password' })
        return
      }

      const user = userDB.findByEmail(body.email)
      if (!user) {
        sendJSON(res, 401, { error: 'Invalid email or password' })
        return
      }

      const valid = await verifyPassword(body.password, user.password_hash)
      if (!valid) {
        sendJSON(res, 401, { error: 'Invalid email or password' })
        return
      }

      const token = generateToken({ userId: user.id, email: user.email, role: user.role })
      sendJSON(res, 200, {
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
        token
      })
      return
    }

    // GET /api/auth/me - 获取当前用户信息
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = extractToken(req)
      if (!token) {
        sendJSON(res, 401, { error: 'Not authenticated' })
        return
      }

      try {
        const payload = verifyToken(token)
        const user = userDB.findById(payload.userId)
        if (!user) {
          sendJSON(res, 404, { error: 'User not found' })
          return
        }
        sendJSON(res, 200, { user })
      } catch (err) {
        sendJSON(res, 401, { error: err.message })
      }
      return
    }

    // ========== 场景相关 ==========

    // GET /api/scenes - 获取用户场景列表
    if (pathname === '/api/scenes' && method === 'GET') {
      const user = authMiddleware(req)
      if (!user) {
        sendJSON(res, 401, { error: 'Authentication required' })
        return
      }

      const scenes = sceneDB.findByUserId(user.userId)
      sendJSON(res, 200, { scenes })
      return
    }

    // POST /api/scenes - 创建场景
    if (pathname === '/api/scenes' && method === 'POST') {
      const user = requireAuth(req)
      const body = await parseBody(req)

      if (!body.name) {
        sendJSON(res, 400, { error: 'Missing scene name' })
        return
      }

      const scene = sceneDB.create(user.userId, {
        name: body.name,
        description: body.description,
        intentObject: body.intentObject,
        sceneBundle: body.sceneBundle,
        assets: body.assets,
        thumbnail: body.thumbnail
      })

      sendJSON(res, 201, { scene })
      return
    }

    // GET /api/scenes/:id - 获取场景详情
    if (pathname.match(/^\/api\/scenes\/[^/]+$/) && method === 'GET') {
      const sceneId = pathname.split('/').pop()
      const user = authMiddleware(req)

      const scene = sceneDB.findById(sceneId)
      if (!scene) {
        sendJSON(res, 404, { error: 'Scene not found' })
        return
      }

      // 检查访问权限
      if (!user || (scene.user_id !== user.userId && scene.is_public === 0)) {
        sendJSON(res, 403, { error: 'Access denied' })
        return
      }

      // 解析 JSON 字段
      const sceneData = {
        ...scene,
        intentObject: JSON.parse(scene.intent_object || '{}'),
        sceneBundle: JSON.parse(scene.scene_bundle || '{}'),
        assets: JSON.parse(scene.assets || '[]')
      }

      sendJSON(res, 200, { scene: sceneData })
      return
    }

    // PUT /api/scenes/:id - 更新场景
    if (pathname.match(/^\/api\/scenes\/[^/]+$/) && method === 'PUT') {
      const sceneId = pathname.split('/').pop()
      const user = requireAuth(req)
      const body = await parseBody(req)

      // 构建更新数据
      const updates = {}
      if (body.name !== undefined) updates.name = body.name
      if (body.description !== undefined) updates.description = body.description
      if (body.intentObject !== undefined) updates.intent_object = JSON.stringify(body.intentObject)
      if (body.sceneBundle !== undefined) updates.scene_bundle = JSON.stringify(body.sceneBundle)
      if (body.assets !== undefined) updates.assets = JSON.stringify(body.assets)
      if (body.thumbnail !== undefined) updates.thumbnail = body.thumbnail
      if (body.is_public !== undefined) updates.is_public = body.is_public ? 1 : 0

      const result = sceneDB.update(sceneId, user.userId, updates)
      if (result.changes === 0) {
        sendJSON(res, 404, { error: 'Scene not found or access denied' })
        return
      }

      const scene = sceneDB.findById(sceneId)
      sendJSON(res, 200, { scene })
      return
    }

    // DELETE /api/scenes/:id - 删除场景
    if (pathname.match(/^\/api\/scenes\/[^/]+$/) && method === 'DELETE') {
      const sceneId = pathname.split('/').pop()
      const user = requireAuth(req)

      const result = sceneDB.delete(sceneId, user.userId)
      if (result.changes === 0) {
        sendJSON(res, 404, { error: 'Scene not found or access denied' })
        return
      }

      sendJSON(res, 200, { success: true })
      return
    }

    // ========== 模板相关 ==========

    // GET /api/templates - 获取模板列表
    if (pathname === '/api/templates' && method === 'GET') {
      const user = authMiddleware(req)
      const userId = user?.userId || 'anonymous'
      const templates = templateDB.findByUserId(userId)
      sendJSON(res, 200, { templates })
      return
    }

    // POST /api/templates - 创建模板
    if (pathname === '/api/templates' && method === 'POST') {
      const user = requireAuth(req)
      const body = await parseBody(req)

      if (!body.name || !body.intentTemplate) {
        sendJSON(res, 400, { error: 'Missing name or intentTemplate' })
        return
      }

      const template = templateDB.create(user.userId, {
        name: body.name,
        description: body.description,
        intentTemplate: body.intentTemplate,
        intentType: body.intentType || 'EDUCATION',
        isSystem: false
      })

      sendJSON(res, 201, { template })
      return
    }

    // POST /api/templates/:id/use - 使用模板
    if (pathname.match(/^\/api\/templates\/[^/]+\/use$/) && method === 'POST') {
      const templateId = pathname.split('/')[2]
      const template = templateDB.findById(templateId)
      if (!template) {
        sendJSON(res, 404, { error: 'Template not found' })
        return
      }
      templateDB.incrementUseCount(templateId)
      sendJSON(res, 200, { template })
      return
    }

    // DELETE /api/templates/:id - 删除模板
    if (pathname.match(/^\/api\/templates\/[^/]+$/) && method === 'DELETE') {
      const templateId = pathname.split('/').pop()
      const user = requireAuth(req)
      const result = templateDB.delete(templateId, user.userId)
      if (result.changes === 0) {
        sendJSON(res, 404, { error: 'Template not found or access denied' })
        return
      }
      sendJSON(res, 200, { success: true })
      return
    }

    // ========== 资产相关 ==========

    // GET /api/assets - 获取用户资产列表
    if (pathname === '/api/assets' && method === 'GET') {
      const user = requireAuth(req)
      const parsedUrl = url.parse(req.url, true)
      const sceneId = parsedUrl.query.sceneId
      const type = parsedUrl.query.type

      const assets = assetDB.findByUserId(user.userId, { sceneId, type })
      sendJSON(res, 200, { assets })
      return
    }

    // POST /api/assets - 创建资产
    if (pathname === '/api/assets' && method === 'POST') {
      const user = requireAuth(req)
      const body = await parseBody(req)

      if (!body.name || !body.type || !body.url) {
        sendJSON(res, 400, { error: 'Missing name, type or url' })
        return
      }

      const asset = assetDB.create(user.userId, {
        sceneId: body.sceneId,
        name: body.name,
        type: body.type,
        url: body.url,
        thumbnail: body.thumbnail,
        metadata: body.metadata
      })

      sendJSON(res, 201, { asset })
      return
    }

    // GET /api/assets/:id - 获取资产详情
    if (pathname.match(/^\/api\/assets\/[^/]+$/) && method === 'GET') {
      const assetId = pathname.split('/').pop()
      const user = requireAuth(req)

      const asset = assetDB.findById(assetId)
      if (!asset || asset.user_id !== user.userId) {
        sendJSON(res, 404, { error: 'Asset not found' })
        return
      }

      sendJSON(res, 200, { asset })
      return
    }

    // POST /api/assets/:id/version - 创建新版本
    if (pathname.match(/^\/api\/assets\/[^/]+\/version$/) && method === 'POST') {
      const assetId = pathname.split('/')[2]
      const user = requireAuth(req)
      const body = await parseBody(req)

      if (!body.url) {
        sendJSON(res, 400, { error: 'Missing url' })
        return
      }

      try {
        const asset = assetDB.createVersion(user.userId, assetId, body.url)
        sendJSON(res, 201, { asset })
      } catch (err) {
        sendJSON(res, 404, { error: err.message })
      }
      return
    }

    // DELETE /api/assets/:id - 删除资产
    if (pathname.match(/^\/api\/assets\/[^/]+$/) && method === 'DELETE') {
      const assetId = pathname.split('/').pop()
      const user = requireAuth(req)

      const result = assetDB.delete(assetId, user.userId)
      if (result.changes === 0) {
        sendJSON(res, 404, { error: 'Asset not found or access denied' })
        return
      }

      sendJSON(res, 200, { success: true })
      return
    }

    // ========== 系统状态 ==========

    // GET /api/status - 系统状态
    if (pathname === '/api/status' && method === 'GET') {
      sendJSON(res, 200, {
        status: 'online',
        version: 'Phase 1.0',
        modules: {
          S1: getIntentParserStatus(),
          S2: getDispatchStatus(),
          S3: getWorkspaceStatus(),
          S4: getBindingStatus(),
          S5: getRenderStatus()
        }
      })
      return
    }

    // ========== 流水线相关 ==========

    // POST /api/generate - 运行流水线
    if (pathname === '/api/generate' && method === 'POST') {
      const body = await parseBody(req)

      if (!body.intent && typeof body.intent !== 'string') {
        sendJSON(res, 400, { error: 'Missing intent field' })
        return
      }

      const options = {
        intentType: body.intentType || null,
        anchor: body.anchor || 'table_center',
        assetProfile: body.assetProfile || '3D Model + Labels + Audio',
        language: body.language || 'zh-CN'
      }

      console.log('[API] Generate request:', body.intent.slice(0, 50))
      const result = await runPipeline(body.intent, options)

      if (result.success) {
        sendJSON(res, 200, result)
      } else {
        sendJSON(res, 500, result)
      }
      return
    }

    // GET /api/templates - 获取模板列表
    if (pathname === '/api/templates' && method === 'GET') {
      sendJSON(res, 200, {
        templates: [
          { id: 'medical', name: '医学教学', description: '模型标注、路径高亮、语音讲解' },
          { id: 'product', name: '产品演示', description: '结构拆解、部件说明、交互热点' },
          { id: 'training', name: '流程培训', description: '步骤引导、任务检查、动作反馈' }
        ]
      })
      return
    }

    // 404
    sendJSON(res, 404, { error: 'Not found', path: pathname })

  } catch (err) {
    console.error('[API] Request error:', err)
    const statusCode = err.statusCode || 500
    sendJSON(res, statusCode, { error: err.message })
  }
}

// 创建服务器
const server = http.createServer(handleRequest)

server.listen(PORT, () => {
  console.log('='.repeat(50))
  console.log('[API] IdeaVerse Creator API Server')
  console.log(`[API] Listening on http://localhost:${PORT}`)
  console.log('[API] Endpoints:')
  console.log('  Auth:')
  console.log('    POST   /api/auth/register   - Register new user')
  console.log('    POST   /api/auth/login      - Login')
  console.log('    GET    /api/auth/me         - Get current user')
  console.log('  Scenes:')
  console.log('    GET    /api/scenes          - List user scenes')
  console.log('    POST   /api/scenes          - Create scene')
  console.log('    GET    /api/scenes/:id      - Get scene details')
  console.log('    PUT    /api/scenes/:id      - Update scene')
  console.log('    DELETE /api/scenes/:id      - Delete scene')
  console.log('  Pipeline:')
  console.log('    GET    /api/status          - System status')
  console.log('    POST   /api/generate         - Run pipeline')
  console.log('    GET    /api/templates       - List templates')
  console.log('='.repeat(50))
})

export default server