/**
 * S5 WebXR: 基于 Three.js + WebXR 的 MR 渲染模块
 * 功能：在浏览器中渲染混合现实场景
 *
 * Phase 1 Web版本：
 * - Three.js 场景管理
 * - WebXR AR/VR 模式支持
 * - 手势/凝视/接近交互
 * - 空间锚点定位
 */

import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'

/**
 * WebXR渲染器类
 */
export class WebXRRenderer {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controllers = []
    this.assets = new Map() // asset_id -> Three.js Object3D
    this.rules = [] // 交互规则
    this.xrSession = null

    // 配置
    this.config = {
      container: null,
      antialias: true,
      alpha: true,
      webglVersion: 2
    }
  }

  /**
   * 初始化 Three.js 场景
   * @param {HTMLElement} container - 渲染容器
   */
  init(container) {
    this.config.container = container

    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x111111)

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    )
    this.camera.position.set(0, 1.6, 0.5)

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.config.antialias,
      alpha: this.config.alpha
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.xr.enabled = true
    this.renderer.outputColorSpace = THREE.SRGB_COLOR_SPACE

    container.appendChild(this.renderer.domElement)

    // 添加灯光
    this.setupLighting()

    // 初始化 XR 控制器
    this.setupControllers()

    // 处理窗口大小变化
    window.addEventListener('resize', () => this.onResize())

    console.log('[WebXR] Initialized with Three.js', THREE.REVISION)
    return this
  }

  /**
   * 设置场景灯光
   */
  setupLighting() {
    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambient)

    // 主光源
    const mainLight = new THREE.DirectionalLight(0xffffff, 1)
    mainLight.position.set(5, 10, 5)
    this.scene.add(mainLight)

    // 补光
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-5, 5, -5)
    this.scene.add(fillLight)
  }

  /**
   * 设置 XR 控制器
   */
  setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory()

    // 左控制器
    const controllerGrip1 = this.renderer.xr.getControllerGrip(0)
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
    this.scene.add(controllerGrip1)
    this.controllers.push(controllerGrip1)

    // 右控制器
    const controllerGrip2 = this.renderer.xr.getControllerGrip(1)
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
    this.scene.add(controllerGrip2)
    this.controllers.push(controllerGrip2)

    // 控制器射线
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ])
    const rayMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    })

    for (let i = 0; i < 2; i++) {
      const ray = new THREE.Line(rayGeometry, rayMaterial)
      ray.name = 'ray'
      ray.scale.z = 3
      this.controllers[i].add(ray)
    }
  }

  /**
   * 加载场景配置
   * @param {Object} sceneConfig - 场景配置（来自S5 generateSceneConfig）
   */
  loadSceneConfig(sceneConfig) {
    console.log('[WebXR] Loading scene config:', sceneConfig.scene_name)

    // 应用空间约束
    this.applySpatialConstraints(sceneConfig.spatial)

    // 加载资产
    for (const asset of sceneConfig.assets) {
      this.loadAsset(asset)
    }

    // 绑定交互规则
    this.bindRules(sceneConfig.rules)

    console.log('[WebXR] Scene loaded:', this.assets.size, 'assets,', sceneConfig.rules.length, 'rules')
  }

  /**
   * 应用空间约束
   * @param {Object} spatial - 空间配置
   */
  applySpatialConstraints(spatial) {
    // 根据锚点类型设置场景中心
    switch (spatial.anchor_type) {
      case 'table_center':
        // 默认已经在桌面中央
        break
      case 'floor_plane':
        this.camera.position.set(0, 0, 1)
        break
      case 'wall_anchor':
        this.camera.position.set(-2, 1.5, 0)
        break
    }

    // 应用高度偏移
    if (spatial.height_offset_m) {
      // 资产加载时会应用此偏移
      this.heightOffset = spatial.height_offset_m
    }
  }

  /**
   * 加载单个资产
   * @param {Object} asset - 资产配置
   */
  loadAsset(asset) {
    let mesh

    switch (asset.type) {
      case 'MODEL_3D':
        mesh = this.createPlaceholderMesh(asset)
        break
      case 'UI_LABEL':
        mesh = this.createLabelSprite(asset)
        break
      case 'UI_PANEL':
        mesh = this.createPanelMesh(asset)
        break
      default:
        mesh = this.createPlaceholderMesh(asset)
    }

    mesh.userData.assetId = asset.id
    mesh.userData.assetType = asset.type
    mesh.userData.filename = asset.filename

    this.assets.set(asset.id, mesh)
    this.scene.add(mesh)

    console.log('[WebXR] Loaded asset:', asset.type, asset.filename)
  }

  /**
   * 创建占位网格（Phase 1 演示用）
   * @param {Object} asset - 资产配置
   * @returns {THREE.Mesh}
   */
  createPlaceholderMesh(asset) {
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
    const material = new THREE.MeshStandardMaterial({
      color: this.getColorForType(asset.type),
      transparent: true,
      opacity: 0.8,
      metalness: 0.1,
      roughness: 0.5
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, this.heightOffset || 0.35, 0)

    // 添加边框线
    const edges = new THREE.EdgesGeometry(geometry)
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    )
    mesh.add(line)

    return mesh
  }

  /**
   * 创建标签精灵
   * @param {Object} asset - 资产配置
   * @returns {THREE.Sprite}
   */
  createLabelSprite(asset) {
    // 创建文字纹理
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = 'white'
    ctx.font = '24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(asset.filename.replace('.json', ''), 128, 32)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(0.5, 0.125, 1)
    sprite.position.set(0, 0.8, 0)

    return sprite
  }

  /**
   * 创建面板网格
   * @param {Object} asset - 资产配置
   * @returns {THREE.Mesh}
   */
  createPanelMesh(asset) {
    const geometry = new THREE.PlaneGeometry(0.6, 0.4)
    const material = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, 0.5, 0)

    return mesh
  }

  /**
   * 根据资产类型获取颜色
   * @param {string} type
   * @returns {number}
   */
  getColorForType(type) {
    const colors = {
      MODEL_3D: 0xff4444,
      AUDIO: 0x44ff44,
      UI_LABEL: 0x4444ff,
      UI_PANEL: 0xff44ff,
      ANIMATION: 0xffff44
    }
    return colors[type] || 0xffffff
  }

  /**
   * 绑定交互规则
   * @param {Array} rules - 规则配置
   */
  bindRules(rules) {
    this.rules = rules

    for (const rule of rules) {
      console.log('[WebXR] Binding rule:', rule.rule_id)

      // 查找触发资产
      const triggerAsset = rule.trigger_asset_id
        ? this.assets.get(rule.trigger_asset_id)
        : null

      if (triggerAsset) {
        // 使网格可交互
        triggerAsset.userData.interactive = true
        triggerAsset.userData.ruleId = rule.rule_id

        // 添加点击事件（通过射线检测）
        this.setupInteractionForMesh(triggerAsset, rule)
      }
    }
  }

  /**
   * 为网格设置交互
   * @param {THREE.Mesh} mesh
   * @param {Object} rule
   */
  setupInteractionForMesh(mesh, rule) {
    // 存储规则引用
    mesh.userData.rule = rule

    // 鼠标/触摸事件（用于非XR模式测试）
    mesh.callback = () => {
      console.log('[WebXR] Rule triggered:', rule.rule_id)
      this.executeRuleActions(rule)
    }
  }

  /**
   * 执行规则动作
   * @param {Object} rule
   */
  executeRuleActions(rule) {
    for (const action of rule.action) {
      if (typeof action === 'string') {
        console.log('[WebXR] Execute action:', action)
      } else if (action.type) {
        this.executeActionByType(action)
      }
    }
  }

  /**
   * 根据类型执行动作
   * @param {Object} action
   */
  executeActionByType(action) {
    switch (action.type) {
      case 'HIGHLIGHT':
        this.highlightAsset(action.target)
        break
      case 'SHOW_LABEL':
        this.showLabel(action.target)
        break
      case 'PLAY_AUDIO':
        this.playAudio(action.asset_id)
        break
      case 'PLAY_ANIMATION':
        this.playAnimation(action.target)
        break
      default:
        console.log('[WebXR] Unknown action type:', action.type)
    }
  }

  /**
   * 高亮资产
   * @param {string} target - 目标名称
   */
  highlightAsset(target) {
    this.assets.forEach((mesh, id) => {
      if (mesh.userData.assetType === 'MODEL_3D') {
        mesh.material.emissive.setHex(0x000000)
      }
    })

    // 找到目标资产并高亮
    this.assets.forEach((mesh) => {
      if (mesh.userData.filename && mesh.userData.filename.includes('heart')) {
        mesh.material.emissive.setHex(0xff0000)
      }
    })
  }

  /**
   * 显示标签
   * @param {string} target
   */
  showLabel(target) {
    console.log('[WebXR] Showing label for:', target)
  }

  /**
   * 播放音频
   * @param {string} assetId
   */
  playAudio(assetId) {
    console.log('[WebXR] Playing audio for:', assetId)
  }

  /**
   * 播放动画
   * @param {string} target
   */
  playAnimation(target) {
    console.log('[WebXR] Playing animation for:', target)
  }

  /**
   * 开始 XR 会话
   */
  async startXRSession() {
    if (this.xrSession) return

    try {
      const sessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      }
      await this.renderer.xr.setSession(await navigator.xr.requestSession('immersive-ar', sessionInit))
      console.log('[WebXR] AR session started')
    } catch (err) {
      console.log('[WebXR] XR not available, running in desktop mode')
    }
  }

  /**
   * 处理窗口大小变化
   */
  onResize() {
    if (!this.config.container) return

    this.camera.aspect = this.config.container.clientWidth / this.config.container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.config.container.clientWidth, this.config.container.clientHeight)
  }

  /**
   * 启动渲染循环
   */
  startRenderLoop() {
    this.renderer.setAnimationLoop((timestamp, frame) => {
      this.renderer.render(this.scene, this.camera)
    })
    console.log('[WebXR] Render loop started')
  }

  /**
   * 获取渲染器状态
   * @returns {Object}
   */
  getStatus() {
    return {
      status: this.renderer ? 'ready' : 'not_initialized',
      xr_enabled: this.renderer?.xr?.isPresenting || false,
      assets_loaded: this.assets.size,
      rules_bound: this.rules.length,
      webxr_supported: 'immersive-ar' in navigator
    }
  }
}

/**
 * 创建并初始化 WebXR 渲染器
 * @param {HTMLElement} container
 * @returns {WebXRRenderer}
 */
export function createWebXRRenderer(container) {
  const renderer = new WebXRRenderer()
  renderer.init(container)
  return renderer
}

/**
 * 检查 WebXR 支持
 * @returns {Object}
 */
export function checkWebXRSupport() {
  return {
    webxr: 'xr' in navigator,
    immersive_ar: 'immersive-ar' in navigator,
    hand_tracking: 'hand-tracking' in navigator
  }
}

export default { WebXRRenderer, createWebXRRenderer, checkWebXRSupport }