import type { FundNavPoint } from '../types';

// ─── Constants (matching avg.py / backtest_compare.py) ───

const LOOKBACK_MONTHS = 6;
const ADD_POSITION_STD_MULT = 1.3;
const REDUCE_POSITION_MULT = 2.0;
const DATA_YEARS = 2;
const MULT_DROP = 2.0;
const MULT_STD = 1.3;
const DEFAULT_HOLD_DAYS = [5, 10, 20];

// ─── Analysis Result Types ───

export interface PositionSignalResult {
  name: string;
  /** 下跌日平均跌幅(%) */
  avgDrop: number;
  /** 上涨日平均涨幅(%) */
  avgRise: number;
  /** 近6月标准差(%) */
  stdDev: number;
  /** 加仓阈值(%) */
  addThreshold: number;
  /** 减仓阈值(%) */
  reduceThreshold: number;
  /** 最新涨跌幅(%) */
  latestPct: number;
  /** 加仓提醒 */
  addSignal: boolean;
  /** 减仓提醒 */
  reduceSignal: boolean;
  /** 统计起始日期 */
  statStart: string;
  /** 统计结束日期 */
  statEnd: string;
  /** 数据点数 */
  dataPoints: number;
  /** 错误信息 */
  error?: string;
  /** 基金赎回费率（仅基金类型有值） */
  redemptionFee?: string;
}

export interface BacktestRow {
  signals: number;
  winRate: number;
  avgRet: number;
  medRet: number;
  worst: number;
}

export interface BacktestResult {
  /** 数据点数 */
  dataPoints: number;
  /** 回测使用的持有天数 */
  holdDays: number[];
  /** drop策略回测结果 key=持有天数 */
  drop: Record<number, BacktestRow>;
  /** std策略回测结果 key=持有天数 */
  std: Record<number, BacktestRow>;
  /** 错误信息 */
  error?: string;
}

// ─── Helper: subset of date operations (No heavy library) ───

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

// ─── Position Signal Analysis ───

export function analyzePositionSignal(
  navPoints: FundNavPoint[],
  name?: string,
): PositionSignalResult {
  const empty: PositionSignalResult = {
    name: name || '',
    avgDrop: 0, avgRise: 0, stdDev: 0,
    addThreshold: 0, reduceThreshold: 0,
    latestPct: 0, addSignal: false, reduceSignal: false,
    statStart: '', statEnd: '', dataPoints: navPoints.length,
  };

  if (navPoints.length < 30) {
    return { ...empty, error: '数据不足（需至少30个交易日）' };
  }

  // Sort by date ascending
  const sorted = [...navPoints].sort((a, b) => a.date.localeCompare(b.date));
  const endDate = new Date(sorted[sorted.length - 1].date);
  const startDate = addMonths(endDate, -LOOKBACK_MONTHS);
  const statStart = startDate.toISOString().split('T')[0];
  const statEnd = endDate.toISOString().split('T')[0];

  // Filter to 6-month window
  const window = sorted.filter(p => p.date >= statStart && p.date <= statEnd);
  if (window.length < 30) {
    return { ...empty, error: `窗口数据不足（${statStart}~${statEnd}，仅${window.length}天）` };
  }

  const rates = window.map(p => p.growthRate).filter(r => !isNaN(r));
  if (rates.length < 30) {
    return { ...empty, error: '有效涨跌幅数据不足' };
  }

  const downRates = rates.filter(r => r < 0);
  const upRates = rates.filter(r => r > 0);
  const latestPct = rates[rates.length - 1];

  const avgDrop = downRates.length > 0 ? downRates.reduce((a, b) => a + b, 0) / downRates.length : 0;
  const avgRise = upRates.length > 0 ? upRates.reduce((a, b) => a + b, 0) / upRates.length : 0;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  const addThreshold = -ADD_POSITION_STD_MULT * stdDev;
  const reduceThreshold = REDUCE_POSITION_MULT * avgRise;

  const addSignal = downRates.length > 0 && latestPct < 0 && latestPct <= addThreshold;
  const reduceSignal = upRates.length > 0 && latestPct > 0 && latestPct >= reduceThreshold;

  return {
    name: name || '',
    avgDrop: round2(avgDrop),
    avgRise: round2(avgRise),
    stdDev: round2(stdDev),
    addThreshold: round2(addThreshold),
    reduceThreshold: round2(reduceThreshold),
    latestPct: round2(latestPct),
    addSignal,
    reduceSignal,
    statStart,
    statEnd,
    dataPoints: window.length,
  };
}

// ─── Backtest ───

