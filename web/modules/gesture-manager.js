/**
 * WebXR Gesture Interaction Manager
 * 处理手势交互、射线检测和触发事件
 */

import * as THREE from 'three'

export class GestureManager {
  constructor(scene, camera, renderer) {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.raycaster = new THREE.Raycaster()

    this.controllers = []
    this.hands = []
    this.pointers = []

    this.hoveredObject = null
    this.selectedObject = null

    this.onTap = null
    this.onSqueeze = null
    this.onHover = null
    this.onSelect = null

    this.rayVisual = null
    this._setupRayVisual()
  }

  _setupRayVisual() {
    // 射线可视化
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5)
    ])
    const material = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.6
    })
    this.rayVisual = new THREE.Line(geometry, material)
    this.rayVisual.visible = false
    this.scene.add(this.rayVisual)
  }

  /**
   * 注册 XR 控制器
   */
  registerController(controller, grip) {
    const handler = {
      controller,
      grip,
      ray: this._findRay(controller),
      pointing: false
    }

    controller.addEventListener('selectstart', () => this._onSelectStart(handler))
    controller.addEventListener('selectend', () => this._onSelectEnd(handler))
    controller.addEventListener('squeezestart', () => this._onSqueezeStart(handler))
    controller.addEventListener('squeezeend', () => this._onSqueezeEnd(handler))

    this.controllers.push(handler)
    console.log('[Gesture] Controller registered:', handler.ray ? 'with ray' : 'no ray')
  }

  _findRay(controller) {
    return controller.children.find(child =>
      child.isLine || (child.geometry && child.geometry.type === 'BufferGeometry')
    )
  }

  /**
   * 注册手部追踪
   */
  registerHand(hand) {
    const handler = {
      hand,
      indexTip: null,
      middleTip: null
    }

    // 获取指尖
    hand.addEventListener('tracking', () => {
      const indexTip = hand.joints['index-fingertip']
      const middleTip = hand.joints['middle-fingertip']
      handler.indexTip = indexTip
      handler.middleTip = middleTip

      if (!this.hands.includes(handler)) {
        this.hands.push(handler)
      }
    })

    hand.addEventListener('pinchstart', (event) => this._onPinchStart(event, handler))
    hand.addEventListener('pinchend', (event) => this._onPinchEnd(event, handler))

    console.log('[Gesture] Hand registered')
  }

  /**
   * 更新 - 每帧调用
   */
  update(time, frame) {
    // 更新控制器射线
    for (const handler of this.controllers) {
      this._updateControllerRay(handler)
    }

    // 更新手部追踪
    for (const handler of this.hands) {
      this._updateHandPose(handler, frame)
    }
  }

  _updateControllerRay(handler) {
    if (!handler.controller) return

    // 获取 controller 位置和朝向
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    handler.controller.matrix.decompose(position, quaternion, scale)

    // 设置射线起点和方向
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(quaternion)

    this.raycaster.set(position, direction)
    this.rayVisual.position.copy(position)
    this.rayVisual.lookAt(position.clone().add(direction))
  }

  _updateHandPose(handler, frame) {
    if (!handler.indexTip || !handler.middleTip) return

    // 检测捏合手势
    const indexPos = handler.indexTip.position
    const thumbPos = handler.hand.joints['thumb-fingertip']?.position

    if (indexPos && thumbPos) {
      const distance = indexPos.distanceTo(thumbPos)

      if (distance < 0.02) {
        // 捏合触发 - 使用指尖朝向
        const direction = new THREE.Vector3(0, 0, -1)
        const quaternion = handler.hand.quaternion
        if (quaternion) direction.applyQuaternion(quaternion)
        this._performRaycast(indexPos, direction)
      }
    }
  }

  _onSelectStart(handler) {
    handler.pointing = true
    this._performRaycast()
  }

  _onSelectEnd(handler) {
    handler.pointing = false

    if (this.hoveredObject) {
      if (this.onSelect) {
        this.onSelect(this.hoveredObject)
      }
    }
  }

  _onSqueezeStart(handler) {
    if (this.onSqueeze) {
      this.onSqueeze(this.selectedObject)
    }
  }

  _onSqueezeEnd(handler) {
    // Squeeze end
  }

  _onPinchStart(event, handler) {
    console.log('[Gesture] Pinch start')
    if (this.onTap) {
      this.onTap(event)
    }
  }

  _onPinchEnd(event, handler) {
    console.log('[Gesture] Pinch end')
  }

  _performRaycast(position, direction) {
    if (position && direction) {
      this.raycaster.set(position, direction)
    }

    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    if (intersects.length > 0) {
      const hit = this._findAssetObject(intersects[0].object)
      if (hit) {
        this._handleHover(hit)
        return
      }
    }

    this._handleHover(null)
  }

  _findAssetObject(obj) {
    while (obj && !obj.userData.assetId) {
      obj = obj.parent
    }
    return obj
  }

  _handleHover(obj) {
    if (obj === this.hoveredObject) return

    // 取消之前的 hover
    if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
      this._setHoverEffect(this.hoveredObject, false)
    }

    this.hoveredObject = obj

    // 应用新的 hover
    if (obj && obj !== this.selectedObject) {
      this._setHoverEffect(obj, true)
      if (this.onHover) {
        this.onHover(obj)
      }
    }
  }

  _setHoverEffect(obj, isHover) {
    if (!obj || !obj.material) return

    if (obj.material.emissive) {
      obj.material.emissive.setHex(isHover ? 0x333333 : 0x000000)
    }

    // 缩放效果
    if (obj.scale) {
      const targetScale = isHover ? 1.08 : 1.0
      obj.scale.setScalar(targetScale)
    }
  }

  /**
   * 选择对象
   */
  select(obj) {
    if (this.selectedObject) {
      this._setHoverEffect(this.selectedObject, false)
    }

    this.selectedObject = obj

    if (obj) {
      this._setHoverEffect(obj, true)
      this._animateSelect(obj)
    }
  }

  _animateSelect(obj) {
    const startScale = obj.scale?.x || 1
    const targetScale = 1.12
    const duration = 150
    const startTime = performance.now()

    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 弹性效果
      const eased = 1 - Math.pow(1 - progress, 3)
      const scale = startScale + (targetScale - startScale) * eased

      if (obj.scale) {
        obj.scale.setScalar(scale)
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // 恢复到 1
        setTimeout(() => {
          if (obj.scale && obj !== this.selectedObject) {
            obj.scale.setScalar(1)
          }
        }, 100)
      }
    }

    animate()
  }

  /**
   * 触发规则
   */
  triggerRule(assetId) {
    return assetId
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      controllers: this.controllers.length,
      hands: this.hands.length,
      hoveredObject: this.hoveredObject?.userData?.assetId || null,
      selectedObject: this.selectedObject?.userData?.assetId || null
    }
  }
}

export default GestureManager