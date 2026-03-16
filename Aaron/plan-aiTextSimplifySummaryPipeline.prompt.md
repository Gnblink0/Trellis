# AI Text Simplify & Summary Pipeline

## 1. 依据来源说明

本计划的修改依据来自两部分：

1. System Design Document 原文需求
- iPad 拍照输入（Image Capture & Processing）
- 处理前配置 3 Toggles（Visual Support / Simplification Level / Summarization）
- 人在回路（review / accept / regenerate）
- 实时目标（课堂开始前，1 分钟内完成）
- 隐私与无状态（stateless BFF，零持久化敏感记录）
- 摘要上限（最多 5 句）

2. 当前代码现状
- 后端仅有健康检查（`GET /health`），无 AI 路由与编排
- 前端核心流程完全依赖 `MOCK_RESULTS` 硬编码数据
- 前端使用硬编码 Zone（图片区域坐标），仅适用于预置的 3 张 sample 图片
- 无 HTTP 客户端库，无 API 调用代码
- 无 AI SDK 依赖

结论：需要从零搭建后端 AI pipeline，并将前端从"mock zone 点选"模式升级为"拍照 → 一键处理 → 卡片列表审阅"模式。

---

## 2. 技术选型决策

### 2.1 AI 服务：OpenAI GPT-4o

- **理由**：多模态能力强，一个 API 可同时完成图像理解 + 文本简化 + 摘要，社区资源丰富
- **SDK**：`openai` npm 包
- **模型**：`gpt-4o` 用于图像理解 + 文本处理
- **输出格式保障**：使用 Structured Outputs (`response_format: { type: "json_schema", json_schema: {...} }`) 强制保证输出匹配预定义 schema

### 2.2 OCR 策略：多模态 LLM 直接读图

- **做法**：将 worksheet 照片的 base64 直接发送给 GPT-4o，让模型同时完成"识别文本 + 理解结构"
- **优势**：无需独立 OCR 服务，架构最简单，减少一次网络往返
- **一次调用输出**：识别出的文本块（按逻辑段落/区域分组）

### 2.3 前端展示：卡片列表模式

- **做法**：废弃硬编码 Zone 系统，处理结果以卡片列表形式展示
- **布局**：页面顶部展示原始照片（可缩放参考），下方为结果卡片列表
- **每张卡片**：展示一个文本块的「原文 → 简化结果」，附独立的 Accept / Regenerate 按钮
- **优势**：适配任意 worksheet 照片，iPad 竖屏友好，实现简单可靠

### 2.4 类型共享：shared types 包

- **做法**：在 monorepo 中新增 `shared/` workspace，定义前后端共用的请求/响应类型
- **好处**：编译期类型检查，防止前后端 schema 不同步
- **注意**：shared 包仅包含 TypeScript interface/type 定义（无运行时代码），无需编译步骤

---

## 3. Requirements Traceability Matrix（需求追踪矩阵）

| 需求编号 | 文档要求 | 当前状态 | 差距 | 计划改动 | 验收标准 |
|---|---|---|---|---|---|
| FR-1 | iPad 拍照并处理 worksheet 图像 | 前端 HomeScreen 有"拍照"按钮但只是导航占位 | 无真实拍照/图像上传 | 接入 `expo-image-picker`（系统相机拍照 + 相册选图）+ base64 编码发送到后端 | 拍一张照片可触发完整处理流程 |
| FR-2 | 3 Toggles 处理前配置 | 仅有 simplify/visuals/summarize 按钮式单动作 | 非一次性配置 | 新增 Toggle 配置面板（拍照后、处理前），3 个开关统一提交 | 一次请求同时控制简化/摘要/视觉开关 |
| FR-3 | Simplification Level（如 Grade 1/2） | 无等级选择 | 无法指定目标阅读水平 | toggles 中增加 `simplifyLevel` 下拉选择（G1/G2，可扩展） | 不同等级输出风格显著不同 |
| FR-4 | Summarization 最多 5 句 | 无硬约束 | 可能超句数 | prompt 指令 + Structured Outputs schema 约束 + 后端二次截断 | `summary.sentences.length <= 5` |
| FR-5 | Human-in-the-loop review/accept/regenerate | 预览弹窗存在但 regenerate 是空操作 | 无真实重生功能 | 接入 `/api/adapt/regenerate` 接口，支持单卡片重生 | EA 可对单个文本块重生，不触发全量重跑 |
| FR-6 | Student 端低文字输入负担 | Student canvas 已有触控交互 | 与 pipeline 输出绑定不足 | **Task 5 仅预留数据接口**，实际 Student UI 绑定属于 Task 7/8 | 数据结构支持 student handoff |
| FR-7 | 直接导出（Apple Share Sheet） | Export 页面按钮存在但未接通 | 功能未打通 | **Out of Scope**，属于后续集成/UAT | — |
| NFR-1 | 1 分钟内完成（实时） | 无端到端预算 | 无法评估 | GPT-4o 单次调用策略 + 超时控制 | P95 端到端 < 60s |
| NFR-2 | 隐私与无状态 | 架构方向正确 | 日志/缓存策略未明确 | 禁止落盘敏感内容，最小化日志，API key 通过 `.env` 管理 | 无持久化 payload，无敏感信息日志 |

