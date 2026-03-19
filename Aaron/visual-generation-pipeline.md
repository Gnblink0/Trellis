# Visual Generation Pipeline — 实现报告

## 任务完成情况

**本次任务已完整实现 Visual Generation Pipeline（Task 6）的所有要求。**

Task 5 已在整个数据管道中预留了 `visualHint` 字段（GPT-4o 返回 2-5 词视觉描述），Task 6 将这些 `visualHint` 发送给 DALL-E 3 生成真实图片，让 EA 在 ReviewScreen 预览、学生在 StudentView 中看到。

| # | 验收标准 | 状态 | 说明 |
|---|---|---|---|
| 1 | `visualSupport` 开启时，每个文字块自动生成配套图片 | ✅ | server 端并行调用 DALL-E 3，`Promise.all` 容错 |
| 2 | 生成的图片在 ReviewScreen 中可预览 | ✅ | 每个 block card 内嵌图片展示区 |
| 3 | 图片生成失败不阻塞其他文字块 | ✅ | 每个 `generateImage()` 独立 catch，失败返回 null |
| 4 | ReviewScreen 对失败图片显示合理 fallback | ✅ | 显示图标 + "Image unavailable: {hint}" 文字 |
| 5 | Regenerate 单个块时图片同步刷新 | ✅ | `/regenerate` 端点同时重新生成图片 |
| 6 | Accept All 后图片 URL 传递到 StudentView | ✅ | handoff 映射中包含 `visualUrl` |
| 7 | StudentView FloatingMarker 弹窗中显示图片 | ✅ | `MarkerData.content.visualUrl` → `<Image>` |
| 8 | `visualSupport` 关闭时不生成图片，`visualUrl` 全部为 null | ✅ | 条件判断 `toggles.visualSupport` |
| 9 | 服务端不保存图片，保持无状态 | ✅ | 返回 DALL-E 3 临时 URL（约 1 小时有效），无持久化 |

---

## 实现了什么

用一句话描述：当 EA 开启 Visual Support 开关后，服务端在完成文字简化的同时，用 DALL-E 3 为每段文字自动生成教育风格的配图，EA 在 ReviewScreen 逐条预览图片，确认后学生可以在 StudentView 中看到。

### 数据流

```
ProcessScreen（Visual Support = ON）
       ↓  POST /api/adapt/process
Server：GPT-4o 返回 blocks（含 visualHint）
       ↓  Promise.all 并行生成图片
Server：为每个 block 调 DALL-E 3（visualHint → 图片 URL）
       ↓  返回 ProcessResponse（blocks 含 visualUrl）
ReviewScreen
  ├── 文字块卡片内显示生成图片
  ├── visualHint 有值但 URL 为 null → 显示 fallback
  ├── Regenerate → 重新生成文字 + 图片
  └── Accept All → 携带 visualUrl 跳转 StudentView
         ↓
StudentView → FloatingMarker → 弹窗中显示图片
```

---

## 更改了什么

### 无新建文件

本次全部修改在已有文件上进行，无新建文件。

### 修改文件

| 文件 | 改动内容 |
|---|---|
| `shared/src/types.ts` | `AdaptedBlock` 新增 `visualUrl: string \| null`；`RegenerateResult` 新增 `visualUrl?: string` |
| `server/src/routes/adapt.ts` | 新增 `generateImage()` helper（DALL-E 3 调用）；`/process` 端点增加并行图片生成；`/regenerate` block 端点增加图片重新生成 |
| `app/src/navigation/types.ts` | `AdaptedZone` 新增 `visualUrl?: string` |
| `app/src/screens/ReviewScreen.tsx` | block card 中新增图片展示区 / fallback；`handleRegenerateBlock` 同步 `visualUrl`；`handleAcceptAll` handoff 传递 `visualUrl` |
| `app/src/components/FloatingMarker.tsx` | 新增 `Image` 导入；`MarkerData.content` 新增 `visualUrl`；bubble 弹窗中渲染图片，无图片时降级到文字列表 |
| `app/src/screens/StudentViewScreen.tsx` | marker 映射中传递 `a.visualUrl` → `content.visualUrl` |
| `app/src/services/adaptApi.ts` | `TIMEOUT_MS` 从 60s 增加到 120s（图片生成增加耗时） |
| `app/src/screens/ProcessScreen.tsx` | `LOADING_STEPS` 新增 "Creating visual images..." 步骤提示 |

### 代码统计

```
8 files changed, 123 insertions(+), 5 deletions(-)
```

---

## 关键技术决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 图片生成 API | OpenAI DALL-E 3 | 复用已有 OpenAI API Key，无需额外配置；一张图 ~$0.04 |
| 生成位置 | Server 端 | 保持 BFF 架构一致性，不暴露 API Key 到前端 |
| 并行策略 | `Promise.all` | 5 张图 ~15s（并行）vs ~60s（串行），性能提升 4 倍 |
| 容错策略 | 每个 `generateImage()` 独立 try/catch | 一张图失败不影响其他 block，返回 null 由前端显示 fallback |
| 图片尺寸 | 1024×1024, standard quality | 教育场景足够清晰，成本最低（$0.04/张） |
| Prompt 工程 | 前缀 "Simple, friendly, educational illustration..." + "no text or words" | 确保风格适合小学生，避免 DALL-E 3 生成难以辨认的文字 |
| 图片存储 | 不存储，使用 DALL-E 3 返回的临时 URL（~1 小时有效） | 无状态设计，会话时间短，无需持久化 |
| 客户端超时 | 60s → 120s | DALL-E 3 约增加 10-20s 延迟，避免前端超时 |

