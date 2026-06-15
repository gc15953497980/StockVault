# StockVault

A股持仓管理工具，同时管理股票和基金持仓，支持实时行情、图表分析、交易记录与云同步。

## 功能

- **股票持仓** — 新浪财经实时价格，支持 A 股 / 港股 / 美股，多批次买入价、止盈价和目标价
- **基金持仓** — 实时净值、累计净值、日涨跌幅，以及近 6 月日均跌幅统计
- **图表分析** — 持仓饼图、市值趋势、阵容图、行业分布、基准对比等（可折叠）
- **交易记录** — 买入卖出、网格交易、现金/红利再投分红
- **多账户** — 分账户管理持仓，Header 显示当前账户名，删除账户时自动清理关联数据
- **关注列表** — 自选股/基金关注，支持手动刷新、一键转为持仓
- **黄金开采成本** — 伦敦金实时价格 vs AISC 开采成本对比分析
- **概览仪表盘** — 总资产、配置、涨跌 Top3、盈亏日历（红涨绿跌）
- **表格排序** — 点击表头按各列排序
- **标签筛选** — 按标签过滤股票/基金持仓
- **隐私模式** — 一键隐藏股票/基金名称和代码
- **暗色模式** — 亮色/暗色切换，跟随系统偏好，通过「更多」菜单切换
- **数据导入导出** — JSON / CSV 格式，支持全量备份与恢复
- **价格提醒** — 浏览器桌面通知（目标价、止盈价等）
- **自动备份** — 可选每 12 小时自动下载 JSON 备份（云同步面板内开关）
- **GitHub Gist 云同步** — 私有 Gist 推/拉，支持多账户数据
- **IndexedDB 存储** — 大容量数据自动迁移至 IndexedDB，支持清除缓存
- **键盘快捷键** — Tab 上显示快捷键提示，支持 `1`-`4` 切换页面，`?` 查看所有快捷键
- **无障碍支持** — Tab 导航 ARIA 属性、Modal Esc 关闭、移动端表格首列固定

## 技术栈

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vitejs.dev) 开发与构建
- [Zustand](https://zustand.docs.pmnd.rs/) 状态管理
- [Recharts](https://recharts.org) 图表
- CSS Modules 样式隔离
- IndexedDB + localStorage 混合存储
- 新浪财经 API（股票/基金实时行情）+ 东方财富 API（基金历史净值、基准 K 线）

## 开始

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 4396，内置 API 代理）
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 预览构建产物（注意：无 API 代理，行情功能不可用）
npm run preview
```

## 使用说明

1. 在「持仓」页点击「添加股票」或「添加基金」录入持仓
2. 点击「刷新行情」获取最新价格/净值
3. 点击行首 ▶ 展开详情：交易记录、网格交易、补仓计算器、笔记等
4. 工具栏支持标签筛选、隐私模式、定投/策略回测、自动刷新
5. 右上角「同步」配置 GitHub Gist 云同步与自动备份
6. 同步面板支持全量备份/恢复：导出所有本地数据为 JSON，或从备份文件恢复
7. 使用「更多」菜单（`···`）切换亮暗色模式、查看快捷键

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` | 概览 |
| `2` | 持仓 |
| `3` | 关注 |
| `4` | 黄金开采成本 |
| `?` | 显示/隐藏快捷键帮助 |
| `Esc` | 关闭弹窗/快捷键面板 |

## 生产部署

开发环境下 Vite 自动代理行情 API；**生产构建为纯静态文件，须自行配置反向代理**，否则刷新行情会 404。

### 部署步骤

```bash
# 1. 构建
npm run build

# 2. 将 dist/ 上传到服务器（如 /var/www/stockvault）

# 3. 使用 deploy/stockvault.nginx.conf 配置 Nginx
#    - 修改 server_name 为你的域名
#    - 代理 /api/sina、/api/fundnav、/api/benchmark 到对应上游

# Windows 本地可参考 deploy/deploy.ps1
```

### Nginx 配置要点

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/stockvault;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/sina/ {
        proxy_pass https://hq.sinajs.cn/;
        proxy_set_header Referer "https://finance.sina.com.cn";
    }

    location /api/fundnav/ {
        proxy_pass https://api.fund.eastmoney.com/;
        proxy_set_header Referer "https://eastmoney.com/";
    }

    location /api/benchmark/ {
        proxy_pass https://push2his.eastmoney.com/;
        proxy_set_header Referer "https://eastmoney.com/";
    }
}
```

代理路径说明：

| 路径 | 上游 | 用途 |
|------|------|------|
| `/api/sina/` | `https://hq.sinajs.cn/` | A股/港股/美股实时行情 |
| `/api/fundnav/` | `https://api.fund.eastmoney.com/` | 基金净值、历史数据 |
| `/api/benchmark/` | `https://push2his.eastmoney.com/` | 基准 K 线数据 |

### CORS 注意事项

新浪财经 API 对 `Referer` 校验较严格，Nginx 须添加 `proxy_set_header Referer`。开发环境 Vite 已自动处理。

## 数据存储

- **localStorage**：核心配置与小数据（账户、持仓列表、交易记录、关注列表）
- **IndexedDB**：大数据自动迁移（价值历史、盈亏日历、基金历史净值）
- **云同步**：GitHub Gist 作为远程存储，支持推/拉与自动同步
- **备份恢复**：同步面板提供「全量备份」（导出 JSON）和「全量恢复」（导入 JSON），以及「清除缓存」入口

## 项目结构

```
src/
├── App.tsx                  # 主应用：路由、主题、键盘快捷键、IndexedDB 迁移
├── components/              # UI 组件
│   ├── Dashboard.tsx        # 概览仪表盘
│   ├── HoldingsView.tsx     # 持仓页面（股票+基金+图表）
│   ├── WatchlistView.tsx    # 关注列表
│   ├── StockTable.tsx       # 股票持仓表格
│   ├── FundTable.tsx        # 基金持仓表格
│   ├── SyncPanel.tsx        # 云同步 + 全量备份/恢复面板
│   ├── AccountSwitcher.tsx  # 多账户切换器
│   └── ...                  # 图表、计算器等
├── store/                   # Zustand 状态管理
├── utils/                   # 工具函数
│   ├── api.ts               # API 调用（新浪、东方财富）
│   ├── gistSync.ts          # GitHub Gist 云同步
│   ├── storage.ts           # IndexedDB + localStorage 混合存储
│   └── ...                  # 备份、通知、CSV 等
├── types/                   # TypeScript 类型定义
├── hooks/                   # 自定义 Hooks
└── index.css                # 全局样式与 CSS 变量
```

## 项目审查

详见 [PROJECT_REVIEW.md](./PROJECT_REVIEW.md) — 包含 Bug 修复记录、待优化项与验证清单。

## License

MIT