---

## 4. 修订后的范围（Task 5）

Task 5 聚焦**文字处理链路的端到端闭环**：拍照 → AI 处理 → 审阅 → 接受/重生。

### In Scope
1. 后端 AI pipeline（GPT-4o 多模态：图像理解 + 文本简化 + 摘要）
2. 前端拍照 → 配置 → 处理 → 审阅的完整工作流
3. 统一 JSON schema（shared types 包）
4. regenerate 接口（块级或摘要级）
5. 隐私合规（无落盘、日志脱敏）

### Out of Scope（本任务不闭环）
1. 视觉生图模型接入（Task 6）— Task 5 仅在 schema 中预留 `visualHint` 文本标签字段
2. Student 端 UI 渲染适配（Task 7/8）— Task 5 仅保证数据结构可传递，StudentView 的渲染改造不在本任务
3. 教师侧导出全流程（后续集成/UAT）

---

## 5. 依赖安装计划

### 5.1 新增 workspace：`shared/`

```
shared/
  package.json       # name: "@trellis/shared"
  tsconfig.json
  src/
    types.ts         # 前后端共用类型定义（纯 interface，无运行时代码）
    index.ts         # re-export
```

根 `package.json` workspaces 增加 `"shared"`。

### 5.2 Server 端新增依赖

| 包名 | 用途 |
|---|---|
| `openai` | OpenAI GPT-4o SDK |
| `zod` | 请求体校验 |
| `dotenv` | 加载 `.env` 环境变量 |
| `@trellis/shared` | 共享类型（workspace 引用） |

### 5.3 App 端新增依赖

| 包名 | 用途 |
|---|---|
| `expo-image-picker` | 系统相机拍照 + 相册选图（替代 expo-camera，API 更简单，模拟器可用） |
| `expo-image-manipulator` | 图片压缩/缩放（控制上传大小） |
| `expo-file-system` | 将压缩后的图片 URI 读取为 base64 string |
| `@trellis/shared` | 共享类型（workspace 引用） |

> App 端使用 `fetch`（React Native 内置）调用后端 API，无需额外 HTTP 客户端。

### 5.4 为什么用 `expo-image-picker` 而非 `expo-camera`

| | expo-camera | expo-image-picker |
|---|---|---|
| 拍照方式 | 需自建相机预览 UI 组件 | 调用系统相机，零 UI 代码 |
| 相册选图 | 不支持 | 支持（`launchImageLibraryAsync`） |
| iOS 模拟器 | 相机不可用 | 可从相册选图，开发调试畅通 |
| Web 端 | 不支持 | 自动降级为文件选择器 |
| 权限处理 | 需手动管理 | 自动处理 |

---

## 6. 环境配置方案

### 6.1 Server 端 `.env`

```env
OPENAI_API_KEY=sk-...
PORT=3001
NODE_ENV=development
```

- `.env` 加入 `.gitignore`（已有）
- 提供 `server/.env.example` 模板（不含真实 key）

### 6.2 App 端环境变量

```env
EXPO_PUBLIC_API_URL=http://<局域网IP>:3001
```

- 开发时：Expo 通过 `process.env.EXPO_PUBLIC_API_URL` 读取
- 真机调试：指向开发机的局域网 IP（如 `http://192.168.1.100:3001`）
- 提供 `app/.env.example` 模板

### 6.3 Server Express body limit

当前 `express.json({ limit: '10mb' })` → 改为 `'20mb'`，防止压缩后的 base64 payload 超限。前端同时做大小校验：压缩后超过 4MB 则提示重拍。

