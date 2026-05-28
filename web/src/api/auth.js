/**
 * Auth API - 前端认证相关 API 调用
 */

const API_BASE = '/api'

/**
 * 注册
 */
export async function register(email, username, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password })
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Registration failed')
  }
  return response.json()
}

/**
 * 登录
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Login failed')
  }
  return response.json()
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  const token = localStorage.getItem('token')
  if (!token) return null

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) return null

  const data = await response.json()
  return data.user
}

/**
 * 获取用户场景列表
 */
export async function getScenes() {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/scenes`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to load scenes')
  const data = await response.json()
  return data.scenes
}

/**
 * 创建场景
 */
export async function createScene(sceneData) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/scenes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(sceneData)
  })
  if (!response.ok) throw new Error('Failed to create scene')
  const data = await response.json()
  return data.scene
}

/**
 * 获取场景详情
 */
export async function getScene(sceneId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/scenes/${sceneId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to load scene')
  const data = await response.json()
  return data.scene
}

/**
 * 更新场景
 */
export async function updateScene(sceneId, updates) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/scenes/${sceneId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  })
  if (!response.ok) throw new Error('Failed to update scene')
  const data = await response.json()
  return data.scene
}

/**
 * 删除场景
 */
export async function deleteScene(sceneId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/scenes/${sceneId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to delete scene')
  return response.json()
}

/**
 * 保存 Token
 */
export function saveToken(token) {
  localStorage.setItem('token', token)
}

/**
 * 清除 Token
 */
export function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

/**
 * 获取 Token
 */
export function getToken() {
  return localStorage.getItem('token')
}

/**
 * 保存用户信息
 */
export function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user))
}

/**
 * 获取用户信息
 */
export function getUser() {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

/**
 * 获取模板列表
 */
export async function getTemplates() {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/templates`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!response.ok) throw new Error('Failed to load templates')
  const data = await response.json()
  return data.templates
}

/**
 * 创建模板
 */
export async function createTemplate(templateData) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(templateData)
  })
  if (!response.ok) throw new Error('Failed to create template')
  const data = await response.json()
  return data.template
}

/**
 * 使用模板
 */
export async function useTemplate(templateId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/templates/${templateId}/use`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to use template')
  const data = await response.json()
  return data.template
}

/**
 * 删除模板
 */
export async function deleteTemplate(templateId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to delete template')
  return response.json()
}

/**
 * 获取资产列表
 */
export async function getAssets(options = {}) {
  const token = localStorage.getItem('token')
  const params = new URLSearchParams()
  if (options.sceneId) params.append('sceneId', options.sceneId)
  if (options.type) params.append('type', options.type)

  const response = await fetch(`${API_BASE}/assets?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to load assets')
  const data = await response.json()
  return data.assets
}

/**
 * 创建资产
 */
export async function createAsset(assetData) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(assetData)
  })
  if (!response.ok) throw new Error('Failed to create asset')
  const data = await response.json()
  return data.asset
}

/**
 * 获取资产详情
 */
export async function getAsset(assetId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to load asset')
  const data = await response.json()
  return data.asset
}

/**
 * 创建资产新版本
 */
export async function createAssetVersion(assetId, newUrl) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/assets/${assetId}/version`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ url: newUrl })
  })
  if (!response.ok) throw new Error('Failed to create asset version')
  const data = await response.json()
  return data.asset
}

/**
 * 删除资产
 */
export async function deleteAsset(assetId) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/assets/${assetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to delete asset')
  return response.json()
}