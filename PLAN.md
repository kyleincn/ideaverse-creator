# 开发计划

## 当前阶段
- [进行中] Web 版平台轻量化 MVP 开发

## 目标
轻量化实现：复用人人现有的 S1-S4 Node.js 流水线，前端用 React + Three.js

## 技术选型
- 前端：React + Vite + Three.js
- 后端：复用现有 `src/` Node.js 流水线 + REST API 层
- 资产：ModelConverter Node.js 版，资产存本地 workspace

## 待办事项

### Phase 1 - Web 前端基础
- [ ] 创建 React 项目结构（Vite）
- [ ] 实现 Viewer3D 组件（Three.js 加载 GLB）
- [ ] 接入 S1 意图解析 API

### Phase 2 - 核心流程串联
- [ ] 改造 api-server.js 为 REST API 接口
- [ ] S2/S3/S4 全流程串联

### Phase 3 - 功能完善
- [ ] LogicPanel 逻辑绑定面板
- [ ] 实时预览与交互

## 进行中
-

## 已完成
- [x] 技术选型讨论并确定轻量化方案
- [x] 确定目录结构（web/ 前端项目、api/ 路由层）
- [x] 创建 React 项目结构（Vite + React）
- [x] 实现 Viewer3D 组件（Three.js + GLB 加载）
- [x] 实现 IntentInput 组件（调用 S1 API）
- [x] 实现 LogicPanel 组件（规则编辑器 + 逻辑绑定）
- [x] 改造 api-server.js 为 REST API（已支持 /api/generate）
- [x] S2/S3/S4 全流程串联（api-server.js 已实现）
- [x] GLB 模型加载功能（GLTFLoader + 自动居中缩放）
- [x] 逻辑绑定功能（规则创建、触发模拟、删除）
- [x] 实时预览增强（点击触发、高亮波纹、标签系统、光照优化）

## Web 前端目录结构
```
IdeaVerseCreator_Phase0/
├── src/                    # Node.js 流水线（原有）
│   ├── s1_intent/         # S1 意图解析
│   ├── s2_dispatch/       # S2 AI 调度
│   ├── s3_workspace/      # S3 资产同步
│   ├── s4_binding/        # S4 规则绑定
│   ├── s5_webxr/         # S5 渲染
│   └── api-server.js     # REST API（已启用）
├── web/                   # 新建 Web 前端
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── IntentInput.jsx
│   │   │   ├── Viewer3D.jsx
│   │   │   └── LogicPanel.jsx
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── api/           # API 调用
│   │   └── config.js      # 配置
│   └── vite.config.js
└── PLAN.md
```

## 运行方式
```bash
# 终端 1 - 启动后端 API 服务
node src/api-server.js

# 终端 2 - 启动前端开发服务器
cd web && npm run dev
```