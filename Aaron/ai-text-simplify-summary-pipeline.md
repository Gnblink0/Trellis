# AI Text Simplify & Summary Pipeline — 实现报告

## 任务完成情况

**是的，本次任务已完整完成 AI Text Simplify & Summary Pipeline（Task 5）的所有要求。**

对照计划文档中的 10 条验收标准逐一核查：

| # | 验收标准 | 状态 | 说明 |
|---|---|---|---|
| 1 | EA 拍照/从相册选图，设置 3 Toggles，Process，60s 内看到结果 | ✅ | ProcessScreen + HomeScreen 完整实现 |
| 2 | 摘要始终不超过 5 句 | ✅ | 服务端 prompt 约束 + 后端截断双重保障 |
| 3 | G1/G2 简化等级风格差异可见 | ✅ | prompts.ts 中 G1（5-7词）与 G2（8-12词）分开定义 |
| 4 | 单个文本块可独立 Regenerate | ✅ | `/api/adapt/regenerate` + ReviewScreen 卡片按钮 |
| 5 | 摘要可独立 Regenerate | ✅ | 同上，target.type = "summary" |
| 6 | 服务端不保存图像/原文，日志无敏感信息 | ✅ | 日志仅记录耗时和 blockId，无图像和文本内容 |
| 7 | Accept All 后数据结构可传递到 StudentView（console.log 验证） | ✅ | ReviewScreen handleAcceptAll 已实现，含 console.log |
| 8 | 非 worksheet 或空白图像不崩溃，显示合理错误 | ✅ | Alert 错误提示 + try/catch 完整覆盖 |
| 9 | 三个 Toggle 全部关闭时 Process 按钮禁用 | ✅ | hasAtLeastOneToggle 逻辑 + 服务端 Zod 二次拦截 |
| 10 | iOS 模拟器可通过相册选图完成完整流程 | ✅ | expo-image-picker launchImageLibraryAsync |

---

## 实现了什么

用一句话描述：EA 用 iPad 拍一张 worksheet 照片，配置三个选项，AI 自动简化文字并生成摘要，EA 逐条审阅并接受或重试，最终将设备交给学生。

### 用户操作流程

```
Home Screen
  ├── 拍新照片（调用系统相机）
  └── 从相册选择（iOS 模拟器调试用）
        ↓
    Process Screen（配置处理选项）
      ├── Visual Support 开关（为每段文字生成图片描述提示）
      ├── Simplification Level 选择：关闭 / Grade 1 / Grade 2
      └── Summarize 开关（最多 5 句摘要）
        ↓ 点击 "Process Now"
    → 图片压缩 → base64 → 发送给服务端 → GPT-4o 处理
        ↓
    Review Screen（逐条审阅）
      ├── 顶部显示原始照片
      ├── 摘要卡片（若开启）
      ├── 文字块卡片列表（每张卡片：原文 → 简化结果 → 关键词）
      │     ├── Accept → 绿色边框提示已接受
      │     └── Regenerate → 仅重新处理该块
      └── "Accept All & Hand Off" → 传递到 StudentView
```

---

## 更改了什么

### 新建文件

| 文件 | 作用 |
|---|---|
| `shared/src/types.ts` | 前后端共用 TypeScript 类型（ProcessRequest、ProcessResponse、AdaptedBlock 等） |
| `shared/src/index.ts` | 重新导出所有类型 |
| `shared/package.json` | `@trellis/shared` workspace 包配置 |
| `shared/tsconfig.json` | shared 包的 TypeScript 配置 |
| `server/src/prompts.ts` | 系统 prompt、G1/G2 简化指令、动态 prompt 构建、Structured Outputs JSON schema |
| `server/src/schemas.ts` | Zod v4 请求体校验 + GPT 输出结构校验 |
| `server/src/routes/adapt.ts` | `POST /api/adapt/process` 和 `POST /api/adapt/regenerate` 路由实现 |
| `server/.env.example` | 服务端环境变量模板（OPENAI_API_KEY、PORT） |
| `app/src/services/adaptApi.ts` | 前端 API 客户端，60s 超时，返回 discriminated union |
| `app/src/screens/ProcessScreen.tsx` | 拍照预览 + 三个 Toggle 配置 + 图片压缩 + 发送请求 |
| `app/src/screens/ReviewScreen.tsx` | 卡片列表审阅界面，支持 Accept / Regenerate / Accept All |
| `app/.env.example` | 前端环境变量模板（EXPO_PUBLIC_API_URL） |

### 修改文件

| 文件 | 改动内容 |
|---|---|
| `package.json` | workspaces 增加 `"shared"` |
| `app/package.json` | 新增 `expo-image-picker`、`expo-image-manipulator`、`expo-file-system`、`@trellis/shared` |
| `server/package.json` | 新增 `openai`、`zod`、`dotenv`、`@trellis/shared` |
| `server/src/index.ts` | 加载 dotenv，body limit 改为 20mb，挂载 `/api/adapt` 路由 |
| `app/src/screens/HomeScreen.tsx` | 原有按钮占位替换为真实的 expo-image-picker 调用（相机 + 相册） |
| `app/src/navigation/types.ts` | RootStackParamList 新增 Process 和 Review 页面参数，re-export shared 类型 |
| `app/src/navigation/RootNavigator.tsx` | 注册 ProcessScreen 和 ReviewScreen |

