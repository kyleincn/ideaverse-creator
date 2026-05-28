/**
 * IdeaVerse Creator - 主入口文件
 * S1 → S2 → S3 → S4 → S5 完整流水线演示
 *
 * 运行方式：
 *   node src/main.js                    # 单次运行（默认心脏场景）
 *   node src/main.js --demo             # 演示3个场景
 *   node src/main.js --web              # 生成 WebXR 配置
 */

import { parseIntent } from './s1_intent/index.js'
import { dispatchGeneration } from './s2_dispatch/index.js'
import { syncAssets } from './s3_workspace/index.js'
import { bindRules, getPresetRules } from './s4_binding/index.js'
import { getDispatchStatus } from './s2_dispatch/index.js'
import { getWorkspaceStatus } from './s3_workspace/index.js'
import { getBindingStatus } from './s4_binding/index.js'
import { simulateRender, getRenderStatus } from './s5_webxr/renderer.js'

/**
 * 完整流水线：从意图输入到场景逻辑包输出
 * @param {string} userIntent - 自然语言意图描述
 * @param {Object} options - 可选配置
 * @returns {Object} 包含intentObject, assetPackage, sceneBundle
 */
async function runPipeline(userIntent, options = {}) {
  console.log('='.repeat(60))
  console.log('[Pipeline] Starting IdeaVerse Creator Pipeline')
  console.log('[Pipeline] Input:', userIntent)
  console.log('-'.repeat(60))

  // S1: 意图解析
  console.time('[Pipeline] S1 Intent Parsing')
  const intentObject = parseIntent(userIntent, options)
  console.timeEnd('[Pipeline] S1 Intent Parsing')
  console.log('[Pipeline] IntentObject generated:', intentObject.intent_id)
  printIntentObject(intentObject)
  console.log('-'.repeat(60))

  // S2: AI调度（Phase 0使用模拟资产）
  console.time('[Pipeline] S2 AI Dispatch')
  const assetPackage = await dispatchGeneration(intentObject)
  console.timeEnd('[Pipeline] S2 AI Dispatch')
  console.log('[Pipeline] Asset package generated with', assetPackage.assets.length, 'assets')
  printAssetPackage(assetPackage)
  console.log('-'.repeat(60))

  // S3: 资产同步
  console.time('[Pipeline] S3 Asset Sync')
  const assetRecords = await syncAssets(assetPackage)
  console.timeEnd('[Pipeline] S3 Asset Sync')
  console.log('[Pipeline] Registered', assetRecords.length, 'assets')
  printAssetRecords(assetRecords)
  console.log('-'.repeat(60))

  // S4: 规则绑定
  console.time('[Pipeline] S4 Rule Binding')
  // 如果IntentObject中没有规则，使用预设规则
  const rules = intentObject.interaction_rules.length > 0
    ? intentObject.interaction_rules
    : getPresetRules(intentObject.intent_type, intentObject.subject)
  const sceneBundle = bindRules(rules, assetRecords)
  console.timeEnd('[Pipeline] S4 Rule Binding')
  console.log('[Pipeline] SceneLogicBundle generated:', sceneBundle.bundle_id)
  printSceneBundle(sceneBundle)
  console.log('-'.repeat(60))

  // S5: WebXR 渲染（Three.js）
  console.time('[Pipeline] S5 WebXR Render')
  const webxrConfig = simulateRender(intentObject, sceneBundle, assetRecords)
  console.timeEnd('[Pipeline] S5 WebXR Render')
  console.log('='.repeat(60))

  return {
    intentObject,
    assetPackage,
    assetRecords,
    sceneBundle
  }
}

/**
 * 打印IntentObject摘要
 */
function printIntentObject(intentObj) {
  console.log('  [IntentObject]')
  console.log('    intent_id:', intentObj.intent_id)
  console.log('    intent_type:', intentObj.intent_type)
  console.log('    subject:', intentObj.subject)
  console.log('    target_assets:', intentObj.target_assets.length, 'items')
  console.log('    spatial_constraints.anchor:', intentObj.spatial_constraints.anchor)
  console.log('    interaction_rules:', intentObj.interaction_rules.length, 'rules')
}

/**
 * 打印AssetPackage摘要
 */