---

## 7. 接口设计

### 7.1 POST /api/adapt/process

**Request**

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "toggles": {
    "visualSupport": true,
    "simplifyLevel": "G1",
    "summarize": true
  },
  "options": {
    "summaryMaxSentences": 5,
    "language": "en"
  }
}
```

**Response**

```json
{
  "blocks": [
    {
      "blockId": "b1",
      "label": "Title",
      "originalText": "The Grizzly Bear: A Forest Giant",
      "simplifiedText": "Big Bears in the Forest",
      "keywords": ["bear", "forest"],
      "visualHint": "grizzly bear in forest"
    },
    {
      "blockId": "b2",
      "label": "Paragraph 1",
      "originalText": "Grizzly bears are among the largest...",
      "simplifiedText": "Grizzly bears are very big...",
      "keywords": ["big", "strong"],
      "visualHint": "big grizzly bear"
    }
  ],
  "summary": {
    "sentences": ["Bears are big animals.", "They live in forests.", "..."],
    "warnings": []
  },
  "meta": {
    "simplifyLevel": "G1",
    "toggles": { "visualSupport": true, "simplifyLevel": "G1", "summarize": true },
    "latencyMs": { "total": 4200 }
  }
}
```

**字段说明：**
- `blocks`：GPT-4o 从图像中识别出的逻辑文本块，始终返回（至少包含 originalText）
- `blocks[].simplifiedText`：仅当 `simplifyLevel` 非空时返回，否则为 `null`
- `blocks[].visualHint`：仅当 `visualSupport: true` 时返回文本标签（Task 6 用此标签生成图像），否则为 `null`
- `summary`：仅当 `summarize: true` 时返回，否则为 `null`
- `meta.latencyMs`：仅记录总耗时（GPT-4o 单次调用，无需拆分子步骤）

### 7.2 Toggle 组合行为表

| visualSupport | simplifyLevel | summarize | 后端行为 | 返回内容 |
|---|---|---|---|---|
| true | G1/G2 | true | 全量处理 | blocks（含 simplifiedText + visualHint） + summary |
| false | G1/G2 | true | 简化 + 摘要 | blocks（含 simplifiedText，visualHint=null） + summary |
| false | G1/G2 | false | 仅简化 | blocks（含 simplifiedText），summary=null |
| true | null | true | 视觉提示 + 摘要 | blocks（simplifiedText=null，含 visualHint） + summary |
| false | null | true | 仅摘要 | blocks（仅 originalText） + summary |
| true | null | false | 仅视觉提示 | blocks（simplifiedText=null，含 visualHint），summary=null |
| false | null | false | **拒绝请求** | 返回 400：至少需要启用一个处理选项 |

### 7.3 POST /api/adapt/regenerate

**Request（重生单个文本块）**

```json
{
  "target": {
    "type": "block",
    "blockId": "b1"
  },
  "context": {
    "originalText": "The Grizzly Bear: A Forest Giant",
    "simplifyLevel": "G1",
    "language": "en"
  }
}
```

**Request（重生摘要）**

```json
{
  "target": {
    "type": "summary"
  },
  "context": {
    "originalText": "Full original text concatenation...",
    "summaryMaxSentences": 5,
    "language": "en"
  }
}
```

**Response**

```json
{
  "target": { "type": "block", "blockId": "b1" },
  "result": {
    "simplifiedText": "Big Bears in the Woods",
    "keywords": ["bear", "woods"],
    "visualHint": "bear in the woods"
  },
  "latencyMs": 1200
}
```

**设计要点：**
- regenerate 请求携带 `originalText` 上下文，因为后端无状态（不存储之前的处理结果）
- 仅对单个 block 或 summary 调用 GPT-4o，避免全量重跑

### 7.4 错误响应格式

所有错误统一返回格式：

```json
{
  "code": "AI_TIMEOUT",
  "message": "Processing took too long. Please try again."
}
```

| code | HTTP Status | 触发条件 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 请求体校验失败（缺字段、格式错误、toggle 全关） |
| `AI_TIMEOUT` | 504 | OpenAI API 调用超过 60s |
| `AI_RATE_LIMIT` | 429 | OpenAI API 速率限制 |
| `AI_PARSE_ERROR` | 502 | GPT-4o 返回的 JSON 结构不符合预期（自动重试一次后仍失败） |
| `INTERNAL_ERROR` | 500 | 未预期的服务端错误 |

---

## 8. Prompt 设计

### 8.1 System Prompt（`/api/adapt/process` 使用）

```
You are an educational assistant that helps adapt worksheets for students
with learning disabilities (Grades 4-7). You will receive a photo of a
worksheet and must:

