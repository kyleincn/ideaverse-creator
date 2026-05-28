import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useStore } from '../store/index.js'
import './Viewer3D.css'

const TRANSFORM_MODES = ['translate', 'rotate', 'scale']

// Built-in geometries
const BUILTIN_GEOMETRIES = [
  { id: 'box', name: '立方体', icon: '▣', create: () => new THREE.BoxGeometry(1, 1, 1) },
  { id: 'sphere', name: '球体', icon: '●', create: () => new THREE.SphereGeometry(0.6, 32, 32) },
  { id: 'cylinder', name: '圆柱', icon: '⬭', create: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32) },
  { id: 'cone', name: '圆锥', icon: '△', create: () => new THREE.ConeGeometry(0.6, 1, 32) },
  { id: 'torus', name: '圆环', icon: '◎', create: () => new THREE.TorusGeometry(0.5, 0.2, 16, 48) },
  { id: 'torusKnot', name: '环结', icon: '∞', create: () => new THREE.TorusKnotGeometry(0.4, 0.15, 64, 8) },
  { id: 'octahedron', name: '八面体', icon: '◇', create: () => new THREE.OctahedronGeometry(0.6) },
  { id: 'dodecahedron', name: '十二面体', icon: '⬡', create: () => new THREE.DodecahedronGeometry(0.6) },
  { id: 'tetrahedron', name: '四面体', icon: '▲', create: () => new THREE.TetrahedronGeometry(0.7) },
  { id: 'icosahedron', name: '二十面体', icon: '✦', create: () => new THREE.IcosahedronGeometry(0.6) },
  { id: 'torus', name: '环面', icon: '◯', create: () => new THREE.TorusGeometry(0.5, 0.2, 16, 48) },
  { id: 'plane', name: '平面', icon: '▬', create: () => new THREE.PlaneGeometry(1.5, 1.5) },
  { id: 'ring', name: '圆环面', icon: '⊙', create: () => new THREE.RingGeometry(0.4, 0.7, 32) },
  { id: 'shape', name: '自定义形状', icon: '✱', create: () => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.5)
    shape.lineTo(0.5, -0.5)
    shape.lineTo(-0.5, -0.5)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false })
  }}
]

// Model format extensions
const MODEL_FORMATS = [
  { ext: 'glb', name: 'GLB/GLTF', icon: '📦' },
  { ext: 'gltf', name: 'GLTF', icon: '📦' },
  { ext: 'obj', name: 'OBJ', icon: '📐' },
  { ext: 'fbx', name: 'FBX', icon: '🎭' },
  { ext: 'stl', name: 'STL', icon: '🔷' }
]

