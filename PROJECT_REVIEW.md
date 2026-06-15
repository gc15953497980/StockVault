# StockVault 待办清单

> 最后更新：2026-06-15  
> 本文档仅记录**尚未实现**或**部分完成**的项；已修复内容不再保留。

---

## 中优先级

### 1. 全量备份 / 清除缓存未覆盖 IndexedDB ✅ 已完成

- `handleFullBackup` 现在同时收集 localStorage + IndexedDB（`idb.keys()`）
- IndexedDB 键以 `__idb__` 前缀存入备份 JSON
- `handleFullRestore` 同时恢复至 localStorage 和 IndexedDB
- `handleClearCache` 改为调用 `storage.clearAll()`，清除两层存储

### 2. README 部署文档与 Nginx 配置不一致 ✅ 已完成

- README Nginx 示例和代理表已补充 `/api/gold/` → `push2his.eastmoney.com`

---

## 低优先级

### 3. Tab 文案不统一 ✅ 已完成

- 统一为「金矿成本」：App.tsx Tab 标签和 ShortcutHelp 描述一致

### 4. 主包体积偏大 ✅ 已完成

- `GoldCostView`、`DcaCalculator`、`StrategySimulator` 改为 `React.lazy` + `Suspense`
- 主包从 748 kB → 358 kB（gzip 215 kB → 104 kB，↓52%）

### 5. 云同步拉取逻辑冗余 ✅ 已完成

- `SyncPanel.handlePull` 移除 `valueHistory` / `pnlCalendar` 冗余重读
- `gistSync.pullFromGist` 已通过 `mergeNamespacedData` 写入 localStorage，store subscription 自动感知变化
- 移除不再需要的 `useValueHistoryStore` / `usePnlCalendarStore` 导入

---

## 架构 / 设计限制（暂无实现计划）

| 项 | 说明 |
|----|------|
| 多账户「总计」重复计算 | `accountId === 'default'` 时汇总全部子账户持仓，同一标的分属多账户可能重复计入 |
| localStorage 容量上限 | 大数据已迁 IndexedDB，但双写策略下 localStorage 仍可能 `QuotaExceeded`；无用量监控与统一清理入口 |
| 第三方 API 无 SLA | 新浪 / 东方财富为非官方接口，需依赖现有 cache fallback |
| `npm run preview` 无 API 代理 | Vite 代理仅 dev 生效，属预期行为；生产须配 Nginx（见 `deploy/`） |
| 生产部署需手动配置 | 代码侧已提供 `deploy/stockvault.nginx.conf`，部署本身不在应用代码范围内 |
