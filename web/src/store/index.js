/**
 * IdeaVerse Creator - Global Store
 * 使用 Zustand 管理全局状态
 */

import { create } from 'zustand'

/**
 * 创建 store
 */
export const useStore = create((set, get) => ({
  // ========== 认证状态 ==========
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token, isAuthenticated: !!user })
  },

  clearAuth: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  initAuth: () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ user, token, isAuthenticated: true })
      } catch {
        get().clearAuth()
      }
    }
  },

  // ========== 场景状态 ==========
  scenes: [],
  currentScene: null,

  setScenes: (scenes) => set({ scenes }),

  addScene: (scene) => set(state => ({
    scenes: [scene, ...state.scenes]
  })),

  updateScene: (scene) => set(state => ({
    scenes: state.scenes.map(s => s.id === scene.id ? scene : s),
    currentScene: state.currentScene?.id === scene.id ? scene : state.currentScene
  })),

  deleteScene: (sceneId) => set(state => ({
    scenes: state.scenes.filter(s => s.id !== sceneId),
    currentScene: state.currentScene?.id === sceneId ? null : state.currentScene
  })),

  setCurrentScene: (scene) => set({ currentScene: scene }),

  // ========== 模板状态 ==========
  templates: [],
  selectedTemplate: null,

  setTemplates: (templates) => set({ templates }),

  setSelectedTemplate: (template) => set({ selectedTemplate: template }),

  // ========== 资产状态 ==========
  assets: [],
  selectedAsset: null,
  previewAsset: null,

  setAssets: (assets) => set({ assets }),

  setSelectedAsset: (asset) => set({ selectedAsset: asset }),

  setPreviewAsset: (asset) => set({ previewAsset: asset }),

  addAsset: (asset) => set(state => ({
    assets: [asset, ...state.assets]
  })),

  removeAsset: (assetId) => set(state => ({
    assets: state.assets.filter(a => a.id !== assetId)
  })),

  // ========== 流水线状态 ==========
  intentResult: null,
  assetPackage: null,
  sceneBundle: null,
  pipelineSteps: [],

  setIntentResult: (result) => set({ intentResult: result }),
  setAssetPackage: (pkg) => set({ assetPackage: pkg }),
  setSceneBundle: (bundle) => set({ sceneBundle: bundle }),

  setPipelineSteps: (steps) => set({ pipelineSteps: steps }),

  clearPipeline: () => set({
    intentResult: null,
    assetPackage: null,
    sceneBundle: null,
    pipelineSteps: []
  }),

  // ========== UI 状态 ==========
  loading: false,
  loadingText: '',
  error: null,
  showAuthModal: false,
  activeTab: 'intent', // 'intent' | 'scenes' | 'assets'

  setLoading: (loading, text = '') => set({ loading, loadingText: text }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  openAuthModal: () => set({ showAuthModal: true }),
  closeAuthModal: () => set({ showAuthModal: false }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ========== Toast 通知 ==========
  toasts: [],

  addToast: (toast) => {
    const id = Date.now()
    set(state => ({
      toasts: [...state.toasts, { id, ...toast }]
    }))
    // 3秒后自动移除
    setTimeout(() => {
      get().removeToast(id)
    }, 3000)
    return id
  },

  removeToast: (id) => set(state => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  // ========== 完整流水线执行 ==========
  runPipeline: async (intent, options = {}) => {
    const { token } = get()
    set({ loading: true, loadingText: '解析意图...', error: null, pipelineSteps: [] })

    try {
      // 步骤1: S1 解析
      set({ loadingText: 'S1: 解析意图...' })
      await new Promise(r => setTimeout(r, 500))

      // 调用 API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ intent, ...options })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Pipeline failed')
      }

      const result = await response.json()

      // 更新所有状态
      set({
        intentResult: result.intentObject,
        assetPackage: result.assetPackage,
        sceneBundle: result.sceneBundle,
        pipelineSteps: result.steps || [],
        loading: false,
        loadingText: ''
      })

      // 添加成功 toast
      get().addToast({
        type: 'success',
        message: `场景生成成功！生成了 ${result.assetPackage?.assets?.length || 0} 个资产`
      })

      return result

    } catch (err) {
      set({
        loading: false,
        loadingText: '',
        error: err.message
      })

      get().addToast({
        type: 'error',
        message: err.message
      })

      throw err
    }
  }
}))

export default useStore