1. Identify logical text sections in the image (title, paragraphs,
   questions, instructions, etc.)
2. For each section, extract the original text exactly as it appears
3. If simplification is requested, rewrite each section at the specified
   reading level
4. If summarization is requested, provide a concise summary of the entire
   worksheet content

IMPORTANT RULES:
- Preserve the meaning and key concepts of the original text
- Do not add information that is not in the original
- Do not skip any text sections visible in the image
- Each block must have a short descriptive label (e.g. "Title",
  "Paragraph 1", "Question 3")
```

### 8.2 Simplification Level 差异

| Level | Prompt 指令 | 特征 |
|---|---|---|
| G1 | "Rewrite at a Grade 1 reading level. Use only common single-syllable words where possible. Keep sentences to 5-7 words. Use simple subject-verb-object structure." | 极简词汇，最短句式 |
| G2 | "Rewrite at a Grade 2 reading level. Use common words with up to 2 syllables. Keep sentences to 8-12 words. Simple compound sentences allowed." | 稍复杂词汇，允许简单复合句 |

### 8.3 动态 Prompt 构建逻辑

根据 toggle 组合拼接 user message（全程英文，不混用中文）：

```
Analyze this worksheet photo.

[如果 simplifyLevel 非空]
→ 追加：Simplify each text block to Grade {level} reading level.

[如果 summarize 为 true]
→ 追加：Also provide a summary of the entire content in at most
  {maxSentences} sentences.

[如果 visualSupport 为 true]
→ 追加：For each text block, suggest a short visual description
  (2-5 words) that could be used to generate a supporting image.

Output as JSON matching the provided schema.
```

### 8.4 Regenerate Prompt

```
Rewrite the following text at Grade {level} reading level.
Provide a different version from the previous attempt.
Keep the same meaning but use different words and sentence structures.

Original text: "{originalText}"
```

---

## 9. 前端工作流变更（详细）

### 9.1 图片获取流程

```
HomeScreen:
  expo-image-picker (拍照或选图)
      → 得到图片 URI
      → 将 URI 作为导航参数传递给 ProcessScreen（轻量，无性能风险）

ProcessScreen (点击 Process Now 后):
  → expo-image-manipulator 压缩/缩放 (目标: ≤ 1MB, 宽度 ≤ 1024px)
  → expo-file-system readAsStringAsync (encoding: base64)
  → 校验 base64 长度 (> 4MB 则提示重拍/自动再压缩)
  → 拼接 "data:image/jpeg;base64,..." 前缀
  → 发送 API 请求
