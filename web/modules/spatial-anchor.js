/**
 * WebXR Spatial Anchor Manager
 * 管理空间锚点的创建、追踪和销毁
 */

export class SpatialAnchorManager {
  constructor(session) {
    this.session = session
    this.anchors = new Map()
    this.anchorEntities = new Map()
    this.fallbackAnchors = new Map()
    this.onAnchorCreated = null
    this.onAnchorRemoved = null
    this.onAnchorTrackingLost = null

    this._checkAnchorSupport()
  }

  /**
   * 检查锚点支持
   */
  async _checkAnchorSupport() {
    if (!this.session) {
      this._supportsAnchors = false
      return
    }

    // 检查 requestAnchor 是否可用
    this._supportsAnchors = typeof this.session.requestAnchor === 'function'

    // 如果不支持，创建 hit test 锚点作为替代
    if (!this._supportsAnchors) {
      console.warn('[SpatialAnchor] Native anchors not supported, using hit-test fallback')
    } else {
      console.log('[SpatialAnchor] Native anchor support detected')
    }
  }

  /**
   * 获取锚点支持状态
   */
  isSupported() {
    return this._supportsAnchors !== false
  }

  /**
   * 在指定位置创建锚点
   * @param {THREE.Vector3} position - 位置
   * @param {THREE.Quaternion} quaternion - 朝向
   * @param {string} name - 锚点名称
   * @returns {Promise<XRAnchor>} 锚点对象
   */
  async createAnchor(position, quaternion, name = 'anchor') {
    if (!this.session) {
      throw new Error('No XR session available')
    }

    // 优先使用原生锚点
    if (this._supportsAnchors) {
      try {
        const anchorPose = new XRRigidTransform({
          position: position.clone(),
          orientation: quaternion.clone()
        })

        const anchor = await this.session.requestAnchor(anchorPose)

        if (anchor) {
          this.anchors.set(name, anchor)
          console.log('[SpatialAnchor] Created native anchor:', name)
          if (this.onAnchorCreated) {
            this.onAnchorCreated(anchor, name)
          }
          return anchor
        }
      } catch (err) {
        console.error('[SpatialAnchor] Native anchor failed, falling back:', err)
      }
    }

    // 回退到模拟锚点
    return this._createFallbackAnchor(position, quaternion, name)
  }

  /**
   * 创建回退锚点（用于不支持原生锚点的设备）
   */
  _createFallbackAnchor(position, quaternion, name) {
    const fallbackAnchor = {
      isFallback: true,
      name,
      position: position.clone(),
      quaternion: quaternion.clone(),
      createdAt: Date.now(),
      trackingState: 'tracked'
    }

    this.fallbackAnchors.set(name, fallbackAnchor)
    console.log('[SpatialAnchor] Created fallback anchor:', name)

    if (this.onAnchorCreated) {
      this.onAnchorCreated(fallbackAnchor, name)
    }

    return fallbackAnchor
  }

