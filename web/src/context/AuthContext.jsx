/**
 * AuthProvider - React 认证上下文
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, getCurrentUser, saveToken, clearToken, saveUser, getUser } from '../api/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 初始化时检查用户状态
  useEffect(() => {
    const savedUser = getUser()
    if (savedUser) {
      setUser(savedUser)
    }
    setLoading(false)
  }, [])

  /**
   * 登录
   */
  const login = async (email, password) => {
    const data = await apiLogin(email, password)
    saveToken(data.token)
    saveUser(data.user)
    setUser(data.user)
    return data.user
  }

  /**
   * 登出
   */
  const logout = () => {
    clearToken()
    setUser(null)
  }

  /**
   * 更新用户信息
   */
  const updateUser = (updates) => {
    const newUser = { ...user, ...updates }
    saveUser(newUser)
    setUser(newUser)
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 使用认证上下文
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext