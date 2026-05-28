/**
 * 认证模块
 * 提供 JWT 令牌生成、验证和密码哈希功能
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'IdeaVerse-Secret-Key-2026'
const JWT_EXPIRES_IN = '7d'
const JWT_ALGORITHM = 'HS256'

/**
 * 哈希密码
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * 验证密码
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

/**
 * 生成 JWT 令牌
 * @param {Object} payload - 包含 userId, email, role
 * @returns {string}
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM
  })
}

/**
 * 验证 JWT 令牌
 * @param {string} token
 * @returns {Object|null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] })
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token expired')
    }
    if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid token')
    }
    throw err
  }
}

/**
 * 从请求头提取 Token
 * @param {http.IncomingMessage} req
 * @returns {string|null}
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * 认证中间件
 * @param {http.IncomingMessage} req
 * @returns {Object|null} user payload or null
 */
export function authMiddleware(req) {
  try {
    const token = extractToken(req)
    if (!token) return null

    const payload = verifyToken(token)
    return payload
  } catch (err) {
    console.warn('[Auth] Middleware error:', err.message)
    return null
  }
}

/**
 * 强制认证中间件（未认证则抛出异常）
 * @param {http.IncomingMessage} req
 * @returns {Object} user payload
 * @throws {Error} 如果未认证
 */
export function requireAuth(req) {
  const user = authMiddleware(req)
  if (!user) {
    const error = new Error('Authentication required')
    error.statusCode = 401
    throw error
  }
  return user
}

export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken,
  authMiddleware,
  requireAuth
}