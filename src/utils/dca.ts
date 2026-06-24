import type { FundNavPoint } from '../types';
import { createLogger } from './logger';

const log = createLogger('dca');

interface DcaResult {
  totalInvested: number;
  totalShares: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  irr: number; // approximate annualized IRR
  lumpSumValue: number;
  lumpSumReturnPercent: number;
  navPoints: { date: string; nav: number; shares: number; cumulativeShares: number; invested: number; value: number }[];
}

export function simulateDCA(
  history: FundNavPoint[],
  amount: number,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  startDate: string,
  endDate: string
): DcaResult | null {
  log.info(`[simulateDCA] 开始 | amount=${amount} freq=${frequency} startDate=${startDate} endDate=${endDate} historyLen=${history.length}`);

  if (history.length < 2) {
    log.warn('[simulateDCA] 历史数据不足 (少于2个点), 返回 null');
    return null;
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    log.warn(`[simulateDCA] 开始日期 >= 结束日期 (${startDate} >= ${endDate}), 返回 null`);
    return null;
  }

  // Filter relevant data points
  const relevant = sorted.filter(p => {
    const d = new Date(p.date);
    return d >= start && d <= end;
  });

  log.debug(`[simulateDCA] 筛选后相关数据点: ${relevant.length} (总: ${sorted.length}), 范围 ${relevant[0]?.date} ~ ${relevant[relevant.length-1]?.date}`);

  if (relevant.length === 0) {
    log.warn('[simulateDCA] 日期范围内无数据点, 返回 null');
    return null;
  }

  let totalInvested = 0;
  let totalShares = 0;
  const navPoints: DcaResult['navPoints'] = [];

  // Determine investment dates
  const investDates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    investDates.push(new Date(current));
    switch (frequency) {
      case 'weekly': current.setDate(current.getDate() + 7); break;
      case 'biweekly': current.setDate(current.getDate() + 14); break;
      case 'monthly': current.setMonth(current.getMonth() + 1); break;
    }
  }

  log.info(`[simulateDCA] 投资日期数: ${investDates.length}, 首次: ${investDates[0].toISOString().split('T')[0]}, 末次: ${investDates[investDates.length-1].toISOString().split('T')[0]}`);

  // Pre-compute NAV map for O(1) lookup: for each date, find the latest NAV on or before it
  // Two-pointer scan: O(n+m) instead of O(n*m)
  const navEntries = [...relevant].sort((a, b) => a.date.localeCompare(b.date));
  let navIdx = 0;
  let skippedCount = 0;

  // Simulate DCA
  for (const investDate of investDates) {
    const dateStr = investDate.toISOString().split('T')[0];
    // Advance navIdx to find the latest NAV on or before the investment date
    let latestNav = 0;
    let latestDate = dateStr;
    while (navIdx < navEntries.length && navEntries[navIdx].date <= dateStr) {
      latestNav = navEntries[navIdx].nav;
      latestDate = navEntries[navIdx].date;
      navIdx++;
    }
    // Step back one so next iteration starts from the right position
    if (navIdx > 0) navIdx--;

    if (latestNav > 0) {
      const shares = amount / latestNav;
      totalInvested += amount;
      totalShares += shares;
      navPoints.push({
        date: latestDate,
        nav: latestNav,
        shares,
        cumulativeShares: totalShares,
        invested: totalInvested,
        value: totalShares * latestNav,
      });
    } else {
      skippedCount++;
      log.debug(`[simulateDCA] 跳过 ${dateStr}: 该日期前无可用净值数据`);
    }
  }

  if (skippedCount > 0) {
    log.warn(`[simulateDCA] 跳过了 ${skippedCount}/${investDates.length} 个定投日期 (日期前无净值数据)`);
  }

  if (totalInvested === 0) {
    log.warn('[simulateDCA] 总投资为0, 返回 null');
    return null;
  }

  const lastNav = relevant[relevant.length - 1].nav;
  const finalValue = totalShares * lastNav;
  const totalReturn = finalValue - totalInvested;
  const totalReturnPercent = (totalReturn / totalInvested) * 100;

  // Lump sum comparison
  const firstNav = relevant[0].nav;
  const lumpSumShares = totalInvested / firstNav;
  const lumpSumValue = lumpSumShares * lastNav;
  const lumpSumReturnPercent = ((lumpSumValue - totalInvested) / totalInvested) * 100;

  // Simple IRR approximation
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const irr = years > 0 ? (Math.pow(finalValue / totalInvested, 1 / years) - 1) * 100 : totalReturnPercent;

  log.info(`[simulateDCA] 结果: 总投入=${totalInvested.toFixed(2)} 最终市值=${finalValue.toFixed(2)} 收益率=${totalReturnPercent.toFixed(2)}% 年化IRR≈${irr.toFixed(2)}% 定投次数=${navPoints.length}`);
  log.info(`[simulateDCA] 一次性对比: 一次性投入收益率=${lumpSumReturnPercent.toFixed(2)}%`);

  return {
    totalInvested,
    totalShares,
    finalValue,
    totalReturn,
    totalReturnPercent,
    irr,
    lumpSumValue,
    lumpSumReturnPercent,
    navPoints,
  };
}