---

## 架构说明

```
前端（React Native）                    后端（Express BFF）                    外部 API
─────────────────────                  ─────────────────────────              ──────────
ProcessScreen（Visual Support ON）
       ↓ base64
adaptApi.ts ──── POST /process ───→ Zod 校验
                                       ↓
                                    GPT-4o 调用 ────────────────→ OpenAI GPT-4o
                                       ↓ blocks（含 visualHint）
                                    Promise.all 并行图片生成 ──→ OpenAI DALL-E 3
                                       ↓ blocks（含 visualUrl）      × N blocks
adaptApi.ts ←── ProcessResponse ──── 返回含图片 URL 的完整响应
       ↓
ReviewScreen（图片 + 文字审阅）
       ↓ Regenerate 一个块
adaptApi.ts ──── POST /regenerate ──→ GPT-4o（新文字）+ DALL-E 3（新图片）
       ↓
       ↓ Accept All
StudentView → FloatingMarker 弹窗显示图片
```

关键特性：
- **并行生成**：所有 block 的 DALL-E 3 调用同时发出，wall time = 最慢的一张
- **优雅降级**：任何一张图失败，其余照常返回，前端显示 fallback UI
- **零存储**：图片 URL 直接透传，server 不做缓存或持久化

---

## 成本估算

| 场景 | GPT-4o | DALL-E 3 | 总计 |
|---|---|---|---|
| 1 张 worksheet，5 个文字块 | ~$0.03 | 5 × $0.04 = $0.20 | ~$0.23 |
| 1 次单块 Regenerate | ~$0.01 | 1 × $0.04 | ~$0.05 |
| Visual Support 关闭 | ~$0.03 | $0 | ~$0.03 |

> 注：DALL-E 3 是主要成本来源。如需节省，可将 `visualSupport` 默认设为 OFF，或限制最大图片数。

---

## 怎么测试

### 第一步：确认环境

```bash
# 确保 server/.env 中已配置 OpenAI API Key
# OPENAI_API_KEY=sk-...
# 该 Key 需要有 DALL-E 3 的访问权限

# 从项目根目录安装依赖（无新增依赖包）
npm install
```

### 第二步：启动服务端

```bash
npm run server
# 或：cd server && npx tsx watch src/index.ts
```

### 第三步：启动 App

```bash
npm run app
# 或：cd app && npx expo start
# 按 i 启动 iOS 模拟器
```

### 第四步：端到端测试步骤

#### 测试 1：Visual Support 开启（核心流程）

1. **Home Screen** → 选择一张 worksheet 照片
2. **Process Screen** → 打开 Visual Support 开关 + 选择 G1 或 G2 + 开启 Summarize → 点击 "Process Now"
3. **等待** → 观察 loading 步骤应出现 "Creating visual images..."
4. **Review Screen** → 验证：
   - 每个文字块卡片下方显示 **Visual Support** 标题 + 生成的图片
   - 图片风格为卡通教育风（无乱码文字）
   - 如某张图片生成失败，显示灰色占位 + "Image unavailable: {hint}" 文字
5. **Regenerate** → 点击某个 block 的 Regenerate → 验证图片同步刷新为新图片
6. **Accept All & Hand Off** → 跳转到 StudentView
7. **StudentView** → 点击绿色 badge → 弹出 popup → 验证弹窗内显示图片

#### 测试 2：Visual Support 关闭

1. **Process Screen** → 关闭 Visual Support 开关 → 只打开 Simplify / Summarize
2. **Review Screen** → 验证文字块卡片中 **没有** Visual Support 图片区域
3. 确认无 DALL-E 3 调用（server 日志中无 `[adapt] DALL-E 3` 相关输出）

#### 测试 3：图片生成失败降级

1. （可选）临时将 `OPENAI_API_KEY` 设为无效值或限制 DALL-E 3 权限
2. 打开 Visual Support → Process
3. **Review Screen** → 验证所有块显示 fallback（图标 + 文字），不崩溃
4. 文字简化和摘要功能不受影响

#### 测试 4：服务端验证（curl）

```bash
# 健康检查
curl http://localhost:3001/health

# 完整请求（需要真实 base64 图片数据）
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,...","toggles":{"visualSupport":true,"simplifyLevel":"G1","summarize":true}}'

# 检查返回的 blocks 中每个元素是否包含 visualUrl 字段
```

### Server 日志预期输出

```
[adapt/process] Completed in 25000ms — 5 blocks
```

如有图片生成失败：
```
[adapt] DALL-E 3 failed for hint "grizzly bear in forest": Rate limit exceeded
[adapt/process] Completed in 20000ms — 5 blocks
```

---

## 已知限制

- **DALL-E 3 URL 有效期约 1 小时**：对于当前无状态短会话场景足够，但如果后续需要离线查看或导出，需增加图片下载/缓存逻辑
- **DALL-E 3 速率限制**：OpenAI 免费/低级 tier 可能限制为 5 images/min，大量 block 时可能部分失败（已通过容错处理）
- **JSX 类型警告**：App 中 `'View' cannot be used as a JSX component` 的 TypeScript 警告是项目中预已存在的 React 19 类型兼容性问题，与本次改动无关
- **图片内容安全**：依赖 DALL-E 3 内置的内容审核策略；prompt 中已限定 "educational, elementary school, cartoon-like" 风格
- **成本**：每次完整处理（5 个块）约 $0.20 图片生成费用，后续可考虑按需生成或缓存策略优化
