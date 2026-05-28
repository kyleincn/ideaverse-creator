# IdeaVerse Creator - Phase 0

## 项目概述

意图驱动的混合现实（MR）内容自动生成系统 Phase 0 实现。

## 目录结构

```
IdeaVerseCreator_Phase0/
├── src/                        # Node.js 核心代码
│   ├── main.js                 # 主入口 S1→S5 流水线
│   ├── shared/
│   │   └── types.js            # 共享类型定义
│   ├── s1_intent/
│   │   └── index.js            # S1 意图语义解析
│   ├── s2_dispatch/
│   │   └── index.js            # S2 多模态AI调度
│   ├── s3_workspace/
│   │   └── index.js            # S3 本地工作区资产同步
│   └── s4_binding/
│       └── index.js            # S4 句式化视觉逻辑绑定
├── unity_project/               # Unity3D 项目
│   ├── Assets/
│   │   ├── Scenes/
│   │   ├── Prefabs/
│   │   └── Scripts/
│   │       ├── S5_RenderManager.cs
│   │       ├── AssetLoader.cs
│   │       ├── InteractionEngine.cs
│   │       └── SceneLogicBinder.cs
│   └── Packages/
├── workspace/                   # 运行时工作区
│   ├── assets/
│   │   ├── models/
│   │   ├── audio/
│   │   └── ui/
│   ├── registry/
│   └── cache/
├── assets/                      # 预设资产
│   ├── models/
│   ├── audio/
│   └── ui/
└── docs/
```

## 快速开始

### Node.js 流水线

```bash
cd IdeaVerseCreator_Phase0
npm install
node src/main.js              # 默认单次运行
node src/main.js --demo        # 运行三种场景演示
node src/main.js --status      # 查看系统状态
```

### Unity 项目

1. 使用 Unity Hub 打开 `unity_project/` 目录
2. 确保 Unity 版本为 2021.3.31f1c1 (LTS)
3. 打开场景 `Assets/Scenes/MR_Demo.unity`
4. 运行Play模式

## 技术规格

| 模块 | 功能 | 状态 |
|------|------|------|
| S1 | 意图解析 → IntentObject | ✅ Phase 0 |
| S2 | AI调度 → 资产包 | ✅ Phase 0 |
| S3 | 资产注册 → 版本管理 | ✅ Phase 0 |
| S4 | 规则绑定 → SceneLogicBundle | ✅ Phase 0 |
| S5 | Unity MR渲染 | 🔄 进行中 |

## 下一阶段

- [ ] S5 Unity MR 场景完善
- [ ] 热更新机制实现
- [ ] 真实 AI API 对接
- [ ] 双平台打包（PC/iOS）