/**
 * WebXR Multi-user Collaboration Manager
 * 处理多用户协作、会话同步和状态共享
 */

export class CollaborationManager {
  constructor() {
    this.sessionId = null
    this.userId = this._generateUserId()
    this.users = new Map()
    this.localUser = null
    this.onUserJoined = null
    this.onUserLeft = null
    this.onStateSync = null

    this._signalingClient = null
    this._dataChannel = null
    this._stateChannel = null
  }

  /**
   * 生成用户ID
   */
  _generateUserId() {
    return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 初始化协作会话
   * @param {string} sessionId - 会话ID
   */
  async initSession(sessionId) {
    this.sessionId = sessionId
    this.localUser = {
      id: this.userId,
      name: `User ${this.userId.slice(-4)}`,
      joinedAt: Date.now(),
      isLocal: true
    }

    this.users.set(this.userId, this.localUser)
    console.log('[Collab] Session initialized:', sessionId, 'User:', this.userId)

    // 初始化信令（后续可以接入 WebRTC 服务）
    await this._initSignaling()

    return this.localUser
  }

  /**
   * 初始化信令客户端
   */
  async _initSignaling() {
    // 简化的信令客户端 - 实际应用中需要 WebSocket 服务器
    this._signalingClient = {
      connected: false,
      onMessage: null
    }

    // 尝试连接本地信令服务
    try {
      const wsUrl = `ws://${window.location.hostname}:8080/collab`
      console.log('[Collab] Would connect to signaling:', wsUrl)
      console.log('[Collab] Note: WebSocket signaling server not yet implemented')
    } catch (err) {
      console.warn('[Collab] Signaling not available:', err.message)
    }
  }

  /**
   * 加入现有会话
   * @param {string} sessionId
   */
  async joinSession(sessionId) {
    console.log('[Collab] Joining session:', sessionId)
    await this.initSession(sessionId)

    // 发送加入消息
    this._broadcastUserState('join', this.localUser)

    return this.localUser
  }

  /**
   * 离开会话
   */
  async leaveSession() {
    if (!this.sessionId) return

    this._broadcastUserState('leave', this.localUser)

    for (const [id] of this.users) {
      if (id !== this.userId) {
        this.users.delete(id)
      }
    }

    this.sessionId = null
    console.log('[Collab] Left session')
  }

  /**
   * 广播用户状态
   */
  _broadcastUserState(action, user) {
    const message = {
      type: 'user_state',
      action,
      user,
      timestamp: Date.now()
    }
    console.log('[Collab] Broadcast:', action, user.id)
    // 实际通过 WebRTC data channel 发送
  }

  /**
   * 同步场景状态
   */
  syncSceneState(state) {
    if (!this.sessionId) return

    const message = {
      type: 'scene_sync',
      userId: this.userId,
      state,
      timestamp: Date.now()
    }

    // 广播到所有用户
    for (const [id, user] of this.users) {
      if (id !== this.userId && user.dataChannel) {
        user.dataChannel.send(JSON.stringify(message))
      }
    }

    console.log('[Collab] Scene state synced:', Object.keys(state))
  }

  /**
   * 同步锚点位置
   */
  syncAnchorState(anchorName, position, quaternion) {
    if (!this.sessionId) return

    const message = {
      type: 'anchor_sync',
      userId: this.userId,
      anchor: {
        name: anchorName,
        position: { x: position.x, y: position.y, z: position.z },
        quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
      },
      timestamp: Date.now()
    }

    console.log('[Collab] Anchor synced:', anchorName)
  }

  /**
   * 处理远程用户状态
   */
  _handleRemoteUserState(message) {
    const { action, user } = message

    if (action === 'join') {
      this.users.set(user.id, { ...user, isLocal: false })
      console.log('[Collab] User joined:', user.name)
      if (this.onUserJoined) {
        this.onUserJoined(user)
      }
    } else if (action === 'leave') {
      this.users.delete(user.id)
      console.log('[Collab] User left:', user.id)
      if (this.onUserLeft) {
        this.onUserLeft(user.id)
      }
    }
  }

  /**
   * 处理远程场景同步
   */
  _handleRemoteSceneSync(message) {
    if (this.onStateSync) {
      this.onStateSync(message.state, message.userId)
    }
  }

  /**
   * 获取当前用户数
   */
  getUserCount() {
    return this.users.size
  }

  /**
   * 获取所有用户
   */
  getUsers() {
    return Array.from(this.users.values())
  }

  /**
   * 获取协作状态
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      userCount: this.users.size,
      users: this.getUsers().map(u => ({
        id: u.id,
        name: u.name,
        isLocal: u.isLocal
      })),
      connected: !!this._dataChannel
    }
  }
}

export default CollaborationManager