  /**
   * 通过 hit test 创建锚点
   * @param {XRHitTestTrackableType} trackableType - 可追踪类型
   * @returns {Promise<XRAnchor>} 锚点对象
   */
  async createAnchorFromHitTest(trackableType = 'plane') {
    if (!this.session) {
      throw new Error('No XR session available')
    }

    return new Promise(async (resolve, reject) => {
      const hitTestSource = await this.session.requestHitTestSource({
        entityTypes: ['plane', 'characteristic-plane', 'detected-plane']
      })

      // 创建 hit test 的 reference space
      const localSpace = await this.session.requestReferenceSpace('local')
      const viewerSpace = await this.session.requestReferenceSpace('viewer')

      let frameCount = 0
      const maxFrames = 300 // 约5秒 (60fps)

      const onFrame = (time, frame) => {
        frameCount++
        const hitTestResults = frame.getHitTestResults(hitTestSource)

        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localSpace)

          if (pose) {
            this.session?.removeEventListener('frame', onFrame)

            const anchor = this.createAnchor(
              pose.transform.position,
              pose.transform.orientation,
              `hit_anchor_${Date.now()}`
            )

            if (anchor) {
              resolve(anchor)
              return
            }
          }
        }

        // 超时或超过最大帧数
        if (frameCount > maxFrames) {
          hitTestSource.cancel()
          this.session?.removeEventListener('frame', onFrame)
          reject(new Error('Hit test timeout - no surface detected'))
          return
        }

        this.session?.requestAnimationFrame(onFrame)
      }

      this.session.requestAnimationFrame(onFrame)
    })
  }

  /**
   * 保存锚点状态到本地存储（用于持久化）
   */
  saveAnchorState(name) {
    const anchor = this.anchors.get(name) || this.fallbackAnchors.get(name)
    if (!anchor) return null

    const state = {
      name,
      position: anchor.position || anchor.transform?.position,
      quaternion: anchor.quaternion || anchor.transform?.orientation,
      createdAt: anchor.createdAt || Date.now(),
      isFallback: !!anchor.isFallback
    }

    try {
      const saved = JSON.parse(localStorage.getItem('iv_anchors') || '{}')
      saved[name] = state
      localStorage.setItem('iv_anchors', JSON.stringify(saved))
      console.log('[SpatialAnchor] Saved anchor state:', name)
    } catch (err) {
      console.warn('[SpatialAnchor] Failed to save anchor state:', err)
    }

    return state
  }

  /**
   * 从本地存储恢复锚点
   */
  async restoreAnchorState(name) {
    try {
      const saved = JSON.parse(localStorage.getItem('iv_anchors') || '{}')
      const state = saved[name]
      if (!state) return null

      // 重新创建锚点
      const position = state.position
      const quaternion = state.quaternion

      return await this.createAnchor(position, quaternion, name)
    } catch (err) {
      console.warn('[SpatialAnchor] Failed to restore anchor:', err)
      return null
    }
  }

  /**
   * 批量保存所有锚点
   */
  saveAllAnchors() {
    const names = Array.from(this.anchors.keys()).concat(Array.from(this.fallbackAnchors.keys()))
    return names.map(name => this.saveAnchorState(name))
  }

  /**
   * 加载保存的锚点
   */
  async loadSavedAnchors() {
    try {
      const saved = JSON.parse(localStorage.getItem('iv_anchors') || '{}')
      const results = []

      for (const name of Object.keys(saved)) {
        const anchor = await this.restoreAnchorState(name)
        if (anchor) results.push(anchor)
      }

      console.log('[SpatialAnchor] Restored', results.length, 'anchors')
      return results
    } catch (err) {
      console.warn('[SpatialAnchor] Failed to load saved anchors:', err)
      return []
    }
  }

  /**
   * 删除锚点
   */
  async removeAnchor(name) {
    const anchor = this.anchors.get(name)
    if (anchor) {
      this.anchors.delete(name)
      console.log('[SpatialAnchor] Removed:', name)
      if (this.onAnchorRemoved) {
        this.onAnchorRemoved(name)
      }
    }

    const fallback = this.fallbackAnchors.get(name)
    if (fallback) {
      this.fallbackAnchors.delete(name)
    }
  }

  /**
   * 获取锚点列表
   */
  getAnchors() {
    return Array.from(this.anchors.keys()).concat(Array.from(this.fallbackAnchors.keys()))
  }

  /**
   * 获取锚点
   */
  getAnchor(name) {
    return this.anchors.get(name) || this.fallbackAnchors.get(name)
  }

  /**
   * 更新锚点位置
   */
  async updateAnchor(name, position, quaternion) {
    await this.removeAnchor(name)
    return await this.createAnchor(position, quaternion, name)
  }

  /**
   * 清空所有锚点
   */
  async clearAll() {
    const names = this.getAnchors()
    for (const name of names) {
      await this.removeAnchor(name)
    }
    this.anchorEntities.clear()
    localStorage.removeItem('iv_anchors')
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      nativeCount: this.anchors.size,
      fallbackCount: this.fallbackAnchors.size,
      totalCount: this.anchors.size + this.fallbackAnchors.size,
      nativeSupported: this._supportsAnchors,
      anchors: this.getAnchors()
    }
  }
}

export default SpatialAnchorManager