---

## 关键技术决策

| 决策 | 选择 | 原因 |
|---|---|---|
| AI 服务 | OpenAI GPT-4o | 多模态，一个 API 完成图像理解 + 文本简化 + 摘要 |
| OCR 策略 | 不用独立 OCR，直接让 GPT-4o 读图 | 架构最简单，减少一次网络往返 |
| 输出格式 | Structured Outputs（json_schema） | 保证 JSON 结构与 schema 完全匹配，无需处理格式错误 |
| 图像选取 | expo-image-picker | 支持相册选图，iOS 模拟器可用；expo-camera 在模拟器上不可用 |
| 类型共享 | @trellis/shared workspace | 前后端编译期类型检查，防止 schema 不同步 |
| 屏幕间传参 | 传 imageUri（非 base64） | 避免导航参数中携带大量数据，性能更好 |
| OpenAI 客户端初始化 | 懒初始化（getOpenAI 函数） | 没有 API key 时服务端启动不崩溃 |

---

## 架构说明

```
前端（React Native）                    后端（Express BFF）
─────────────────────                  ─────────────────────────
HomeScreen（拍照/选图）
       ↓ imageUri
ProcessScreen（配置 Toggle）
       ↓ 图片压缩 → base64
adaptApi.ts ──── POST /api/adapt/process ──→ Zod 校验
                                              ↓
adaptApi.ts ←── 返回 ProcessResponse ────── 动态 Prompt 构建
                                              ↓
ReviewScreen（逐条审阅）                   GPT-4o 调用（Structured Outputs）
       ↓ 单块重生                             ↓
adaptApi.ts ──── POST /api/adapt/regenerate  Zod 二次校验 GPT 输出
                                              ↓
       ↓ Accept All                        构建 ProcessResponse 返回
StudentView（Task 7/8 负责渲染）
```

- **无状态**：服务端不保存任何图像或文本，每次请求完全独立
- **任何 worksheet 均可使用**：废弃了原有的硬编码 Zone 坐标系统，改为 GPT-4o 动态识别文字块
- **出错自动重试一次**：process 接口在 GPT 输出解析失败时自动重试一次

---

## 怎么测试

### 第一步：配置环境

```bash
# 1. 复制环境变量模板
cp server/.env.example server/.env
cp app/.env.example app/.env

# 2. 在 server/.env 中填入你的 OpenAI API Key
#    OPENAI_API_KEY=sk-...

# 3. 从项目根目录安装依赖
npm install
```

### 第二步：启动服务端

```bash
npm run server
# 或：cd server && npx tsx watch src/index.ts
```

验证服务端正常运行：

```bash
# 健康检查
curl http://localhost:3001/health
# 期望返回：{"status":"ok","service":"adapted-bff"}
```

### 第三步：启动 App

```bash
npm run app
# 或：cd app && npx expo start
```

按 `i` 启动 iOS 模拟器（模拟器请用"从相册选图"，相机不可用）。

### 第四步：端到端测试步骤

1. **Home Screen** — 点击"Take a photo"（真机）或"Choose from library"（模拟器）
2. **Process Screen** — 验证：
   - 图片预览正常显示
   - Visual Support 开关、Simplify Level 芯片、Summarize 开关均可点击
   - 三个 Toggle 全部关闭时，"Process Now" 按钮变灰禁用
   - 点击"Process Now" → 出现加载动画和步骤文字
3. **Review Screen** — 验证：
   - 顶部显示原图
   - 显示处理耗时和 simplify level
   - 摘要卡片（若开启 Summarize）正常显示并可 Accept / Regenerate
   - 文字块卡片列出原文 → 简化文字 → 关键词
   - Accept 按钮：卡片出现绿色边框 + 对勾
   - Regenerate 按钮：仅替换该卡片内容，重置 accepted 状态
   - 全部接受后点击 "Hand to Student" → 跳转到 StudentView（控制台可看到 `[ReviewScreen] Handoff data:` 日志）

### 不需要 API Key 的服务端校验测试

```bash
# 三个 Toggle 全关 → 400 校验错误
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,abc","toggles":{"visualSupport":false,"simplifyLevel":null,"summarize":false}}'

# 缺少 imageBase64 → 400 校验错误
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{"toggles":{"visualSupport":true,"simplifyLevel":null,"summarize":false}}'
```

---

## 已知限制（不影响 Task 5 交付）

- **JSX 类型警告**：App 中存在 `'View' cannot be used as a JSX component` 的 TypeScript 警告，这是项目中 React 19 与 React Native 类型版本不匹配的预已存在问题，与本次改动无关
- **StudentView 渲染**：Accept All 后数据已正确传递（console.log 可验证），但 StudentView 用新数据格式的渲染属于 Task 7/8 的工作范围
- **视觉生图**：schema 中已预留 `visualHint` 字段（文字描述），实际图片生成属于 Task 6
- **真机调试**：如需在真机上测试，`app/.env` 中的 `EXPO_PUBLIC_API_URL` 需改为开发机的局域网 IP（如 `http://192.168.1.x:3001`）