// Calculate new average cost after averaging down
export interface AvgDownResult {
  newHoldingCost: number;
  newShares: number;
  newTotalInvested: number;
  breakEvenPrice: number;
  breakEvenDropPercent: number;
}

export function calcAveragingDown(
  currentCost: number,
  currentShares: number,
  currentPrice: number,
  addAmount: number
): AvgDownResult {
  log.debug(`[calcAveragingDown] 当前成本=${currentCost} 当前份额=${currentShares} 当前价格=${currentPrice} 补仓金额=${addAmount}`);

  const newShares = addAmount / currentPrice;
  const newTotalInvested = currentCost * currentShares + addAmount;
  const totalShares = currentShares + newShares;
  const newHoldingCost = newTotalInvested / totalShares;
  const breakEvenDropPercent = currentPrice > 0
    ? ((currentCost - newHoldingCost) / currentCost) * 100
    : 0;

  log.debug(`[calcAveragingDown] 结果: 新成本=${newHoldingCost.toFixed(4)} 新增份额=${newShares.toFixed(2)} 成本降低=${breakEvenDropPercent.toFixed(2)}%`);

  return {
    newHoldingCost,
    newShares,
    newTotalInvested,
    breakEvenPrice: newHoldingCost,
    breakEvenDropPercent,
  };
}

// ─── 补仓网格计算 ───

export interface AvgDownGridLevel {
  /** 第几次补仓 (1-indexed) */
  level: number;
  /** 触发价位 */
  triggerPrice: number;
  /** 相对于基准价的累计跌幅 (%) */
  dropFromRef: number;
  /** 是否已完成 */
  completed: boolean;
  /** 实际补仓价格（如已完成） */
  actualPrice?: number;
}

/**
 * 计算补仓网格
 * @param referencePrice 基准价（初始持仓成本）
 * @param dropPct 每格跌幅百分比，如 4
 * @param completedPrices 已完成的补仓价格列表
 * @param maxLevels 最多显示几格，默认 10
 */
export function calcAvgDownGrid(
  referencePrice: number,
  dropPct: number,
  completedPrices: number[],
  maxLevels: number = 10,
): AvgDownGridLevel[] {
  if (referencePrice <= 0 || dropPct <= 0) return [];

  const sortedCompleted = [...completedPrices].sort((a, b) => b - a); // 降序
  const factor = 1 - dropPct / 100;

  const levels: AvgDownGridLevel[] = [];
  for (let i = 1; i <= maxLevels; i++) {
    const triggerPrice = referencePrice * Math.pow(factor, i);
    if (triggerPrice <= 0.01) break;

    const dropFromRef = ((referencePrice - triggerPrice) / referencePrice) * 100;

    // 判断是否已完成：已补仓价格中是否有 ≤ triggerPrice 但 ≥ 下一格触发价的
    const nextTrigger = referencePrice * Math.pow(factor, i + 1);
    const matched = sortedCompleted.find(
      p => p <= triggerPrice && p >= nextTrigger,
    );

    levels.push({
      level: i,
      triggerPrice: Math.round(triggerPrice * 100) / 100,
      dropFromRef: Math.round(dropFromRef * 100) / 100,
      completed: !!matched,
      actualPrice: matched,
    });
  }

  return levels;
}

/**
 * 获取下一次补仓触发信息
 * @returns 下次触发价位和距当前价的跌幅，若无则返回 null
 */
export function getNextAvgDownTrigger(
  grid: AvgDownGridLevel[],
  currentPrice: number,
): { level: number; triggerPrice: number; dropFromCurrent: number } | null {
  const next = grid.find(l => !l.completed);
  if (!next) return null;
  const dropFromCurrent = currentPrice > 0
    ? ((currentPrice - next.triggerPrice) / currentPrice) * 100
    : 0;
  return {
    level: next.level,
    triggerPrice: next.triggerPrice,
    dropFromCurrent: Math.round(dropFromCurrent * 100) / 100,
  };
}

export function generateAvgDownCurve(
  currentCost: number,
  currentShares: number,
  currentPrice: number,
  maxMultiple: number = 5
): { amount: number; cost: number; label: string }[] {
  const baseAmount = currentCost * currentShares;
  const results: { amount: number; cost: number; label: string }[] = [];

  log.debug(`[generateAvgDownCurve] baseAmount=${baseAmount} maxMultiple=${maxMultiple}`);

  for (let i = 0; i <= 20; i++) {
    const amount = (baseAmount * maxMultiple * i) / 20;
    const result = calcAveragingDown(currentCost, currentShares, currentPrice, amount);
    results.push({
      amount,
      cost: result.newHoldingCost,
      label: amount >= 1e4 ? (amount / 1e4).toFixed(1) + '万' : amount.toFixed(0),
    });
  }

  return results;
}
