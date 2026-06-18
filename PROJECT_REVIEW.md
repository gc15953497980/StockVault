# StockVault 项目审查

> 最后更新：2026-06-17
> 本文档记录代码审查中发现的问题与优化建议；已修复内容不再保留。

---

## 数据同步方式说明

**可以不使用 Gist 同步。** 项目已内置 JSON 全量导出/导入，Gist 仅为可选的跨设备云同步方案。

| 方式 | 入口 | 覆盖范围 | 说明 |
|------|------|----------|------|
| **全量备份** | 同步面板 →「📦 全量备份」 | localStorage + IndexedDB | 下载 `stockvault_full_backup_YYYY-MM-DD.json`，含多账户与历史数据 |
| **全量恢复** | 同步面板 →「📥 全量恢复」 | localStorage + IndexedDB | 选择 JSON 文件导入，恢复后需刷新页面 |
| **自动备份** | 同步面板内开关（默认开启） | localStorage + IndexedDB | 每 12 小时自动下载 JSON（已复用 `collectAllData()`） |
| **Gist 云同步** | 同步面板 → 配置 Token + Gist ID | 仅 localStorage | 可选；点击「断开」即可停用，不影响本地 JSON 备份 |

**推荐用法（不用 Gist）：** 定期手动「全量备份」，换设备时「全量恢复」；或配合网盘 / U 盘 / 邮件自行保管 JSON 文件。

---

## 🔴 严重问题（Bug / 安全）

### S1. Gemini API 密钥硬编码在源码中

- `src/utils/gemini.ts:1` 将一个可用的 Gemini API Key 明文写死为 `DEFAULT_KEY`
- 该密钥会随构建产物（`dist/`）公开，任何人都能从浏览器 devtools 或打包文件中提取并盗用你的配额
- **建议**：
  1. 立即吊销该密钥（Google AI Studio → 撤销该 key）
  2. `DEFAULT_KEY` 改为空字符串，强制用户在 UI 自行配置
  3. 生产环境应通过后端代理调用 Gemini，前端不直接持有 key

### S2. PositionSignal 市场判断逻辑错误（功能 Bug）

- `src/components/PositionSignal.tsx:32`：
  ```ts
  const aStocks = stocks.filter(s => !s.market || s.market === 'sh' || s.market === 'sz' || s.market === 'bj');
  ```
- 但 `Market` 类型定义为 `'a' | 'hk' | 'us'`，永远不会出现 `'sh'/'sz'/'bj'`
- 结果：**所有 A 股都会被过滤掉**，仓位信号页只能分析基金，ETF/个股分析完全失效
- **修复**：改为 `s.market === 'a'`（或 `!s.market || s.market === 'a'`）

### S3. GitHub Token 明文存 localStorage

- `gistSync.ts` 将 PAT 写入 `stockvault_sync_config`，XSS 或共享设备存在泄露风险
- 建议：UI 提示使用最小权限 `gist` token；可选「仅本次会话保存」；长期可考虑 Web Crypto 加密存储

### S4. ErrorBoundary「清除缓存」按钮会清空所有 localStorage

- `src/components/ErrorBoundary.tsx:73` 调用 `localStorage.clear()`
- 这会清掉浏览器中**其他网站**存在同源下的数据（虽然通常同源隔离，但若部署在共享域则会误伤）
- 同时也会清掉非 `stockvault_` 前缀的配置
- **建议**：改为只清 `stockvault_` 前缀的 key，与 `storage.clearAll()` 行为一致

---

## 🟠 ESLint 错误（`npm run lint` 当前 7 个 error，CI 会失败）

### L1. `KlineChartModal.tsx:67` — setState in effect
```
react-hooks/set-state-in-effect
```
- `useEffect` 内同步调用 `setLoading(true)` / `setError(null)` 触发级联渲染
- **修复**：将初始 loading 状态用 `useState` 初始化为 `true`，或在 effect 内用 `Promise.resolve().then(() => { setLoading(true) ... })` 推迟到微任务；更推荐用 `useTransition` 或直接在异步函数内 `setLoading`

### L2. `PositionSignal.tsx:109` — setState in effect
- mount 时 `runAnalysis()` 内部同步 `setLoading/setItems/setBacktests` 触发级联渲染
- **修复**：在 `runAnalysis` 开头用 `queueMicrotask` 包裹，或拆分为「初始化标记 + 异步执行」

### L3. `FundForm.tsx:122` — `catch (err: any)`
- **修复**：改为 `catch (err)` 并用 `err instanceof Error ? err.message : String(err)`

