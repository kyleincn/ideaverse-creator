/**
 * WebXR-Enhanced Three.js Renderer
 * 集成 WebXR Session、空间锚点、手势交互的完整渲染器
 */

import * as THREE from 'three'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { WebXRSessionManager } from './webxr-session.js'
import { SpatialAnchorManager } from './spatial-anchor.js'
import { GestureManager } from './gesture-manager.js'

export class WebXRRenderer {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controllers = []
    this.assets = new Map()
    this.rules = []
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.hoveredObject = null
    this.wireframeMode = false
    this.selectedObject = null
    this.clock = new THREE.Clock()

    // WebXR 模块
    this.sessionManager = null
    this.anchorManager = null
    this.gestureManager = null

    this.onInteractionCallback = null
    this.onSessionStart = null
    this.onSessionEnd = null
  }

  /**
   * 初始化渲染器
   */
  init(container) {
    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0f)

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    )
    this.camera.position.set(0, 1.6, 0.5)

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.xr.enabled = true
    this.renderer.outputColorSpace = THREE.SRGB_COLOR_SPACE
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    container.appendChild(this.renderer.domElement)

    // 初始化 WebXR Session Manager
    this.sessionManager = new WebXRSessionManager(this.renderer)

    // 初始化手势管理器
    this.gestureManager = new GestureManager(this.scene, this.camera, this.renderer)

    // 灯光
    this.setupLighting()

    // 地面网格
    this.setupGroundGrid()

    // 控制器
    this.setupControllers()

    // 事件监听
    window.addEventListener('resize', () => this.onResize(container))
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e, container))
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e, container))

    // Session 事件回调
    this.sessionManager.onSessionStart = (session) => this._onXRStart(session)
    this.sessionManager.onSessionEnd = () => this._onXREnd()

    console.log('[WebXR] Initialized with full WebXR support')
    return this
  }

  setupLighting() {
    // 环境光
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambient)

    // 主光源
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2)
    mainLight.position.set(5, 10, 5)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    mainLight.shadow.camera.near = 0.1
    mainLight.shadow.camera.far = 50
    this.scene.add(mainLight)

    // 补光
    const fillLight = new THREE.DirectionalLight(0x8080ff, 0.4)
    fillLight.position.set(-5, 5, -5)
    this.scene.add(fillLight)

    // 底部反光
    const rimLight = new THREE.DirectionalLight(0xff4040, 0.2)
    rimLight.position.set(0, -2, 0)
    this.scene.add(rimLight)
  }

  setupGroundGrid() {
    // 网格地面
    const gridHelper = new THREE.GridHelper(10, 20, 0x1a1a2e, 0x1a1a2e)
    gridHelper.position.y = 0
    this.scene.add(gridHelper)

    // 圆形地面
    const groundGeo = new THREE.CircleGeometry(2, 64)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      transparent: true,
      opacity: 0.8,
      roughness: 0.9
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0.001
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  setupControllers() {
    const factory = new XRControllerModelFactory()

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i)
      controller.addEventListener('selectstart', () => this.onXRSelect(controller))
      this.scene.add(controller)

      const grip = this.renderer.xr.getControllerGrip(i)
      grip.add(factory.createControllerModel(grip))
      this.scene.add(grip)

      // 射线
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1)
        ]),
        new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.6 })
      )
      ray.name = 'ray'
      ray.scale.z = 3
      controller.add(ray)

      this.controllers.push({ controller, grip, ray })

      // 注册到手势管理器
      if (this.gestureManager) {
        this.gestureManager.registerController(controller, grip)
      }
    }
  }

  /**
   * 启动 AR 会话
   */
  async startARSession(domOverlay = null) {
    try {
      const options = domOverlay ? { domOverlay } : {}
      await this.sessionManager.requestARSession(options)

      // 初始化锚点管理器
      if (this.sessionManager.session) {
        this.anchorManager = new SpatialAnchorManager(this.sessionManager.session)
      }

      return true
    } catch (err) {
      console.error('[WebXR] Failed to start AR session:', err)
      return false
    }
  }

  /**
   * 启动 VR 会话
   */
  async startVRSession() {
    try {
      await this.sessionManager.requestVRSession()
      return true
    } catch (err) {
      console.error('[WebXR] Failed to start VR session:', err)
      return false
    }
  }

  /**
   * 结束 XR 会话
   */
  async endXRSession() {
    await this.sessionManager.endSession()
  }

  _onXRStart(session) {
    console.log('[WebXR] AR session started')
    this.scene.background = null // AR 模式透明背景

    if (this.onSessionStart) {
      this.onSessionStart(session)
    }
  }

  _onXREnd() {
    console.log('[WebXR] Session ended')
    this.scene.background = new THREE.Color(0x0a0a0f)

    if (this.onSessionEnd) {
      this.onSessionEnd()
    }
  }

  loadSceneConfig(config) {
    console.log('[WebXR] Loading scene:', config.scene_name)

    this.clearAssets()

    this.applySpatialConfig(config.spatial)

    for (const asset of config.assets) {
      this.loadAsset(asset)
    }

    this.bindRules(config.rules)

    this.showInteractionHint('点击场景中的物体进行交互')

    console.log('[WebXR] Scene loaded:', this.assets.size, 'assets')
  }

  clearAssets() {
    this.assets.forEach((obj) => {
      this.scene.remove(obj)
    })
    this.assets.clear()
    this.selectedObject = null
  }

  applySpatialConfig(spatial) {
    this.heightOffset = spatial.height_offset_m || 0.35
  }

  loadAsset(asset) {
    let mesh

    switch (asset.type) {
      case 'MODEL_3D':
        mesh = this.createModelMesh(asset)
        break
      case 'UI_LABEL':
        mesh = this.createLabelSprite(asset)
        break
      case 'UI_PANEL':
        mesh = this.createPanelMesh(asset)
        break
      case 'AUDIO':
        mesh = this.createAudioIndicator(asset)
        break
      default:
        mesh = this.createModelMesh(asset)
    }

    mesh.userData.assetId = asset.id
    mesh.userData.assetType = asset.type
    mesh.userData.filename = asset.filename
    mesh.userData.asset = asset

    this.assets.set(asset.id, mesh)
    this.scene.add(mesh)
  }

  createModelMesh(asset) {
    const filename = asset.filename.toLowerCase()

    let geometry, material, mesh

    if (filename.includes('heart')) {
      geometry = new THREE.SphereGeometry(0.12, 32, 32)
      material = new THREE.MeshStandardMaterial({
        color: 0xff3355,
        transparent: true,
        opacity: 0.85,
        metalness: 0.2,
        roughness: 0.5
      })
      mesh = new THREE.Mesh(geometry, material)

      const topGeo = new THREE.SphereGeometry(0.08, 16, 16)
      const topMesh = new THREE.Mesh(topGeo, material)
      topMesh.position.set(-0.04, 0.1, 0)
      mesh.add(topMesh)

    } else if (filename.includes('glasses') || filename.includes('eye')) {
      geometry = new THREE.TorusGeometry(0.06, 0.015, 8, 24)
      material = new THREE.MeshStandardMaterial({
        color: 0x333344,
        metalness: 0.8,
        roughness: 0.2
      })
      mesh = new THREE.Mesh(geometry, material)

      const frameGeo = new THREE.BoxGeometry(0.25, 0.02, 0.02)
      const frameMesh = new THREE.Mesh(frameGeo, material)
      frameMesh.position.z = -0.02
      mesh.add(frameMesh)

    } else if (filename.includes('valve') || filename.includes('equipment')) {
      geometry = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16)
      material = new THREE.MeshStandardMaterial({
        color: 0x44aa44,
        metalness: 0.3,
        roughness: 0.6
      })
      mesh = new THREE.Mesh(geometry, material)

      const handleGeo = new THREE.BoxGeometry(0.1, 0.02, 0.02)
      const handleMesh = new THREE.Mesh(handleGeo, material)
      handleMesh.position.y = 0.09
      mesh.add(handleMesh)

    } else {
      geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
      material = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        metalness: 0.1,
        roughness: 0.5
      })
      mesh = new THREE.Mesh(geometry, material)
    }

    mesh.position.set(
      (Math.random() - 0.5) * 0.2,
      this.heightOffset + (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.2
    )

    mesh.castShadow = true
    mesh.receiveShadow = true

    const edges = new THREE.EdgesGeometry(geometry.clone())
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.3
    })
    const lines = new THREE.LineSegments(edges, lineMat)
    mesh.add(lines)

    return mesh
  }

  createLabelSprite(asset) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64

    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'rgba(18, 18, 26, 0.9)'
    this.roundRect(ctx, 0, 0, 256, 64, 8)
    ctx.fill()

    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 2
    this.roundRect(ctx, 2, 2, 252, 60, 6)
    ctx.stroke()

    ctx.fillStyle = '#00d4ff'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const name = asset.filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
    ctx.fillText(name.toUpperCase(), 128, 32)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(0.4, 0.1, 1)

    return sprite
  }

  createPanelMesh(asset) {
    const geometry = new THREE.PlaneGeometry(0.5, 0.35)
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      roughness: 0.8
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, 0.6, 0)
    mesh.castShadow = true

    const edges = new THREE.EdgesGeometry(geometry)
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 })
    )
    mesh.add(line)

    return mesh
  }

  createAudioIndicator(asset) {
    const group = new THREE.Group()

    const barGeo = new THREE.BoxGeometry(0.015, 0.08, 0.015)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x44ff44 })

    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(barGeo, barMat.clone())
      bar.position.x = i * 0.025
      bar.scale.y = 1 + Math.abs(i) * 0.5
      group.add(bar)
    }

    group.position.set(0, this.heightOffset + 0.25, 0)

    return group
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  bindRules(rules) {
    this.rules = rules
    console.log('[WebXR] Bound', rules.length, 'rules')
  }

  onClick(event, container) {
    if (this.renderer.xr.isPresenting) return

    this.updateMouse(event, container)

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    for (const intersect of intersects) {
      let obj = this.findAssetObject(intersect.object)
      if (!obj) continue

      const rule = this.rules.find(r => r.trigger_asset_id === obj.userData.assetId)
      if (rule) {
        this.triggerRule(rule, obj)
        return
      } else if (obj.userData.assetType === 'MODEL_3D') {
        this.selectObject(obj)
      }
    }
  }

  onMouseMove(event, container) {
    if (this.renderer.xr.isPresenting) return

    this.updateMouse(event, container)

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    if (this.hoveredObject && this.hoveredObject !== intersects[0]?.object) {
      const prev = this.findAssetObject(this.hoveredObject)
      if (prev && prev !== this.selectedObject) {
        this.setHoverEffect(prev, false)
      }
      this.hoveredObject = null
    }

    for (const intersect of intersects) {
      let obj = this.findAssetObject(intersect.object)
      if (obj && obj !== this.hoveredObject && obj !== this.selectedObject) {
        this.hoveredObject = intersect.object
        this.setHoverEffect(obj, true)
        container.style.cursor = 'pointer'
        return
      }
    }

    container.style.cursor = 'default'
  }

  updateMouse(event, container) {
    const rect = container.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  findAssetObject(obj) {
    while (obj && !obj.userData.assetId) {
      obj = obj.parent
    }
    return obj
  }

  setHoverEffect(obj, isHover) {
    if (obj.material && obj.material.emissive) {
      obj.material.emissive.setHex(isHover ? 0x222222 : 0x000000)
    }
    if (obj.scale) {
      const targetScale = isHover ? 1.1 : 1.0
      obj.scale.setScalar(targetScale)
    }
  }

  selectObject(obj) {
    if (this.selectedObject && this.selectedObject !== obj) {
      this.setHoverEffect(this.selectedObject, false)
    }

    this.selectedObject = obj
    this.setHoverEffect(obj, true)
    this.animateSelect(obj)
  }

  animateSelect(obj) {
    const startScale = obj.scale.x
    const targetScale = 1.15
    const duration = 150
    const startTime = performance.now()

    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const eased = 1 - Math.pow(1 - progress, 3)
      const scale = startScale + (targetScale - startScale) * eased

      if (obj.scale) {
        obj.scale.setScalar(scale)
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setTimeout(() => {
          if (obj.scale) obj.scale.setScalar(1)
        }, 100)
      }
    }

    animate()
  }

  onXRSelect(controller) {
    this.raycaster.setFromXRController(controller)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    if (intersects.length > 0) {
      let obj = this.findAssetObject(intersects[0].object)
      if (obj) {
        const rule = this.rules.find(r => r.trigger_asset_id === obj.userData.assetId)
        if (rule) {
          this.triggerRule(rule, obj)
        }
      }
    }
  }

  triggerRule(rule, obj) {
    console.log('[WebXR] Rule triggered:', rule.rule_id)

    this.animateSelect(obj)

    for (const action of rule.actions) {
      this.executeAction(action, obj)
    }

    if (this.onInteractionCallback) {
      this.onInteractionCallback(rule)
    }
  }

  executeAction(action, obj) {
    console.log('[WebXR] Execute:', action.type)

    switch (action.type) {
      case 'HIGHLIGHT':
        this.assets.forEach((mesh) => {
          if (mesh.userData.assetType === 'MODEL_3D' && mesh !== obj) {
            this.flashMesh(mesh, 0xff0000, 500)
          }
        })
        break

      case 'SHOW_LABEL':
        if (obj) {
          this.flashMesh(obj, 0x00d4ff, 300)
        }
        break

      case 'PLAY_AUDIO':
        // Phase 2 实现
        break
    }
  }

  flashMesh(mesh, color, duration) {
    if (!mesh.material) return

    const originalColor = mesh.material.emissive?.getHex() || 0x000000
    mesh.material.emissive.setHex(color)

    setTimeout(() => {
      if (mesh.material) {
        mesh.material.emissive.setHex(originalColor)
      }
    }, duration)
  }

  showInteractionHint(text) {
    const hint = document.getElementById('interaction-hint')
    if (!hint) return
    hint.querySelector('span').textContent = text
    hint.classList.add('visible')

    setTimeout(() => {
      hint.classList.remove('visible')
    }, 3000)
  }

  toggleWireframe() {
    this.wireframeMode = !this.wireframeMode
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.wireframe = this.wireframeMode
      }
    })
  }

  resetCamera() {
    this.camera.position.set(0, 1.6, 0.5)
    this.camera.lookAt(0, 0.35, 0)
  }

  onResize(container) {
    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(container.clientWidth, container.clientHeight)
  }

  startRenderLoop() {
    this.renderer.setAnimationLoop((timestamp, frame) => {
      const delta = this.clock.getDelta()
      const elapsed = this.clock.getElapsedTime()

      // 旋转资产
      this.assets.forEach((mesh, id) => {
        if (mesh.userData.assetType === 'MODEL_3D') {
          mesh.rotation.y = elapsed * 0.3
        }
      })

      // 更新手势管理器
      if (this.gestureManager && frame) {
        this.gestureManager.update(timestamp, frame)
      }

      this.renderer.render(this.scene, this.camera)
    })
  }

  getStatus() {
    const sessionStatus = this.sessionManager?.getStatus() || {}
    const gestureStatus = this.gestureManager?.getStatus() || {}
    const anchorStatus = this.anchorManager?.getStatus() || {}

    return {
      assets: this.assets.size,
      rules: this.rules.length,
      xrPresenting: this.renderer?.xr?.isPresenting || false,
      session: sessionStatus,
      gesture: gestureStatus,
      anchors: anchorStatus
    }
  }

  onInteraction(callback) {
    this.onInteractionCallback = callback
  }

  onSessionStart(callback) {
    this.onSessionStart = callback
  }

  onSessionEnd(callback) {
    this.onSessionEnd = callback
  }
}

export default WebXRRenderer