/**
 * 资产生成器工具集
 * Phase 1: 创建占位资产文件
 *
 * 使用方式：
 *   node src/tools/generate_assets.js --all
 *   node src/tools/generate_assets.js --models
 *   node src/tools/generate_assets.js --audio
 *   node src/tools/generate_assets.js --labels
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(__dirname, '../../workspace')
const ASSETS_ROOT = path.join(WORKSPACE_ROOT, 'assets')

/**
 * 创建目录
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 生成简单 GLB 占位文件（JSON 格式的 GLB 替代）
 */
function generatePlaceholderGLB(filename, outputPath) {
  // 创建一个最小的无效 GLB（仅用于占位）
  // 真实场景下应该用真正的 GLB 文件
  const placeholder = {
    metadata: {
      version: "1.0",
      type: "PlaceholderGLB",
      generator: "IdeaVerse Creator Phase 1"
    },
    placeholder: true,
    filename: filename
  }

  fs.writeFileSync(outputPath, JSON.stringify(placeholder), 'utf-8')
  console.log(`[Generate] Created placeholder GLB: ${outputPath}`)
}

/**
 * 生成 WAV 占位文件（简单的静音 WAV）
 */
function generatePlaceholderWAV(filename, outputPath, durationSec = 1) {
  // WAV 文件格式：
  // RIFF header (12 bytes) + fmt chunk (24 bytes) + data chunk (8 + samples)
  const sampleRate = 44100
  const numChannels = 1
  const bitsPerSample = 16
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)

  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28)
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 30)
  buffer.writeUInt16LE(bitsPerSample, 32)
  // extra param bytes: 0

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Silence (zeros are silence in PCM)
  // Already zeroed by Buffer.alloc

  fs.writeFileSync(outputPath, buffer)
  console.log(`[Generate] Created placeholder WAV (${durationSec}s): ${outputPath}`)
}

/**
 * 生成 JSON 标注文件
 */
function generateLabelJSON(filename, outputPath, labels = []) {
  const data = {
    version: "1.0",
    type: "UI_LABELS",
    generator: "IdeaVerse Creator Phase 1",
    labels: labels.length > 0 ? labels : [
      { id: "label_1", text: "主动脉", position: "top", color: "#ff4444" },
      { id: "label_2", text: "心室", position: "bottom", color: "#44ff44" },
      { id: "label_3", text: "心房", position: "left", color: "#4444ff" }
    ]
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[Generate] Created label JSON: ${outputPath}`)
}

/**
 * 生成 UI_PANEL JSON 文件
 */
function generatePanelJSON(filename, outputPath) {
  const data = {
    version: "1.0",
    type: "UI_PANEL",
    generator: "IdeaVerse Creator Phase 1",
    panel: {
      title: "信息面板",
      width: 0.5,
      height: 0.35,
      elements: [
        { type: "text", id: "title", content: "组件说明", style: { fontSize: 16, color: "#00d4ff" } },
        { type: "text", id: "desc", content: "点击组件查看详细信息", style: { fontSize: 12, color: "#ffffff" } }
      ]
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[Generate] Created panel JSON: ${outputPath}`)
}

/**
 * 生成所有预设资产生成器
 */
function generateAllAssets() {
  console.log('\n=== IdeaVerse Creator - Asset Generator ===\n')

  // 确保目录存在
  ensureDir(path.join(ASSETS_ROOT, 'models'))
  ensureDir(path.join(ASSETS_ROOT, 'audio'))
  ensureDir(path.join(ASSETS_ROOT, 'ui'))

  // 模型资产
  console.log('\n--- Models ---')
  const models = [
    { filename: 'heart_transparent.glb', type: 'heart' },
    { filename: 'smart_glasses_exploded.glb', type: 'glasses' },
    { filename: 'valve_unit.glb', type: 'valve' },
    { filename: 'default_cube.glb', type: 'cube' }
  ]

  for (const model of models) {
    const outputPath = path.join(ASSETS_ROOT, 'models', model.filename)
    generatePlaceholderGLB(model.filename, outputPath)
  }

  // 音频资产
  console.log('\n--- Audio ---')
  const audioFiles = [
    { filename: 'heart_explanation_zh_cn_15s.wav', duration: 15 },
    { filename: 'glasses_demo.wav', duration: 10 },
    { filename: 'maintenance_guide.wav', duration: 20 }
  ]

  for (const audio of audioFiles) {
    const outputPath = path.join(ASSETS_ROOT, 'audio', audio.filename)
    generatePlaceholderWAV(audio.filename, outputPath, audio.duration)
  }

  // UI 标注
  console.log('\n--- UI Labels ---')
  const labelFiles = [
    { filename: 'heart_anatomy_labels.json', type: 'heart_labels' },
    { filename: 'glasses_component_cards.json', type: 'panel' },
    { filename: 'maintenance_steps.json', type: 'steps' },
    { filename: 'default_labels.json', type: 'default' }
  ]

  for (const label of labelFiles) {
    const outputPath = path.join(ASSETS_ROOT, 'ui', label.filename)
    if (label.type === 'panel') {
      generatePanelJSON(label.filename, outputPath)
    } else {
      generateLabelJSON(label.filename, outputPath)
    }
  }

  console.log('\n=== Asset Generation Complete ===\n')
}

/**
 * 计算文件哈希
 */
function computeHash(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * 显示资产状态
 */
function showAssetStatus() {
  console.log('\n=== Asset Status ===\n')

  const dirs = [
    { path: path.join(ASSETS_ROOT, 'models'), type: 'MODEL_3D' },
    { path: path.join(ASSETS_ROOT, 'audio'), type: 'AUDIO' },
    { path: path.join(ASSETS_ROOT, 'ui'), type: 'UI' }
  ]

  let totalSize = 0

  for (const dir of dirs) {
    if (!fs.existsSync(dir.path)) {
      console.log(`${dir.type}: (directory not found)`)
      continue
    }

    const files = fs.readdirSync(dir.path)
    console.log(`${dir.type} (${files.length} files):`)

    for (const file of files) {
      const filePath = path.join(dir.path, file)
      const stats = fs.statSync(filePath)
      const hash = computeHash(filePath)
      totalSize += stats.size

      console.log(`  - ${file} (${formatSize(stats.size)}) ${hash ? hash.slice(0, 8) : 'N/A'}`)
    }
  }

  console.log(`\nTotal: ${formatSize(totalSize)}\n`)
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// CLI
const args = process.argv.slice(2)

if (args.includes('--all')) {
  generateAllAssets()
  showAssetStatus()
} else if (args.includes('--models')) {
  ensureDir(path.join(ASSETS_ROOT, 'models'))
  generateAllAssets()
} else if (args.includes('--status')) {
  showAssetStatus()
} else {
  // 默认生成所有
  generateAllAssets()
  showAssetStatus()
}

export { generateAllAssets, showAssetStatus }