### L4. `gemini.ts:115,121` — `any` 类型 + 缺失 `cause`
- 两处 `catch (e: any)` + `throw new Error(...)` 未保留原始错误
- **修复**：`catch (e)` + `throw new Error(msg, { cause: e })`

> 注：CI 流水线 (`.github/workflows/ci.yml`) 会跑 `npm run lint`，**当前 main 分支的 CI 是红的**。

---

## 🟡 功能 / 逻辑问题

### F1. Gist 同步为覆盖式，多设备可能丢数据

- `pullFromGist` 中 `mergeData` 实为 `localStorage.setItem` 整体覆盖
- `GistData.updatedAt` 已存在但未用于冲突判断
- 建议：基于时间戳提示冲突，或字段级 last-write-wins；拉取前可选「先全量备份」

### F2. 自动同步 push 缺少防抖

- 每个 store 的 `addStock/updateStock/deleteStock/addFund/...` 都会调用 `autoSyncPush()`
- 批量导入、账户切换等场景会**连续触发多次 Gist 上传**，浪费 API 配额
- 建议：加 30-60s 防抖，或用「dirty 标记 + 定时 push」

### F3. 账户切换会触发不必要的行情刷新

- `useStockStore` / `useFundStore` 订阅了 `useAccountStore`，账户切换时调用 `refreshPrices()`
- 切到空账户再切回来会重复请求 API
- 建议：加时间戳节流（如 10s 内已刷新则跳过）

### F4. 多账户「总计」重复计算

- `accountId === 'default'` 时汇总全部子账户持仓，同一标的分属多账户可能重复计入
- `filterByAccount` 对 `default` 返回全部，未做去重

### F5. PnL 日历 `recordToday` 逻辑复杂且有边界问题

- `usePnlCalendarStore.ts:82-92`：先按 `date < today` 过滤再排序，又重新累积 `prevCumulative`
- 每次调用都会重新遍历全部历史记录，O(n) 复杂度
- 当用户在收盘后多次刷新，`prevCumulative` 可能被重复计算
- 建议：缓存上一次的 `totalValue`，用差值计算 `dailyPnl`；或只保留每日最终值

### F6. `fetchFundHistoryNAV` 缓存判断可能误判

- `api.ts:444-448`：当 `cached.startDate <= reqStartDate && cached.endDate >= reqEndDate` 且 `filtered.length >= minExpected` 时才用缓存
- 但周末/节假日 `filtered.length` 可能 < `minExpected`，导致缓存命中率下降、重复请求
- 建议：周末/节假日跳过 fresh fetch

### F7. A 股收盘快照在非交易日空跑

- `useMarketCloseSnapshot.ts` 每分钟检测 15:00-15:10，周末/节假日仍会触发
- 建议：引入交易日历或检测「最近一个交易日」

### F8. WatchlistView 刷新逻辑重复

- `handleRefreshWatch` 与 `useEffect` 中的 `refresh` 函数代码几乎完全相同（约 40 行重复）
- 建议：抽成单一 `refreshWatchlist()` 函数

### F9. 通知去重上限 200 条可能丢失

- `notifications.ts:18`：`maxSize = 200`，超出后 `slice(-200)` 保留最新的
- 但 `shouldNotify` 用 Set 判断，旧记录被裁剪后**次日同一条提醒会重复触发**
- 建议：按日期清理（保留最近 7 天），而非固定数量

### F10. CSV 导出文件名缺少 BOM 之外的编码处理

- `csv.ts:66`：`BOM = '﻿'` 已加 UTF-8 BOM，Excel 可正确打开
- 但 `downloadCSV` 未 `document.body.appendChild(a)`，某些浏览器（Safari）可能不触发下载
- 建议：与 `handleFullBackup` 一致，`appendChild` 后再 `removeChild`

---

## 🟢 优化建议

### O1. 无自动化测试

- 项目内 0 个测试文件，回归全靠手动
- 优先为纯函数补 Vitest 单测：`calcStock` / `calcFund` / `calcAvgDownside`（`api.ts`）、`dca.ts`、`positionSignal.ts`、`benchmark.ts`、`mergeNavData` / `parseFundNavList` / `parseRedemptionFeeHtml`
- 建议引入 Vitest（与 Vite 集成成本低），PR 前跑 `tsc` + `eslint` + `vitest`

### O2. `localStorage` 直读遍布各 store，未统一走 `storage` 抽象

