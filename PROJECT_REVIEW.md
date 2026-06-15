# StockVault 项目审查报告

> 初次审查：2026-06-15  
> 最后更新：2026-06-15  
> 范围：产品功能、UI/UX、Bug、代码质量、部署风险

---

## 状态总览

| 层级 | 状态 | 说明 |
|------|------|------|
| P0 阻塞发布 | ✅ 已完成 | 构建通过；生产代理已提供 Nginx 配置 |
| P1 核心体验 | ✅ 已完成 | 港美股刷新、关注涨跌幅、时区、隐私模式、PWA 图标 |
| P2 体验打磨 | ✅ 已完成 | 快捷键、云同步、标签筛选、补仓计算器、ESLint |
| P3 长期优化 | ⏳ 未开始 | 信息架构、IndexedDB、无障碍等 |
| 第四节 UI 建议 | ⏳ 大部分未做 | 见下文「待优化项」 |

**CI 状态（2026-06-15）：**

```bash
npm run build   # ✅ 通过
npm run lint    # ✅ 通过
```

---

## 一、项目概览

StockVault 是一款 A 股持仓管理 Web 应用，支持股票/基金持仓、实时行情、图表分析、交易记录、多账户、GitHub Gist 云同步等功能。

**技术栈：** React 19 + TypeScript + Vite 8 + Zustand + Recharts + CSS Modules

**主要模块：**

| 模块 | 说明 |
|------|------|
| 概览 (Dashboard) | 总资产卡片、走势、资产配置、涨跌 Top3、盈亏日历 |
| 持仓 (HoldingsView) | 股票/基金表格、工具栏、图表分析、定投/策略回测 |
| 关注 (WatchlistView) | 自选股/基金关注列表，可转为持仓 |
| 云同步 (SyncPanel) | GitHub Gist 推/拉、自动同步/自动备份开关 |
| 多账户 (AccountSwitcher) | 分账户管理持仓，删除时清理关联数据 |

---

## 二、构建与代码质量

### 2.1 TypeScript 编译 — ✅ 已修复

| 文件 | 原问题 | 修复方式 |
|------|--------|----------|
| `FormationChart.tsx` | 未使用的 `FORMATION_OPTIONS` 导入 | 已删除 |
| `HoldingsView.tsx` | JSON 导入缺少 `formation` | 导入归一化已补充 |
| `WatchlistView.tsx` | `moveToStock` / `moveToFund` 缺少 `formation` | 已补充 `formation: ''` |

### 2.2 ESLint — ✅ 已修复

- 移除 `any` 类型，改用具体类型（`SyncPanel`、`Dashboard` 等）
- `SyncPanel` 改为 `handleOpen` 时加载配置，避免 effect 内 setState
- `prefer-const` 等问题已处理

---

## 三、Bug 修复记录

### 🔴 高优先级 — 全部已修复

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| 1 | 港股/美股行情无法刷新 | ✅ | `useStockStore.refreshPrices` 按市场分组，港/美调用 `fetchForeignPrices` |
| 2 | 关注列表 A 股涨跌幅不显示 | ✅ | `WatchlistView` 从 `fetchStockPrices` 提取 `changePercent` |
| 3 | 收盘快照时区错误 | ✅ | `App.tsx` 使用 `Intl` + `Asia/Shanghai` |
| 4 | 生产环境 API 代理不可用 | ⚠️ 部分 | 新增 `deploy/stockvault.nginx.conf`；部署时需自行配置 Nginx |
| 5 | PWA 图标缺失 | ✅ | 已添加 `public/icon-192.png`、`icon-512.png` |

### 🟡 中优先级 — 全部已修复

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| 6 | 隐私模式无 UI | ✅ | Toolbar「🙈 隐藏 / 👁 显示」，股票+基金均支持 |
| 7 | 标签筛选无 UI | ✅ | Toolbar 标签下拉筛选 |
| 8 | 补仓计算器未挂载 | ✅ | `StockTable` / `FundTable` 展开面板已接入 `AveragingDownCalc` |
| 9 | 云同步历史数据不完整 | ✅ | `gistSync.pullFromGist` 使用 `mergeNamespacedData` 合并多账户历史 |
| 10 | 删除账户不清理数据 | ✅ | `useAccountStore.deleteAccount` 清理持仓、交易、历史记录 |
| 11 | 自动备份无开关 | ✅ | `SyncPanel` 提供「每12小时自动备份下载」开关 |

### 🟢 低优先级 — 全部已修复

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| 12 | 快捷键与 Tab 顺序不一致 | ✅ | `1`概览 `2`持仓 `3`关注，与界面一致 |
| 13 | Dashboard 空状态文案错误 | ✅ | 已改为「持仓 / 关注」 |
| 14 | 关注列表无手动刷新 | ✅ | 已加「刷新行情」按钮 |
| 15 | 双重定时刷新 | ✅ | `App.tsx` 移除 30 分钟轮询，仅保留收盘快照；周期刷新由 Toolbar `useAutoRefresh` 负责 |