export default function Viewer3D() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const modelsGroupRef = useRef(null)
  const selectedModelRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const highlightRef = useRef(null)
  const labelGroupRef = useRef(null)
  const helperGroupRef = useRef(null)
  const fileInputRef = useRef(null)

  const { assetPackage, sceneBundle, assets, previewAsset, setPreviewAsset } = useStore()
  const [loading, setLoading] = useState(false)
  const [modelInfo, setModelInfo] = useState(null)
  const [activeEffect, setActiveEffect] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [transformMode, setTransformMode] = useState('translate')
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [showGeoPicker, setShowGeoPicker] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [models, setModels] = useState([])

  const createDemoCubeWithReturn = (scene) => {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const material = new THREE.MeshStandardMaterial({
      color: 0x0F9F92,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x0F9F92,
      emissiveIntensity: 0.1
    })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.y = 0.25
    cube.castShadow = true
    cube.receiveShadow = true
    cube.name = 'demo_cube'
    scene.add(cube)
    return cube
  }

  const createDemoCube = useCallback((scene, targetRef) => {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const material = new THREE.MeshStandardMaterial({
      color: 0x0F9F92,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x0F9F92,
      emissiveIntensity: 0.1
    })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.y = 0.25
    cube.castShadow = true
    cube.receiveShadow = true
    cube.name = 'demo_cube'
    scene.add(cube)
    if (targetRef) targetRef.current = cube
    return cube
  }, [])

  const setupLights = useCallback((scene) => {
    // Ambient light - base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2)
    mainLight.position.set(5, 10, 5)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    mainLight.shadow.camera.near = 0.1
    mainLight.shadow.camera.far = 50
    mainLight.shadow.camera.left = -10
    mainLight.shadow.camera.right = 10
    mainLight.shadow.camera.top = 10
    mainLight.shadow.camera.bottom = -10
    scene.add(mainLight)

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
    fillLight.position.set(-5, 5, -5)
    scene.add(fillLight)

    // Rim light from below
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4)
    rimLight.position.set(0, -5, 0)
    scene.add(rimLight)

    // Additional point light for better coverage
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 20)
    pointLight.position.set(0, 5, 0)
    scene.add(pointLight)
  }, [])

  const createTransformHelpers = useCallback((scene) => {
    const group = new THREE.Group()
    group.name = 'transform_helpers'
    scene.add(group)
    helperGroupRef.current = group
  }, [])

  const updateTransformHelpers = useCallback((mode, object) => {
    if (!helperGroupRef.current || !object) return
    helperGroupRef.current.clear()

    if (mode === 'translate') {
      const size = 0.5
      const headLen = 0.12
      const shaftLen = 0.4
      const headWidth = 0.06
      const shaftWidth = 0.025

      const arrowRed = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), size, AXIS_COLORS.x, headLen, headWidth, shaftWidth)
      const arrowGreen = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), size, AXIS_COLORS.y, headLen, headWidth, shaftWidth)
      const arrowBlue = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), size, AXIS_COLORS.z, headLen, headWidth, shaftWidth)
      helperGroupRef.current.add(arrowRed, arrowGreen, arrowBlue)
    } else if (mode === 'rotate') {
      const radius = 0.55
      const tube = 0.02

      const ringGeo = (color) => {
        const geo = new THREE.TorusGeometry(radius, tube, 8, 32)
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        return new THREE.Mesh(geo, mat)
      }
      const ringX = ringGeo(AXIS_COLORS.x)
      const ringY = ringGeo(AXIS_COLORS.y)
      const ringZ = ringGeo(AXIS_COLORS.z)
      ringX.rotation.y = Math.PI/2
      ringY.rotation.x = Math.PI/2
      helperGroupRef.current.add(ringX, ringY, ringZ)
    } else if (mode === 'scale') {
      const size = 0.5
      const boxSize = 0.08

      const boxGeo = (color) => new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, boxSize), new THREE.MeshBasicMaterial({ color }))

      const boxRed = boxGeo(AXIS_COLORS.x); boxRed.position.set(size, 0, 0)
      const boxGreen = boxGeo(AXIS_COLORS.y); boxGreen.position.set(0, size, 0)
      const boxBlue = boxGeo(AXIS_COLORS.z); boxBlue.position.set(0, 0, size)

      const lineMat = (color) => new THREE.LineBasicMaterial({ color })
      const makeLine = (dir) => {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), dir.clone().multiplyScalar(size - boxSize/2)])
        return new THREE.Line(geo, lineMat(dir.x === 1 ? AXIS_COLORS.x : dir.y === 1 ? AXIS_COLORS.y : AXIS_COLORS.z))
      }

      helperGroupRef.current.add(boxRed, boxGreen, boxBlue, makeLine(new THREE.Vector3(1,0,0)), makeLine(new THREE.Vector3(0,1,0)), makeLine(new THREE.Vector3(0,0,1)))
    }
  }, [])

  const getSelectedModel = useCallback(() => {
    if (!selectedModelId || !modelsGroupRef.current) return null
    return modelsGroupRef.current.getObjectByProperty('userId', selectedModelId)
  }, [selectedModelId])

  const syncHelpersToObject = useCallback(() => {
    if (!helperGroupRef.current) return
    const model = getSelectedModel()
    if (!model) return
    helperGroupRef.current.position.copy(model.position)
    helperGroupRef.current.rotation.copy(model.rotation)
    helperGroupRef.current.scale.copy(model.scale)
  }, [getSelectedModel])

  // Load asset model (from asset library)
  const loadAssetModel = useCallback((asset) => {
    if (!sceneRef.current || !modelsGroupRef.current) return
    setLoading(true)

    const loader = new GLTFLoader()
    loader.load(
      asset.url,
      (gltf) => {
        gltf.scene.userId = 'asset_' + Date.now()
        modelsGroupRef.current.add(gltf.scene)

        const newModel = { id: gltf.scene.userId, name: asset.name, object: gltf.scene }
        setModels(prev => [...prev, newModel])
        setSelectedModelId(gltf.scene.userId)

        // Center and scale
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2 / maxDim
        gltf.scene.scale.setScalar(scale)
        gltf.scene.position.sub(center.multiplyScalar(scale))
        gltf.scene.position.y = 0

        setModelInfo({ name: asset.name, triangles: gltf.scene.children.length, size: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}` })
        setLoading(false)
      },
      undefined,
      (error) => {
        console.error('[Viewer3D] Model load error:', error)
        setLoading(false)
      }
    )
  }, [])

  // Create built-in geometry
  const createGeometry = useCallback((geoDef) => {
    if (!sceneRef.current || !modelsGroupRef.current) return

    const geometry = geoDef.create()
    const material = new THREE.MeshStandardMaterial({
      color: 0x19b6a6,
      metalness: 0.3,
      roughness: 0.4,
      flatShading: false,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 0.5
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = geoDef.name
    mesh.userId = 'geo_' + Date.now()

    modelsGroupRef.current.add(mesh)

    const newModel = { id: mesh.userId, name: geoDef.name, object: mesh }
    setModels(prev => [...prev, newModel])
    setSelectedModelId(mesh.userId)

    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    setModelInfo({ name: geoDef.name, triangles: geometry.attributes.position.count / 3, size: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}` })
  }, [])

  // Handle file import
  // Handle file import
  const handleFileImport = useCallback((event) => {
    const file = event.target.files[0]
    if (!file || !sceneRef.current || !modelsGroupRef.current) return

    const extension = file.name.split('.').pop().toLowerCase()
    const fileUrl = URL.createObjectURL(file)
    console.log('[Viewer3D] Loading file:', file.name, 'extension:', extension, 'url:', fileUrl)

    const loader = new GLTFLoader()

    const onLoad = (gltf) => {
      gltf.scene.userId = 'file_' + Date.now()
      modelsGroupRef.current.add(gltf.scene)

      const newModel = { id: gltf.scene.userId, name: file.name, object: gltf.scene }
      setModels(prev => [...prev, newModel])
      setSelectedModelId(gltf.scene.userId)

      // Center and scale
      const box = new THREE.Box3().setFromObject(gltf.scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2 / maxDim
      gltf.scene.scale.setScalar(scale)
      gltf.scene.position.sub(center.multiplyScalar(scale))
      gltf.scene.position.y = 0

      const bboxSize = box.getSize(new THREE.Vector3())
      setModelInfo({ name: file.name, triangles: gltf.scene.children.length, size: `${bboxSize.x.toFixed(2)} × ${bboxSize.y.toFixed(2)} × ${bboxSize.z.toFixed(2)}` })

      URL.revokeObjectURL(fileUrl)
    }

    const onProgress = (xhr) => {
      console.log('[Viewer3D] Loading progress:', (xhr.loaded / xhr.total * 100).toFixed(1) + '%')
    }

    const onError = (err) => {
      console.error('[Viewer3D] Model load error:', err)
      alert('模型加载失败: ' + err.message)
      URL.revokeObjectURL(fileUrl)
    }

    if (['glb', 'gltf'].includes(extension)) {
      loader.load(fileUrl, onLoad, onProgress, onError)
    } else {
      alert('不支持的格式: ' + extension)
      URL.revokeObjectURL(fileUrl)
    }
  }, [])

  // Export model
  const exportModel = useCallback((format) => {
    const mesh = getSelectedModel()
    if (!mesh) {
      alert('没有可导出的模型')
      return
    }

    let data, filename, mimeType

    if (format === 'glb') {
      const exporter = new GLTFExporter()
      exporter.parse(mesh, (result) => {
        const blob = new Blob([result], { type: 'model/gltf-binary' })
        downloadBlob(blob, `${mesh.name || 'model'}.glb`)
      }, { binary: true })
      return
    } else if (format === 'obj') {
      const objStr = meshToObjString(mesh)
      data = objStr
      filename = `${mesh.name || 'model'}.obj`
      mimeType = 'text/plain'
    } else if (format === 'json') {
      data = JSON.stringify(mesh.toJSON(), null, 2)
      filename = `${mesh.name || 'model'}.json`
      mimeType = 'application/json'
    }

    const blob = new Blob([data], { type: mimeType })
    downloadBlob(blob, filename)
  }, [])

  const meshToObjString = (mesh) => {
    let output = ''
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry
        const pos = geo.attributes.position

        output += `o ${child.name || 'Mesh'}\n`

        for (let i = 0; i < pos.count; i++) {
          const v = pos.getX(i).toFixed(4) + ' ' + pos.getY(i).toFixed(4) + ' ' + pos.getZ(i).toFixed(4)
          output += `v ${v}\n`
        }

        for (let i = 0; i < pos.count; i += 3) {
          output += `f ${i+1} ${i+2} ${i+3}\n`
        }
      }
    })
    return output
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const triggerRuleEffect = useCallback((trigger, position) => {
    if (!sceneRef.current) return

    if (position) {
      const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x0F9F92,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.copy(position)
      ring.position.y += 0.01
      ring.rotation.x = -Math.PI / 2
      ring.name = 'highlight_ring'
      sceneRef.current.add(ring)
      highlightRef.current = ring

      let scale = 1
      const expandInterval = setInterval(() => {
        scale += 0.1
        ring.scale.setScalar(scale)
        ringMaterial.opacity -= 0.05
        if (ringMaterial.opacity <= 0) {
          clearInterval(expandInterval)
          sceneRef.current.remove(ring)
          if (highlightRef.current === ring) {
            highlightRef.current = null
          }
          ringGeometry.dispose()
          ringMaterial.dispose()
        }
      }, 50)

      setActiveEffect({ type: trigger, position })
      setTimeout(() => setActiveEffect(null), 2000)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a10)

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 1.5, 4)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 0.5
    controls.maxDistance = 20
    controls.target.set(0, 0.5, 0)
    controlsRef.current = controls

    setupLights(scene)

    const grid = new THREE.GridHelper(10, 20, 0x19b6a6, 0x1f2a36)
    scene.add(grid)

    scene.fog = new THREE.Fog(0x070a10, 10, 50)

    const labelGroup = new THREE.Group()
    labelGroup.name = 'labels'
    scene.add(labelGroup)
    labelGroupRef.current = labelGroup

    // Models group for multiple models
    const modelsGroup = new THREE.Group()
    modelsGroup.name = 'models'
    scene.add(modelsGroup)
    modelsGroupRef.current = modelsGroup

    createTransformHelpers(scene)

    cameraRef.current = camera
    rendererRef.current = renderer
    sceneRef.current = scene

    // Add demo cube as initial model
    const demoCube = createDemoCubeWithReturn(scene)
    if (demoCube) {
      modelsGroupRef.current.add(demoCube)
      setModels([{ id: 'demo_cube', name: '演示立方体', object: demoCube }])
    }

    let animationId
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      controls.update()

      // Rotate demo cube
      if (modelsGroupRef.current) {
        modelsGroupRef.current.children.forEach(child => {
          if (child.name === 'demo_cube') {
            child.rotation.y += 0.002
          }
        })
      }

      if (highlightRef.current) {
        highlightRef.current.rotation.y += 0.02
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleClick = (event) => {
      if (!cameraRef.current || !modelsGroupRef.current) return

      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
      const intersects = raycasterRef.current.intersectObjects(modelsGroupRef.current.children, true)

      if (intersects.length > 0) {
        const hitPoint = intersects[0].point
        console.log('[Viewer3D] Click hit:', hitPoint)
        triggerRuleEffect('user_tap', hitPoint)
      }
    }

    container.addEventListener('click', handleClick)

    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [createDemoCube, setupLights, triggerRuleEffect])

  // Load model from asset package
  useEffect(() => {
    const modelUrl = assetPackage?.modelUrl
    if (!modelUrl || !sceneRef.current || !modelsGroupRef.current) return
    console.log('[Viewer3D] Loading model:', modelUrl)
    setLoading(true)

    const loader = new GLTFLoader()
    loader.load(
      modelUrl,
      (gltf) => {
        const scene = sceneRef.current
        const modelsGroup = modelsGroupRef.current

        const model = gltf.scene
        model.userId = 'asset_' + Date.now()
        modelsGroup.add(model)

        const newModel = { id: model.userId, name: modelUrl.split('/').pop(), object: model }
        setModels(prev => [...prev, newModel])
        setSelectedModelId(model.userId)

        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2 / maxDim
        model.scale.setScalar(scale)
        model.position.sub(center.multiplyScalar(scale))
        model.position.y = 0

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        setModelInfo({
          name: modelUrl.split('/').pop(),
          triangles: gltf.scene.children.length,
          size: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`
        })

        setLoading(false)
        console.log('[Viewer3D] Model loaded successfully')
      },
      undefined,
      (error) => {
        console.error('[Viewer3D] Model load error:', error)
        setLoading(false)
      }
    )
  }, [assetPackage?.modelUrl])

  // Load model when user selects asset from picker
  useEffect(() => {
    if (!previewAsset?.url || !sceneRef.current) return
    loadAssetModel(previewAsset.url, previewAsset.name)
    setShowAssetPicker(false)
    setPreviewAsset(null)
  }, [previewAsset])

  // Update transform helpers when mode or object changes
  useEffect(() => {
    if (!editMode) return
    const model = getSelectedModel()
    if (model) {
      updateTransformHelpers(transformMode, model)
      syncHelpersToObject()
    }
  }, [editMode, transformMode, updateTransformHelpers, syncHelpersToObject, getSelectedModel])

  useEffect(() => {
    if (!sceneBundle?.rules || !sceneRef.current) return

    console.log('[Viewer3D] Applying scene bundle with', sceneBundle.rules.length, 'rules')

    if (labelGroupRef.current) {
      labelGroupRef.current.clear()
    }
  }, [sceneBundle])

  // Keyboard shortcuts for transform
  useEffect(() => {
    if (!editMode) return

    const handleKey = (e) => {
      const model = getSelectedModel()
      if (!model) return
      const step = e.shiftKey ? 0.1 : 0.01
      if (e.key === 'ArrowUp') model.position.y += step
      if (e.key === 'ArrowDown') model.position.y -= step
      if (e.key === 'ArrowLeft') model.position.x -= step
      if (e.key === 'ArrowRight') model.position.x += step
      if (e.key === 'q' || e.key === 'Q') model.rotation.y -= step * 5
      if (e.key === 'e' || e.key === 'E') model.rotation.y += step * 5
      if (e.key === 'r' || e.key === 'R') model.scale.multiplyScalar(1 + step)
      if (e.key === 'f' || e.key === 'F') model.scale.multiplyScalar(1 - step)
      syncHelpersToObject()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editMode, syncHelpersToObject, getSelectedModel])

  return (
    <div className="viewer3d">
      <div className="viewer-header">
        <div>
          <span className="viewer-title">MR 场景预览</span>
          <span className="viewer-subtitle">实时检查模型、锚点与交互反馈</span>
        </div>
        <div className="viewer-toolbar">
          {editMode && (
            <div className="transform-toolbar">
              <span className="toolbar-label">变换:</span>
              <button
                className={`tool-btn ${transformMode === 'translate' ? 'active' : ''}`}
                onClick={() => setTransformMode('translate')}
                title="移动 (G)"
              >
                ↔
              </button>
              <button
                className={`tool-btn ${transformMode === 'rotate' ? 'active' : ''}`}
                onClick={() => setTransformMode('rotate')}
                title="旋转 (R)"
              >
                ↻
              </button>
              <button
                className={`tool-btn ${transformMode === 'scale' ? 'active' : ''}`}
                onClick={() => setTransformMode('scale')}
                title="缩放 (E)"
              >
                ⤡
              </button>
              <span className="toolbar-divider" />
              <button
                className="tool-btn"
                onClick={() => {
                  const model = getSelectedModel()
                  if (model) {
                    model.position.set(0, 0, 0)
                    model.rotation.set(0, 0, 0)
                    model.scale.setScalar(1)
                    syncHelpersToObject()
                  }
                }}
                title="重置"
              >
                ⟲
              </button>
            </div>
          )}
          <button
            className={`tool-btn edit-toggle ${editMode ? 'active' : ''}`}
            onClick={() => {
              setEditMode(!editMode)
              if (!editMode) {
                const model = getSelectedModel()
                if (model) {
                  updateTransformHelpers(transformMode, model)
                  syncHelpersToObject()
                }
              } else if (helperGroupRef.current) {
                helperGroupRef.current.clear()
              }
            }}
            title="编辑模式"
          >
            ✎ {editMode ? '退出编辑' : '编辑'}
          </button>
          <button
            className="tool-btn"
            onClick={() => setShowAssetPicker(true)}
            title="从资产库添加"
          >
            + 资产
          </button>
          <button
            className="tool-btn"
            onClick={() => setShowGeoPicker(true)}
            title="内置几何体"
          >
            ◇ 几何体
          </button>
          <div className="import-export-menu">
            <button
              className="tool-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="导入/导出"
            >
              ↕ 导入导出
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <div className="export-section">
                  <h4>导入</h4>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".glb,.gltf"
                    onChange={handleFileImport}
                  />
                  <button
                    className="dropdown-btn"
                    onClick={() => {
                      fileInputRef.current?.click()
                    }}
                  >
                    📂 导入模型文件
                  </button>
                </div>
                <div className="export-section">
                  <h4>导出</h4>
                  <button className="dropdown-btn" onClick={() => { exportModel('glb'); setShowExportMenu(false) }}>
                    📦 导出 GLB
                  </button>
                  <button className="dropdown-btn" onClick={() => { exportModel('obj'); setShowExportMenu(false) }}>
                    📐 导出 OBJ
                  </button>
                  <button className="dropdown-btn" onClick={() => { exportModel('json'); setShowExportMenu(false) }}>
                    📄 导出 JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <span className="viewer-hint">拖拽旋转 · 滚轮缩放 · 右键平移 · 点击模型触发</span>
      </div>
      <div ref={containerRef} className="viewer-container" />
      {loading && (
        <div className="viewer-loading">
          <div className="loading-spinner" />
          <span>加载模型中...</span>
        </div>
      )}
      {modelInfo && !loading && (
        <div className="viewer-model-info">
          <span className="model-name">{modelInfo.name}</span>
          <span className="model-meta">{modelInfo.triangles} objects · {modelInfo.size}</span>
        </div>
      )}

      {/* Models List */}
      {models.length > 0 && (
        <div className="viewer-models-list">
          <div className="models-list-header">模型 ({models.length})</div>
          <div className="models-list-items">
            {models.map(m => (
              <div
                key={m.id}
                className={`model-list-item ${selectedModelId === m.id ? 'selected' : ''}`}
                onClick={() => setSelectedModelId(m.id)}
              >
                <span className="model-list-name">{m.name}</span>
                <button
                  className="model-list-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    const obj = modelsGroupRef.current?.getObjectByProperty('userId', m.id)
                    if (obj) {
                      modelsGroupRef.current.remove(obj)
                      obj.traverse(child => {
                        if (child.geometry) child.geometry.dispose()
                        if (child.material) child.material.dispose()
                      })
                    }
                    setModels(prev => prev.filter(x => x.id !== m.id))
                    if (selectedModelId === m.id) setSelectedModelId(null)
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeEffect && (
        <div className="viewer-effect-indicator">
          <span className="effect-icon">✓</span>
          <span>{activeEffect.type} 触发成功</span>
        </div>
      )}
      <div className="viewer-overlay">
        <span>WebGL · Three.js</span>
      </div>

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="asset-picker-overlay" onClick={() => setShowAssetPicker(false)}>
          <div className="asset-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="asset-picker-header">
              <h3>选择资产</h3>
              <button className="close-btn" onClick={() => setShowAssetPicker(false)}>×</button>
            </div>
            <div className="asset-picker-body">
              <div className="asset-picker-filters">
                <button className={`filter-btn ${'all'}`} onClick={() => {}}>全部</button>
                {[{id: '3D Model', name: '3D模型'}, {id: 'Texture', name: '纹理'}, {id: 'Audio', name: '音频'}].map(t => (
                  <button key={t.id} className="filter-btn">{t.name}</button>
                ))}
              </div>
              <div className="asset-picker-grid">
                {assets.length === 0 ? (
                  <div className="picker-empty">
                    <p>暂无可用资产</p>
                    <small>请先在「Assets」标签页添加资产</small>
                  </div>
                ) : (
                  assets.filter(a => a.type === '3D Model').map(asset => (
                    <div
                      key={asset.id}
                      className="asset-picker-item"
                      onClick={() => {
                        useStore.getState().setPreviewAsset(asset)
                      }}
                    >
                      <div className="picker-item-icon">🎮</div>
                      <span className="picker-item-name">{asset.name}</span>
                      <span className="picker-item-type">{asset.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geometry Picker Modal */}
      {showGeoPicker && (
        <div className="asset-picker-overlay" onClick={() => setShowGeoPicker(false)}>
          <div className="asset-picker-modal geo-picker" onClick={(e) => e.stopPropagation()}>
            <div className="asset-picker-header">
              <h3>内置几何体</h3>
              <button className="close-btn" onClick={() => setShowGeoPicker(false)}>×</button>
            </div>
            <div className="asset-picker-body">
              <div className="geo-grid">
                {BUILTIN_GEOMETRIES.map(geo => (
                  <div
                    key={geo.id}
                    className="geo-item"
                    onClick={() => {
                      createGeometry(geo)
                      setShowGeoPicker(false)
                    }}
                  >
                    <span className="geo-icon">{geo.icon}</span>
                    <span className="geo-name">{geo.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