```

> **为什么不在 HomeScreen 做 base64 编码？** 压缩后的 base64 string 仍有约 1.3MB，
> 作为 React Navigation params 传递会引起序列化性能问题。传递 URI（几十字节）更轻量。

### 9.2 新工作流（替代当前 Zone 点选模式）

```
┌─────────────────────────────────────────┐
│ 1. HomeScreen                           │
│    EA 点击 "Scan Worksheet"             │
│    → expo-image-picker 弹出选择        │
│      - "Take Photo" (调用系统相机)      │
│      - "Choose from Library"            │
│    → 仅传递 imageUri 给 ProcessScreen  │
│    → 导航到 ProcessScreen              │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 2. ProcessScreen（新增）                │
│    ┌───────────────────────────┐        │
│    │ 照片缩略图预览            │        │
│    ├───────────────────────────┤        │
│    │ Toggle 1: Visual Support  │ ON/OFF │
│    │ Toggle 2: Simplify Level  │ G1/G2  │
│    │ Toggle 3: Summarize       │ ON/OFF │
│    ├───────────────────────────┤        │
│    │     [ Process Now ]       │        │
│    └───────────────────────────┘        │
│                                         │
│    点击 Process → loading 动画          │
│    → 压缩图片 + base64 编码            │
│    （模拟步骤：Reading worksheet...     │
│      → Simplifying text...              │
│      → Generating summary...）          │
│    → 调用 POST /api/adapt/process       │
│    → 成功后导航到 ReviewScreen          │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 3. ReviewScreen（新增）                 │
│    ┌───────────────────────────┐        │
│    │ 原始照片（可缩放参考）    │        │
│    ├───────────────────────────┤        │
│    │ 摘要卡片（如启用）        │        │
│    │ [Accept] [Regenerate]     │        │
│    ├───────────────────────────┤        │
│    │ 文本块卡片 1              │        │
│    │ 原文 → 简化结果           │        │
│    │ [Accept] [Regenerate]     │        │
│    ├───────────────────────────┤        │
│    │ 文本块卡片 2              │        │
│    │ ...                       │        │
│    ├───────────────────────────┤        │
│    │                           │        │
│    │ [ Accept All & Hand Off ] │        │
│    └───────────────────────────┘        │
│                                         │
│    Accept All → 导航到 StudentView      │
│    （传递 AdaptedBlock[] 数据）          │
└─────────────────────────────────────────┘
```

### 9.3 现有页面处理

| 页面 | 处理方式 |
|---|---|
| `HomeScreen` | 保留，修改"拍照"按钮接入 `expo-image-picker`，拍照后导航到 `ProcessScreen` |
| `WorksheetViewScreen` | **保留不改动**，从主导航流程中移除。保留为 demo/legacy 入口，可在项目展示中使用 |
| `StudentViewScreen` | 保留，Task 5 中传递数据验证可行性（console.log），渲染适配属于 Task 7/8 |
| `ExportScreen` | 保留，暂不修改（Task 5 Out of Scope） |

### 9.4 API 调用层

新增 `app/src/services/adaptApi.ts`：

```typescript
// 封装 POST /api/adapt/process 和 /api/adapt/regenerate
// 使用 fetch（RN 内置），读取 EXPO_PUBLIC_API_URL
// 包含超时控制（60s AbortController）和错误处理
// 统一返回 ProcessResponse / RegenerateResponse / ApiError
```

---

## 10. 实施计划（修订版）

### Phase 0. 基础设施
1. 创建 `shared/` workspace，定义共享类型（ProcessRequest, ProcessResponse, RegenerateRequest, RegenerateResponse, ApiError）
2. 根 `package.json` workspaces 增加 `"shared"`，两端引用 `@trellis/shared`
3. Server 安装 `openai`, `zod`, `dotenv`
4. App 安装 `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`
5. 创建 `server/.env.example` 和 `app/.env.example`
6. 配置 `.gitignore` 确保 `.env` 不被提交
7. Server `express.json({ limit: '20mb' })`

### Phase A. Backend Pipeline（核心）
1. 新增 `server/src/routes/adapt.ts` 路由模块
2. 实现 `POST /api/adapt/process`：
   - zod 校验请求体（imageBase64 格式、toggles 字段、options 范围、toggle 全关拒绝）
   - 根据 toggles 动态构建 prompt（参见第 8 节 Prompt 设计）
   - 调用 OpenAI API（Structured Outputs + 60s 超时）
   - 二次校验（摘要句数上限、字段完整性）
   - 返回标准化 ProcessResponse
3. 实现 `POST /api/adapt/regenerate`：
   - zod 校验请求体
   - 根据 target.type（block / summary）构造针对性 prompt
   - 调用 OpenAI API + 解析 + 返回
4. 隐私守卫：
   - 不落盘任何请求 payload
   - 日志仅记录 latencyMs、错误类型（不记录原文或图像）
   - 错误响应不回传原文片段
5. 错误处理：按第 7.4 节错误码表返回对应 HTTP status

### Phase B. Frontend Integration
1. 新增 `app/src/services/adaptApi.ts`（API 调用封装）
2. 新增 `ProcessScreen`：图片选取 + 3 Toggles + Process 按钮 + loading 动画
3. 新增 `ReviewScreen`：结果卡片列表 + Accept/Regenerate 按钮 + Accept All
4. 更新 `RootNavigator.tsx`：注册新页面，更新导航类型
5. 更新 `HomeScreen`：拍照按钮接入 `expo-image-picker`
6. 更新 `types.ts`（从 `@trellis/shared` 引入共享类型）

### Phase C. Hardening
1. 异常分类与用户提示：
   - Toggle 全关 → 前端禁用 Process 按钮（不发请求）
   - 图像过大 → "Image too large, please retake"
   - API 超时 → "Processing took too long, please try again"
   - AI 解析失败 → 自动重试一次，仍失败则提示手动重试
2. 性能验证：真机调试端到端流程，验证 < 60s
3. 边界测试：空白图像、非 worksheet 图像、超大图像

---

## 11. 共享类型定义预览（`shared/src/types.ts`）

```typescript
// ===== Request Types =====
export interface ProcessRequest {
  imageBase64: string;
  toggles: {
    visualSupport: boolean;
    simplifyLevel: 'G1' | 'G2' | null;  // null = 不简化
    summarize: boolean;
  };
  options?: {
    summaryMaxSentences?: number; // 默认 5
    language?: string;            // 默认 "en"
  };
}