function printAssetPackage(pkg) {
  console.log('  [AssetPackage]')
  console.log('    intent_id:', pkg.intent_id)
  console.log('    generated_at:', pkg.generated_at)
  console.log('    assets:')
  for (const asset of pkg.assets) {
    console.log('      -', asset.type, ':', asset.filename, '(' + asset.format + ')')
  }
}

/**
 * 打印AssetRecords
 */
function printAssetRecords(records) {
  for (const r of records) {
    console.log('  [Asset]', r.type, ':', r.filename)
    console.log('    id:', r.id)
    console.log('    path:', r.path)
    console.log('    version:', r.version, 'hash:', r.hash.slice(0, 8))
  }
}

/**
 * 打印SceneLogicBundle摘要
 */
function printSceneBundle(bundle) {
  console.log('  [SceneLogicBundle]')
  console.log('    bundle_id:', bundle.bundle_id)
  console.log('    version:', bundle.version)
  console.log('    rules:')
  for (const rule of bundle.rules) {
    console.log('      -', rule.rule_id)
    console.log('        trigger:', rule.trigger)
    console.log('        action:', rule.action.length, 'items')
    if (rule.trigger_asset_id) {
      console.log('        bound_asset:', rule.trigger_asset_id)
    }
  }
}

/**
 * 打印状态摘要
 */
function printStatusSummary() {
  console.log('\n[System Status]')
  console.log('  S2 Dispatch:', JSON.stringify(getDispatchStatus()))
  console.log('  S3 Workspace:', JSON.stringify(getWorkspaceStatus()))
  console.log('  S4 Binding:', JSON.stringify(getBindingStatus()))
  console.log('  S5 WebXR:', JSON.stringify(getRenderStatus()))
}

// CLI入口
const args = process.argv.slice(2)

if (args.includes('--web')) {
  // Web 模式：生成 WebXR 配置并启动简单服务器
  console.log('\n=== IdeaVerse Creator Web Mode ===\n')

  const defaultInput = '创建一个用于心脏解剖教学的混合现实场景：在桌面中央悬浮显示透明心脏模型，标注主动脉和心室；学生点击主动脉时高亮血流路径，并播放15秒中文讲解音频。'

  runPipeline(defaultInput)
    .then(() => {
      console.log('\n[Web] WebXR config generated. Open web/index.html in browser.')
      printStatusSummary()
    })
    .catch(err => {
      console.error('\n[Pipeline] Error:', err.message)
      process.exit(1)
    })
} else if (args.includes('--demo')) {
  // 运行演示用例
  console.log('\n=== IdeaVerse Creator Phase 0 Demo ===\n')

  const demoInputs = [
    '创建一个用于心脏解剖教学的混合现实场景：在桌面中央悬浮显示透明心脏模型，标注主动脉和心室；学生点击主动脉时高亮血流路径，并播放15秒中文讲解音频。',
    '生成一个智能眼镜产品演示场景：在展台上方展示可拆解3D模型，点击镜腿时展开传感器说明卡片，并播放佩戴方式动画。',
    '创建设备维护流程培训：在真实设备旁按步骤显示操作指引，学员靠近阀门时提示检查压力，完成后给出绿色反馈。'
  ]

  async function runDemos() {
    for (let i = 0; i < demoInputs.length; i++) {
      console.log(`\n[Demo ${i + 1}/${demoInputs.length}]\n`)
      await runPipeline(demoInputs[i])
      if (i < demoInputs.length - 1) {
        console.log('\n' + '-'.repeat(60) + '\n')
      }
    }
    printStatusSummary()
    console.log('\n=== Demo Complete ===\n')
  }

  runDemos().catch(console.error)
} else if (args.includes('--status')) {
  printStatusSummary()
} else {
  // 默认单次运行
  const defaultInput = '创建一个用于心脏解剖教学的混合现实场景：在桌面中央悬浮显示透明心脏模型，标注主动脉和心室；学生点击主动脉时高亮血流路径，并播放15秒中文讲解音频。'

  runPipeline(defaultInput)
    .then(result => {
      console.log('\n[Pipeline] Execution completed successfully')
      printStatusSummary()
    })
    .catch(err => {
      console.error('\n[Pipeline] Error:', err.message)
      process.exit(1)
    })
}