- `useStockStore`、`useFundStore`、`useTxStore`、`useNotesStore`、`useWatchlistStore`、`useValueHistoryStore`、`usePnlCalendarStore`、`useAccountStore` 都直接 `localStorage.getItem/setItem`
- `storage.ts` 提供了 IndexedDB + localStorage 双写抽象，但 store 层未使用
- 结果：**Gist 同步和全量备份只能拿到 localStorage 数据，IndexedDB 中的大数据（价值历史等）不会被 Gist 同步**
- 建议：store 的 `save` 函数改用 `storage.set`，`load` 改用 `storage.get`（注意 async 初始化）

### O3. `storage.migrateFromLS` 不会删除 localStorage 旧数据

- `storage.ts:137-151` 只把 localStorage 数据复制到 IndexedDB，不删除原 key
- 导致同一份数据在两处都存在，Gist 同步时还会读到 localStorage 旧值
- 建议：迁移成功后删除 localStorage 中对应 key（或标记已迁移）

### O4. 错误可观测性不足

- 有 `logger.ts`，但 API / storage 大量 `catch {}` 静默吞错
- `fetchForeignPrices`、`fetchBenchmarkData`、`fetchETFNavHistory`、`fetchStockKline` 失败时都返回空数组，用户无感知
- 建议：关键路径记录到 logger；可选本地「诊断面板」汇总最近错误

### O5. HTML 解析脆弱

- `parseRedemptionFeeHtml`（`api.ts`）依赖天天基金页面 DOM 结构
- 上游改版会静默失败；可考虑 `DOMParser` 替代纯正则，并加强失败日志

### O6. 存储用量监控已实现，但未在接近上限时主动提示

- `SyncPanel.tsx` 已展示 localStorage / IndexedDB / 配额
- 但未在接近上限（如 >90%）时主动告警
- 建议：`navigator.storage.estimate()` 接近上限时 UI 高亮提示清理缓存

### O7. App.tsx 职责已拆分，但仍有改进空间

- 主题、快捷键、IndexedDB 迁移、收盘快照、更多菜单集中在一处
- `useMarketCloseSnapshot` 已抽离（✅）
- 建议：主题逻辑抽为 `useTheme`，更多菜单抽为 `MoreMenu` 组件

### O8. 收益率曲线 / XIRR

- 现有市值趋势图，缺考虑分批买入时间的资金加权年化收益
- `dca.ts` 中的 IRR 是简单几何平均，未考虑现金流时点
- 对长期持有评估更有参考价值

### O9. 月报图片 / PDF 导出

- 已有 `ReportGenerator`，可扩展为可分享的图片卡片或 PDF

### O10. 价格提醒增强

- 当前仅浏览器桌面通知，页面关闭后无效
- 可接入 Server酱、Bark 等推送（需用户自行配置 webhook）

### O11. 弱化 Gist 入口（产品向）

- 若用户普遍只用 JSON 备份，可将同步面板默认展示「本地备份」区块，Gist 折叠为「高级 / 云同步（可选）」
- 降低「必须配 GitHub」的误解

### O12. `fetchETFNavHistory` 与 `fetchStockKline` 代码重复

- 两者都请求 `/api/benchmark/kline`，解析逻辑相似
- 建议：抽成共享 `fetchEastmoneyKline(secid, params)` 工具函数

### O13. Service Worker 缓存策略过于激进

- `public/sw.js` 对所有同源 GET 请求做 cache-first 之外的「网络优先 + 失败回退缓存」
- 但 API 请求（`/api/sina` 等）也被缓存，可能导致行情数据过期
- 建议：SW 中排除 `/api/` 路径的缓存

### O14. `formatMoney` 单位处理在负数边界有歧义

- `api.ts:197`：`Math.abs(v) >= 1e8` 判断亿/万，但 `-99999999` 会显示为 `-99999999.00` 而非 `-1.00亿`
- 建议：先取绝对值判断单位，再带符号

---

## 架构 / 设计限制（暂无实现计划）

| 项 | 说明 |
|----|------|
| 多账户「总计」重复计算 | `accountId === 'default'` 时汇总全部子账户持仓，同一标的分属多账户可能重复计入 |
| 第三方 API 无 SLA | 新浪 / 东方财富为非官方接口，需依赖现有 cache fallback |
| `npm run preview` 无 API 代理 | Vite 代理仅 dev 生效，属预期行为；生产须配 Nginx（见 `deploy/`） |
| 生产部署需手动配置 | 代码侧已提供 `deploy/stockvault.nginx.conf`，部署本身不在应用代码范围内 |

---

## 已完成项（对比上一版审查）

- ✅ CI 流水线（`.github/workflows/ci.yml`）已建立
- ✅ `useMarketCloseSnapshot` 已从 App.tsx 抽离
- ✅ 自动备份已复用 `collectAllData()`，覆盖 IndexedDB
- ✅ 存储用量监控已在 SyncPanel 展示
