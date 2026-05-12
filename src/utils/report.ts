import type { Stock, Fund } from '../types';

interface ReportData {
  stocks: Stock[];
  funds: Fund[];
  stockPrices: Record<string, number>;
  fundNavs: Record<string, number>;
}

export function generateReportHTML(data: ReportData): string {
  const { stocks, funds, stockPrices, fundNavs } = data;

  let stockRows = '';
  let totalStockValue = 0;
  let totalStockCost = 0;

  for (const s of stocks) {
    const cp = stockPrices[s.code] ?? 0;
    const mv = cp * s.shares || s.holdingCost * s.shares;
    const cost = s.holdingCost * s.shares;
    const pl = mv - cost;
    const plPct = cost > 0 ? ((pl / cost) * 100).toFixed(2) : '0.00';
    totalStockValue += mv;
    totalStockCost += cost;

    stockRows += `<tr>
      <td>${s.name}</td><td>${s.code}</td><td>${cp.toFixed(2)}</td><td>${s.shares}</td>
      <td>${mv.toFixed(2)}</td><td style="color:${pl >= 0 ? 'red' : 'green'}">${pl.toFixed(2)}</td>
      <td style="color:${pl >= 0 ? 'red' : 'green'}">${plPct}%</td>
    </tr>`;
  }

  let fundRows = '';
  let totalFundValue = 0;
  let totalFundCost = 0;

  for (const f of funds) {
    const nav = fundNavs[f.code] ?? 0;
    const shares = f.holdingCost > 0 ? f.holdingAmount / f.holdingCost : 0;
    const mv = nav * shares || f.holdingAmount;
    const cost = f.holdingAmount;
    const pl = mv - cost;
    const plPct = cost > 0 ? ((pl / cost) * 100).toFixed(2) : '0.00';
    totalFundValue += mv;
    totalFundCost += cost;

    fundRows += `<tr>
      <td>${f.name || f.code}</td><td>${f.code}</td><td>${nav > 0 ? nav.toFixed(4) : '-'}</td>
      <td>${f.holdingAmount.toFixed(2)}</td><td>${mv.toFixed(2)}</td>
      <td style="color:${pl >= 0 ? 'red' : 'green'}">${pl.toFixed(2)}</td>
      <td style="color:${pl >= 0 ? 'red' : 'green'}">${plPct}%</td>
    </tr>`;
  }

  const totalValue = totalStockValue + totalFundValue;
  const totalCost = totalStockCost + totalFundCost;
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : '0.00';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>StockVault 投资报告</title>
  <style>
    body { font-family: 'PingFang SC','Microsoft YaHei',sans-serif; margin: 20px; font-size: 13px; }
    h1 { text-align: center; color: #333; }
    h2 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 5px; margin-top: 24px; }
    .summary { display: flex; gap: 16px; justify-content: center; margin: 16px 0; flex-wrap: wrap; }
    .card { background: #f5f6f8; border-radius: 8px; padding: 12px 20px; text-align: center; min-width: 120px; }
    .card .label { color: #888; font-size: 12px; }
    .card .val { font-size: 18px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: right; }
    th { background: #fafafa; color: #555; font-weight: 600; }
    td:first-child, td:nth-child(2) { text-align: left; }
    .timestamp { text-align: center; color: #999; margin-top: 20px; font-size: 11px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>StockVault 投资报告</h1>

  <h2>总览</h2>
  <div class="summary">
    <div class="card"><div class="label">总资产</div><div class="val">${totalValue.toFixed(2)}</div></div>
    <div class="card"><div class="label">总成本</div><div class="val">${totalCost.toFixed(2)}</div></div>
    <div class="card"><div class="label">盈亏损益</div><div class="val" style="color:${totalPL >= 0 ? 'red' : 'green'}">${totalPL.toFixed(2)}</div></div>
    <div class="card"><div class="label">盈亏比例</div><div class="val" style="color:${totalPL >= 0 ? 'red' : 'green'}">${totalPLPct}%</div></div>
    <div class="card"><div class="label">持仓数量</div><div class="val">${stocks.length + funds.length}</div></div>
  </div>

  ${stocks.length > 0 ? `
  <h2>股票持仓 (${stocks.length}只)</h2>
  <table><thead><tr><th>名称</th><th>代码</th><th>现价</th><th>股数</th><th>市值</th><th>盈亏</th><th>盈亏比例</th></tr></thead>
  <tbody>${stockRows}</tbody></table>` : ''}

  ${funds.length > 0 ? `
  <h2>基金持仓 (${funds.length}只)</h2>
  <table><thead><tr><th>名称</th><th>代码</th><th>净值</th><th>金额</th><th>市值</th><th>盈亏</th><th>盈亏比例</th></tr></thead>
  <tbody>${fundRows}</tbody></table>` : ''}

  <div class="timestamp">报告生成时间: ${new Date().toLocaleString('zh-CN')}</div>
  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:15px;cursor:pointer;">打印 / 导出PDF</button>
  </div>
</body>
</html>`;
}

export function downloadReport(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) w.focus();
  else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_report_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
