# StockVault

A股持仓管理工具，同时管理股票和基金持仓，支持实时行情、图表分析、交易记录与云同步。

## 功能

- **股票持仓** — 新浪财经实时价格，支持 A 股 / 港股 / 美股，多批次买入价、止盈价和目标价
- **基金持仓** — 实时净值、累计净值、日涨跌幅，以及近 6 月日均跌幅统计
- **图表分析** — 持仓饼图、市值趋势、阵容图、行业分布、基准对比等
- **交易记录** — 买入卖出、网格交易、现金/红利再投分红
- **多账户** — 分账户管理持仓，删除账户时自动清理关联数据
- **关注列表** — 自选股/基金关注，支持手动刷新、一键转为持仓
- **概览仪表盘** — 总资产、配置、涨跌 Top3、盈亏日历
- **表格排序** — 点击表头按各列排序
- **标签筛选** — 按标签过滤股票/基金持仓
- **隐私模式** — 一键隐藏股票/基金名称和代码
- **暗色模式** — 亮色/暗色切换，跟随系统偏好
- **数据导入导出** — JSON / CSV 格式
- **价格提醒** — 浏览器桌面通知（目标价、止盈价等）
- **自动备份** — 可选每 12 小时自动下载 JSON 备份（云同步面板内开关）
- **GitHub Gist 云同步** — 私有 Gist 推/拉，支持多账户数据

## 技术栈

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vitejs.dev) 开发与构建
- [Zustand](https://zustand.docs.pmnd.rs/) 状态管理
- [Recharts](https://recharts.org) 图表
- CSS Modules 样式隔离
- 新浪财经 API（股票/基金实时行情）+ 东方财富 API（基金历史净值、基准 K 线）

## 开始

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 4396，内置 API 代理）
npm run dev

# 构建
npm run build

# 预览构建产物（注意：无 API 代理，行情功能不可用）
npm run preview
```

## 使用说明

1. 在「持仓」页点击「添加股票」或「添加基金」录入持仓
2. 点击「刷新行情」获取最新价格/净值
3. 点击行首 ▶ 展开详情：交易记录、网格交易、补仓计算器、笔记等
4. 工具栏支持标签筛选、隐私模式、定投/策略回测
5. 右上角「同步」配置 GitHub Gist 云同步与自动备份

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` | 概览 |
| `2` | 持仓 |
| `3` | 关注 |
| `?` | 显示/隐藏快捷键帮助 |

## 生产部署

开发环境下 Vite 自动代理行情 API；**生产构建为纯静态文件，须自行配置反向代理**，否则刷新行情会 404。

项目已提供 Nginx 配置模板：

```bash
# 1. 构建
npm run build

# 2. 将 dist/ 上传到服务器（如 /var/www/stockvault）

# 3. 使用 deploy/stockvault.nginx.conf 配置 Nginx
#    - 修改 server_name 为你的域名
#    - 代理 /api/sina、/api/fundnav、/api/benchmark 到对应上游

# Windows 本地可参考 deploy/deploy.ps1
```

代理路径说明：

| 路径 | 上游 |
|------|------|
| `/api/sina/` | `https://hq.sinajs.cn/` |
| `/api/fundnav/` | `https://api.fund.eastmoney.com/` |
| `/api/benchmark/` | `https://push2his.eastmoney.com/` |

## 数据存储

所有数据存储在浏览器 localStorage 中，云同步通过 GitHub Gist 实现。可随时通过 JSON 导出或自动备份功能保存数据。

## 项目审查

详见 [PROJECT_REVIEW.md](./PROJECT_REVIEW.md) — 包含 Bug 修复记录、待优化项与验证清单。

## License

MIT
