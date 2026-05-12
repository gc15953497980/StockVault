import type { Stock, Fund } from '../types';
import { calcStock, calcFund } from './api';

export function stocksToCSV(
  stocks: Stock[],
  prices: Record<string, number>,
  marketCaps: Record<string, number>
): string {
  const headers = [
    '代码', '名称', '现价', '持仓成本', '持仓数量', '当前市值',
    '浮动盈亏', '盈亏比例', '目标价', '距目标跌幅', '目标市值',
    '成本总计', '流通市值',
  ];
  const rows = stocks.map((s) => {
    const cp = prices[s.code] ?? 0;
    const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
    return [
      s.code, s.name, cp.toFixed(2), s.holdingCost.toFixed(2), String(s.shares),
      calc.currentMarketValue.toFixed(2), calc.profitLoss.toFixed(2),
      calc.profitLossPercent.toFixed(2), calc.targetPrice > 0 ? calc.targetPrice.toFixed(2) : '',
      calc.dropToTargetPercent > 0 ? (-calc.dropToTargetPercent).toFixed(2) : '',
      calc.targetMarketValue > 0 ? calc.targetMarketValue.toFixed(2) : '',
      calc.costTotal.toFixed(2), (marketCaps[s.code] || s.marketCap || calc.costTotal).toFixed(2),
    ];
  });
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

export function fundsToCSV(
  funds: Fund[],
  navs: Record<string, number>,
  accumulatedNAVs: Record<string, number>,
  avgDownsides?: Record<string, number>
): string {
  const headers = [
    '代码', '名称', '最新净值', '累计净值', '持仓成本净值',
    '持有金额', '持有份额', '持有市值', '浮动盈亏', '盈亏比例',
    '近6月日均跌幅',
  ];
  const rows = funds.map((f) => {
    const nav = navs[f.code] ?? 0;
    const accNAV = accumulatedNAVs[f.code] ?? 0;
    const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
    const avgDown = avgDownsides?.[f.code];
    return [
      f.code, f.name, nav > 0 ? nav.toFixed(4) : '', accNAV > 0 ? accNAV.toFixed(4) : '',
      f.holdingCost > 0 ? f.holdingCost.toFixed(4) : '',
      f.holdingAmount > 0 ? f.holdingAmount.toFixed(2) : '',
      calc.shares > 0 ? calc.shares.toFixed(2) : '',
      calc.marketValue.toFixed(2), calc.profitLoss.toFixed(2),
      calc.profitLossPercent.toFixed(2),
      avgDown !== undefined ? avgDown.toFixed(2) + '%' : '',
    ];
  });
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function downloadCSV(csv: string, filename: string) {
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
