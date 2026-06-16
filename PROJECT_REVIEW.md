# StockVault 待办清单

> 最后更新：2026-06-16  
> 本文档记录**尚未实现**或**部分完成**的改进项；已修复内容不再保留。

---

## 数据同步方式说明

**可以不使用 Gist 同步。** 项目已内置 JSON 全量导出/导入，Gist 仅为可选的跨设备云同步方案。

| 方式 | 入口 | 覆盖范围 | 说明 |
|------|------|----------|------|
| **全量备份** | 同步面板 →「📦 全量备份」 | localStorage + IndexedDB | 下载 `stockvault_full_backup_YYYY-MM-DD.json`，含多账户与历史数据 |
| **全量恢复** | 同步面板 →「📥 全量恢复」 | localStorage + IndexedDB | 选择 JSON 文件导入，恢复后需刷新页面 |
| **自动备份** | 同步面板内开关（默认开启） | 仅 localStorage | 每 12 小时自动下载 JSON，**不含 IndexedDB**（见待办 #2） |
| **Gist 云同步** | 同步面板 → 配置 Token + Gist ID | 仅 localStorage | 可选；点击「断开」即可停用，不影响本地 JSON 备份 |

**推荐用法（不用 Gist）：** 定期手动「全量备份」，换设备时「全量恢复」；或配合网盘 / U 盘 / 邮件自行保管 JSON 文件。

**与 Gist 的差异：** Gist 适合多设备自动推/拉；JSON 文件适合完全离线、无 GitHub 依赖、数据完全自控。两者可并存，也可只用 JSON。

---

## 中优先级

### 1. 无自动化测试

- 项目内 0 个测试文件，回归全靠手动
- 优先为纯函数补 Vitest 单测：`calcStock` / `calcFund` / `calcAvgDownside`（`api.ts`）、`dca.ts`、`positionSignal.ts`、`benchmark.ts`、`mergeNavData` / `parseFundNavList` / `parseRedemptionFeeHtml`
- 建议引入 Vitest（与 Vite 集成成本低），PR 前跑 `tsc` + `eslint` + `vitest`

### 2. 自动备份未覆盖 IndexedDB

- `handleFullBackup`（`SyncPanel.tsx`）已同时导出 localStorage + IndexedDB
- `useAutoBackup`（`autoBackup.ts`）仅扫描 localStorage，价值历史、盈亏日历等 IndexedDB 数据不会进入自动备份
- 建议：复用 `handleFullBackup` 的收集逻辑，或抽成共享 `collectAllData()` 供手动/自动备份共用

### 3. Gist 同步为覆盖式，多设备可能丢数据

- `pullFromGist` 中 `mergeData` 实为 `localStorage.setItem` 整体覆盖（`gistSync.ts`）
- `GistData.updatedAt` 已存在但未用于冲突判断
- 建议：基于时间戳提示冲突，或字段级 last-write-wins；拉取前可选「先全量备份」

### 4. GitHub Token 明文存 localStorage

- `gistSync.ts` 将 PAT 写入 `stockvault_sync_config`
- XSS 或共享设备存在泄露风险
- 建议：UI 提示使用最小权限 `gist` token；可选「仅本次会话保存」；长期可考虑 Web Crypto 加密存储

### 5. 无 CI 流水线

- 无 `.github/workflows`
- 建议：PR / push 时自动 `npm run build`、`npm run lint`、（接入测试后）`vitest run`

---

## 低优先级

### 6. 收益率曲线 / XIRR

- 现有市值趋势图，缺考虑分批买入时间的资金加权年化收益
- 对长期持有评估更有参考价值

### 7. 月报图片 / PDF 导出

- 已有 `ReportGenerator`，可扩展为可分享的图片卡片或 PDF

### 8. 价格提醒增强

- 当前仅浏览器桌面通知，页面关闭后无效
- 可接入 Server酱、Bark 等推送（需用户自行配置 webhook）

### 9. A 股交易日历

- 收盘快照在 `App.tsx` 用 `setInterval` 每分钟检测 15:00–15:10（北京时间）
- 周末、节假日仍空跑；非交易日可能产生无效快照
- 建议：引入交易日历，非交易日跳过；或改为 `setTimeout` 精确调度下一收盘点

### 10. App.tsx 职责过重

- 主题、快捷键、IndexedDB 迁移、收盘快照、更多菜单集中在一处
- 建议：将收盘快照抽为 `useMarketCloseSnapshot`，与 `useAutoRefresh` 风格统一

### 11. 错误可观测性不足

- 有 `logger.ts`，但 API / storage 大量 `catch {}` 静默吞错
- 建议：关键路径记录到 logger；可选本地「诊断面板」汇总最近错误

### 12. HTML 解析脆弱

- `parseRedemptionFeeHtml`（`api.ts`）依赖天天基金页面 DOM 结构
- 上游改版会静默失败；可考虑 `DOMParser` 替代纯正则，并加强失败日志

### 13. 存储用量监控

- 双写策略下 localStorage 仍可能 `QuotaExceeded`
- 建议：`navigator.storage.estimate()` 展示用量，接近上限时提示清理缓存

### 14. 弱化 Gist 入口（产品向）

- 若用户普遍只用 JSON 备份，可将同步面板默认展示「本地备份」区块，Gist 折叠为「高级 / 云同步（可选）」
- 降低「必须配 GitHub」的误解

---

## 架构 / 设计限制（暂无实现计划）

| 项 | 说明 |
|----|------|
| 多账户「总计」重复计算 | `accountId === 'default'` 时汇总全部子账户持仓，同一标的分属多账户可能重复计入 |
| 第三方 API 无 SLA | 新浪 / 东方财富为非官方接口，需依赖现有 cache fallback |
| `npm run preview` 无 API 代理 | Vite 代理仅 dev 生效，属预期行为；生产须配 Nginx（见 `deploy/`） |
| 生产部署需手动配置 | 代码侧已提供 `deploy/stockvault.nginx.conf`，部署本身不在应用代码范围内 |