export function backtestStrategies(
  navPoints: FundNavPoint[],
  holdDays?: number[],
): BacktestResult {
  const days = (holdDays && holdDays.length > 0 ? [...holdDays] : DEFAULT_HOLD_DAYS).sort((a, b) => a - b);
  const emptyRow = { signals: 0, winRate: 0, avgRet: 0, medRet: 0, worst: 0 };
  const empty: BacktestResult = {
    dataPoints: navPoints.length,
    holdDays: [...days],
    drop: Object.fromEntries(days.map(h => [h, { ...emptyRow }])),
    std: Object.fromEntries(days.map(h => [h, { ...emptyRow }])),
  };

  if (navPoints.length < 80) {
    return { ...empty, error: '数据不足（需至少80个交易日用于回测）' };
  }

  const sorted = [...navPoints].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = addMonths(new Date(), -DATA_YEARS);
  const filtered = sorted.filter(p => new Date(p.date) >= cutoff);

  if (filtered.length < 80) {
    return { ...empty, error: `近${DATA_YEARS}年数据不足（仅${filtered.length}天）` };
  }

  // Accumulators for each strategy × hold day combination
  const dropReturns: Record<number, number[]> = Object.fromEntries(days.map(d => [d, [] as number[]]));
  const dropWins: Record<number, number> = Object.fromEntries(days.map(d => [d, 0]));
  const stdReturns: Record<number, number[]> = Object.fromEntries(days.map(d => [d, [] as number[]]));
  const stdWins: Record<number, number> = Object.fromEntries(days.map(d => [d, 0]));

  const earliestSignalDate = addMonths(new Date(filtered[0].date), LOOKBACK_MONTHS);

  for (let i = 0; i < filtered.length; i++) {
    const currentDate = new Date(filtered[i].date);
    if (currentDate < earliestSignalDate) continue;

    const latestPct = filtered[i].growthRate;
    if (isNaN(latestPct)) continue;

    // Build rolling 6-month window up to current point
    const windowStart = addMonths(currentDate, -LOOKBACK_MONTHS);
    const windowStartStr = windowStart.toISOString().split('T')[0];
    const window = filtered.filter(
      p => p.date >= windowStartStr && p.date <= filtered[i].date
    ).filter(p => !isNaN(p.growthRate));

    if (window.length < 30) continue;

    const downDays = window.filter(p => p.growthRate < 0);
    if (downDays.length === 0) continue;

    const avgDrop = downDays.reduce((s, p) => s + p.growthRate, 0) / downDays.length;

    const m = window.reduce((s, p) => s + p.growthRate, 0) / window.length;
    const stdAll = Math.sqrt(window.reduce((s, p) => s + (p.growthRate - m) ** 2, 0) / window.length);

    const signalDrop = latestPct < 0 && latestPct <= MULT_DROP * avgDrop;
    const signalStd = latestPct < 0 && latestPct <= -MULT_STD * stdAll;

    if (!signalDrop && !signalStd) continue;

    for (const hold of days) {
      const futureEnd = i + hold;
      if (futureEnd >= filtered.length) continue;

      // Cumulative return over hold period
      let cumRet = 0;
      for (let j = i + 1; j <= futureEnd; j++) {
        cumRet += filtered[j].growthRate || 0;
      }

      if (signalDrop) {
        dropReturns[hold].push(cumRet);
        if (cumRet > 0) dropWins[hold]++;
      }
      if (signalStd) {
        stdReturns[hold].push(cumRet);
        if (cumRet > 0) stdWins[hold]++;
      }
    }
  }

  const result: BacktestResult = {
    dataPoints: filtered.length,
    holdDays: [...days],
    drop: {} as Record<number, BacktestRow>,
    std: {} as Record<number, BacktestRow>,
  };

  for (const hold of days) {
    result.drop[hold] = buildBacktestRow(dropReturns[hold], dropWins[hold]);
    result.std[hold] = buildBacktestRow(stdReturns[hold], stdWins[hold]);
  }

  return result;
}

function buildBacktestRow(returns: number[], wins: number): BacktestRow {
  const n = returns.length;
  if (n === 0) return { signals: 0, winRate: 0, avgRet: 0, medRet: 0, worst: 0 };
  const sorted = [...returns].sort((a, b) => a - b);
  const med = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  return {
    signals: n,
    winRate: round2((wins / n) * 100),
    avgRet: round2(returns.reduce((a, b) => a + b, 0) / n),
    medRet: round2(med),
    worst: round2(sorted[0]),
  };
}

// ─── Currency / Redemption Fee ───

export const STRATEGY_LABELS = { drop: '均值跌幅 ×2.0', std: '标准差 ×1.3' } as const;

export function getHoldLabel(days: number): string {
  if (days >= 365) return `${days / 365}年`;
  if (days >= 30) return `${Math.round(days / 30)}月`;
  return `${days}天`;
}

/** 从赎回费率字符串中提取0费率所需天数，如 "≥7天"→7, "≥2年"→730, "免费"→0 */
export function getZeroFeeDays(feeStr?: string): number {
  if (!feeStr || feeStr === '-' || feeStr === '免费') return 0;
  const match = feeStr.match(/[≥>]\s*(\d+)\s*(天|年|月)/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === '年') return num * 365;
  if (unit === '月') return num * 30;
  return num;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