export interface RegenerateRequest {
  target:
    | { type: 'block'; blockId: string }
    | { type: 'summary' };
  context: {
    originalText: string;
    simplifyLevel?: 'G1' | 'G2';
    summaryMaxSentences?: number;
    language?: string;
  };
}

// ===== Response Types =====
export interface AdaptedBlock {
  blockId: string;
  label: string;
  originalText: string;
  simplifiedText: string | null;
  keywords: string[];
  visualHint: string | null;
}

export interface SummaryResult {
  sentences: string[];
  warnings: string[];
}

export interface ProcessResponse {
  blocks: AdaptedBlock[];
  summary: SummaryResult | null;
  meta: {
    simplifyLevel: 'G1' | 'G2' | null;
    toggles: ProcessRequest['toggles'];
    latencyMs: { total: number };
  };
}

export interface RegenerateResponse {
  target: RegenerateRequest['target'];
  result: {
    simplifiedText?: string;
    keywords?: string[];
    visualHint?: string;
    sentences?: string[];
  };
  latencyMs: number;
}

// ===== Error Response =====
export interface ApiError {
  code: 'VALIDATION_ERROR' | 'AI_TIMEOUT' | 'AI_PARSE_ERROR' | 'AI_RATE_LIMIT' | 'INTERNAL_ERROR';
  message: string;
}
```

---

## 12. 验收标准（Week 10）

1. EA 拍一张 worksheet 照片（或从相册选取），设置 3 Toggles，点击 Process，60 秒内看到结果卡片
2. 摘要始终不超过 5 句
3. 简化等级至少支持 G1/G2 且风格差异可见
4. 可对单个文本块点击 Regenerate，仅重新处理该块
5. 可对摘要点击 Regenerate，仅重新生成摘要
6. 服务端不保存图像和原文，日志无敏感信息
7. Accept All 后数据结构可正确传递到 StudentView（console.log 验证），StudentView 的渲染适配属于 Task 7/8
8. 非 worksheet 图像或空白图像不会导致崩溃，显示合理错误提示
9. 三个 Toggle 全部关闭时，Process 按钮禁用，不允许发送空请求
10. 在 iOS 模拟器上可通过相册选图完成完整流程（用于开发调试）

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 拍照质量差（角度/光照） | 文本识别不准 | 前端拍照引导提示；GPT-4o 对低质量图像鲁棒性较好 |
| GPT-4o 响应超时 | 超过 60s 体验目标 | 单次调用策略（非多次串行）；60s 超时后提示重试 |
| GPT-4o 输出格式不符合预期 | 处理失败 | 使用 Structured Outputs (`json_schema`) 强制 schema 匹配；zod 二次校验；自动重试一次 |
| 网络不稳定（课堂环境） | 请求失败 | 前端显示明确错误提示 + 重试按钮；后端无状态所以重试安全 |
| 真机调试访问本地服务失败 | 无法联调 | `EXPO_PUBLIC_API_URL` 指向局域网 IP；文档说明配置步骤 |
| OpenAI API key 泄露 | 安全风险 | `.env` + `.gitignore`；提供 `.env.example` 模板；server 端使用 key，永不暴露给前端 |
| 图像 base64 过大 | 请求超时或被拒 | `expo-image-manipulator` 压缩到 ≤1MB；前端校验 base64 ≤4MB；server limit 20MB |
| shared workspace Metro 解析失败 | App 端编译报错 | shared 包仅含纯 TS interface（无运行时代码）；现有 metro.config.js 已配置 watchFolders 和 nodeModulesPaths |
| Prompt 输出质量不稳定 | 简化结果不理想 | 明确的 grade-level prompt 差异（8.2 节）；regenerate 允许 EA 重试；迭代优化 prompt |
