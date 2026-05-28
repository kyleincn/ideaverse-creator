/**
 * WebXR Session Manager
 * 管理 WebXR 会话生命周期、状态和事件
 */

export class WebXRSessionManager {
  constructor(renderer) {
    this.renderer = renderer
    this.session = null
    this.referenceSpace = null
    this.isPresenting = false
    this.onSessionStart = null
    this.onSessionEnd = null
    this.onError = null

    this.supportedModes = {
      'immersive-ar': false,
      'immersive-vr': false,
      'inline': true
    }

    this.sessionEvents = {
      onSelect: [],
      onSelectStart: [],
      onSelectEnd: [],
      onSqueezeStart: [],
      onSqueezeEnd: [],
      onInputSourcesChange: []
    }

    this._init()
  }

  async _init() {
    if ('xr' in navigator) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar')
        this.supportedModes['immersive-ar'] = supported

        const vrSupported = await navigator.xr.isSessionSupported('immersive-vr')
        this.supportedModes['immersive-vr'] = vrSupported
      } catch (e) {
        console.warn('[WebXR] Session support check failed:', e)
      }
    }
  }

  /**
   * 检查是否支持 AR
   */
  async checkARSupport() {
    return this.supportedModes['immersive-ar']
  }

  /**
   * 检查是否支持 VR
   */
  async checkVRSupport() {
    return this.supportedModes['immersive-vr']
  }

  /**
   * 请求 AR 会话
   */
  async requestARSession(options = {}) {
    if (!this.supportedModes['immersive-ar']) {
      throw new Error('AR not supported on this device')
    }

    const sessionInit = {
      mode: 'immersive-ar',
      requiredFeatures: ['local-floor', 'hit-test'],
      optionalFeatures: ['dom-overlay', 'hand-tracking', 'plane-detection', 'anchors']
    }

    // 合并自定义选项
    if (options.domOverlay) {
      sessionInit.domOverlay = { root: options.domOverlay }
    }

    try {
      this.session = await navigator.xr.requestSession('immersive-ar', sessionInit)
      await this._setupSession(this.session)
      return this.session
    } catch (err) {
      console.error('[WebXR] AR session request failed:', err)
      if (this.onError) this.onError(err)
      throw err
    }
  }

  /**
   * 请求 VR 会话
   */
  async requestVRSession(options = {}) {
    if (!this.supportedModes['immersive-vr']) {
      throw new Error('VR not supported on this device')
    }

    const sessionInit = {
      mode: 'immersive-vr',
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking']
    }

    try {
      this.session = await navigator.xr.requestSession('immersive-vr', sessionInit)
      await this._setupSession(this.session)
      return this.session
    } catch (err) {
      console.error('[WebXR] VR session request failed:', err)
      if (this.onError) this.onError(err)
      throw err
    }
  }

  /**
   * 设置会话
   */
  async _setupSession(session) {
    session.addEventListener('end', (event) => {
      console.log('[WebXR] Session ended')
      this.isPresenting = false
      this.session = null
      this.referenceSpace = null
      if (this.onSessionEnd) this.onSessionEnd()
    })

    session.addEventListener('selectstart', (event) => {
      this.sessionEvents.onSelectStart.forEach(cb => cb(event))
    })

    session.addEventListener('selectend', (event) => {
      this.sessionEvents.onSelectEnd.forEach(cb => cb(event))
      this.sessionEvents.onSelect.forEach(cb => cb(event))
    })

    session.addEventListener('select', (event) => {
      this.sessionEvents.onSelect.forEach(cb => cb(event))
    })

    session.addEventListener('inputsourceschange', (event) => {
      this.sessionEvents.onInputSourcesChange.forEach(cb => cb(event))
    })

    // 设置渲染器 session
    this.renderer.xr.setSession(session, {
      onInputSourceChange: (event) => {
        this._handleInputSourceChange(event)
      }
    })

    // 获取 reference space
    this.referenceSpace = await session.requestReferenceSpace('local-floor')

    this.isPresenting = true
    console.log('[WebXR] Session started, mode:', session.mode)

    if (this.onSessionStart) {
      this.onSessionStart(session)
    }

    return session
  }

  _handleInputSourceChange(event) {
    // 处理输入源变化
    for (const source of event.added) {
      console.log('[WebXR] Input source added:', source.handedness)

      if (source.hand) {
        // Hand tracking
        this._setupHandTracking(source)
      }
    }

    for (const source of event.removed) {
      console.log('[WebXR] Input source removed:', source.handedness)
    }
  }

  _setupHandTracking(hand) {
    // Hand tracking 事件
    hand.addEventListener('pinchstart', (event) => {
      console.log('[WebXR] Hand pinch start')
    })

    hand.addEventListener('pinchend', (event) => {
      console.log('[WebXR] Hand pinch end')
    })
  }

  /**
   * 结束会话
   */
  async endSession() {
    if (this.session) {
      console.log('[WebXR] Ending session')
      await this.session.end()
      this.session = null
      this.isPresenting = false
    }
  }

  /**
   * 注册 session 事件回调
   */
  on(event, callback) {
    if (this.sessionEvents.hasOwnProperty(event)) {
      this.sessionEvents[event].push(callback)
    }
  }

  /**
   * 注销 session 事件回调
   */
  off(event, callback) {
    if (this.sessionEvents.hasOwnProperty(event)) {
      const idx = this.sessionEvents[event].indexOf(callback)
      if (idx !== -1) {
        this.sessionEvents[event].splice(idx, 1)
      }
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isPresenting: this.isPresenting,
      mode: this.session?.mode || null,
      supportedModes: this.supportedModes,
      hasHandTracking: false // 需要在 session 中检测
    }
  }
}

export default WebXRSessionManager