### 遗留说明

- **Bug #4**：`npm run preview` 仍无 API 代理，生产环境须配合 Nginx（见 `deploy/` 目录）
- **Bug #9**：`SyncPanel.handlePull` 在 `gistSync` 合并后仍从 localStorage 重读当前账户视图，逻辑冗余但功能正常

---

## 四、待优化项（未实施）

### 4.1 信息架构

| 建议 | 状态 |
|------|------|
| 持仓页图表拆为子 Tab 或折叠面板 | ⏳ 未做 |
| 概览与持仓减少重复图表 | ⏳ 未做 |
| Header「更多」菜单收纳次要操作 | ⏳ 未做 |

### 4.2 交互体验

| 建议 | 状态 |
|------|------|
| 切换账户后在概览/Header 显示当前账户名 | ⏳ 未做 |
| 表格刷新 loading 骨架屏 | ⏳ 未做 |
| 统一所有 Modal 支持 Esc 关闭 | ⏳ 部分（表单已有） |
| 移动端表格关键列固定 | ⏳ 未做 |
| 盈亏日历增加红涨绿跌图例 | ⏳ 未做 |

### 4.3 可访问性

| 建议 | 状态 |
|------|------|
| 主题切换 `aria-label` | ⏳ 未做 |
| Tab `role="tablist"` + `aria-selected` | ⏳ 未做 |
| Tab 上标注快捷键提示 | ⏳ 未做 |

### 4.4 功能补全

| 功能 | 状态 |
|------|------|
| 隐私模式开关 | ✅ 已完成 |
| 标签筛选 | ✅ 已完成 |
| 补仓计算器 | ✅ 已完成 |
| 关注列表刷新 | ✅ 已完成 |
| 全量备份/恢复入口 | ⏳ 未做（自动备份逻辑可复用） |
| 概览注明当前账户视图 | ⏳ 未做 |

---

## 五、架构与数据风险（持续存在）

### 5.1 localStorage 容量

基金历史净值、基准数据、价值历史均缓存到 localStorage。持仓较多时可能触发 `QuotaExceededError`。

**建议：** 提供「清理缓存」入口，或迁移 IndexedDB。（⏳ 未做）

### 5.2 多账户「总计」逻辑

`filterByAccount` 在 `accountId === 'default'` 时返回全部持仓（含各子账户）。同一标的分到多账户时，概览可能重复计算。

### 5.3 行情 API 依赖

- 新浪财经（股票/基金实时）
- 东方财富（基金历史净值、基准 K 线）

均为非官方接口，无 SLA；部分场景已有 cache fallback。

---

## 六、修复路线图（更新后）

```
P0 — 阻塞发布                          ✅ 已完成
├── TypeScript formation 字段
├── 生产环境 API 代理（Nginx 配置已提供）
└── 港股/美股 refreshPrices

P1 — 核心体验                          ✅ 已完成
├── 关注列表 A 股涨跌幅
├── 收盘快照北京时间
├── 隐私模式 UI
└── PWA 图标

P2 — 体验打磨                          ✅ 已完成
├── 快捷键与 Tab 对齐
├── 云同步多账户历史数据
├── 标签筛选 UI
├── 补仓计算器挂载
├── 删除账户清理数据
├── 自动备份开关
└── ESLint 清理

P3 — 长期                              ⏳ 待做
├── 持仓页信息架构重构
├── localStorage → IndexedDB
├── 全量备份/恢复 UI
├── 无障碍与移动端优化
└── README / 部署文档完善
```

---

## 七、快速验证清单

```bash
# 1. 构建
npm run build          # 预期：通过

# 2. Lint
npm run lint           # 预期：通过

# 3. 开发环境冒烟
npm run dev
# - 添加 A 股 → 刷新行情 → 价格更新
# - 添加港股 → 刷新行情 → 价格应正常（非 0）
# - 关注列表 A 股 → 涨跌幅应显示
# - Toolbar「隐藏」→ 名称/代码变为 ***
# - 标签下拉筛选 → 表格过滤正确
# - 展开行 → 补仓计算器可用
# - 快捷键 1/2/3 → 概览/持仓/关注
# - 云同步推/拉 → 多账户历史一致
# - 同步面板关闭自动备份 → 不再自动下载

# 4. 生产部署
# - 将 dist/ 部署到 Nginx，使用 deploy/stockvault.nginx.conf 配置 API 代理
# - npm run preview 单独使用时代理不可用，属预期行为
```

---

## 八、总结

P0～P2 问题已全部修复，`npm run build` 与 `npm run lint` 均可通过。项目已具备发布条件，但生产部署须配置 Nginx 反向代理。

下一迭代建议聚焦 **P3**：持仓页信息架构、IndexedDB 迁移、无障碍与移动端体验，以及全量备份/恢复入口。
