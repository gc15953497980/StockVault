import type { KlineBar } from './api';

// ─── Types ───

export interface ZScoreResult {
  ma: number;
  std: number;
  zScore: number;
}

export type SignalDirection = 'buy' | 'sell' | 'none';

export interface SignalResult {
  direction: SignalDirection;
  zScore20: number;
  zScore120: number;
  latestClose: number;
  ma20: number;
  ma120: number;
  std20: number;
  avgTurnover: number;
  suggestion: string;
  blockedByVolume: boolean;
  blockedByNewLow: boolean;
  trendOk: boolean;
  diagnostic: string;  // Why signal triggered or what's blocking it
}

// ─── Constants ───

const MIN_TURNOVER = 5e9;
const SELL_THRESHOLD = 1.5;
const SELL_STRONG = 2.0;
const BUY_THRESHOLD = -1.5;
const BUY_STRONG = -2.0;

// ─── Core calculation ───

/** Compute MA / StdDev / Z-score for the last `period` close prices. */
export function calcZScore(bars: KlineBar[], period: number): ZScoreResult | null {
  if (bars.length < period) return null;

  const recent = bars.slice(-period);
  const closes = recent.map(b => b.close);

  const ma = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((s, c) => s + (c - ma) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  const latestClose = closes[closes.length - 1];
  const zScore = std > 0 ? (latestClose - ma) / std : 0;

  return { ma, std, zScore };
}

// ─── Signal generation ───

function fmtZ(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

/** Always returns a result — with diagnostic explaining what happened. */
export function generateSignal(bars: KlineBar[]): SignalResult | null {
  const z20 = calcZScore(bars, 20);
  const z120 = calcZScore(bars, 120);
  if (!z20) return null;

  const latestClose = bars[bars.length - 1].close;

  const recent20 = bars.slice(-20);
  const avgTurnover = recent20.reduce((s, b) => s + b.volume * 100 * b.close, 0) / 20;

  let consecutiveNewLows = 0;
  for (let i = bars.length - 1; i >= 20; i--) {
    const min20 = Math.min(...bars.slice(i - 20, i).map(b => b.close));
    if (bars[i].close < min20) { consecutiveNewLows++; } else { break; }
  }

  const blockedByVolume = avgTurnover < MIN_TURNOVER;
  const blockedByNewLow = consecutiveNewLows >= 3;
  const trendOk = z120 ? z120.zScore < 0 : false;
  const z120s = z120?.zScore ?? 0;

  let direction: SignalDirection = 'none';
  let suggestion = '';
  let diagnostic = '';

  // ── Sell signals ──
  if (!blockedByVolume) {
    if (z20.zScore >= SELL_STRONG) {
      direction = 'sell';
      suggestion = '卖出 30%-50%';
      diagnostic = `Z20=${fmtZ(z20.zScore)} ≥ +2.0 强卖出`;
    } else if (z20.zScore > SELL_THRESHOLD) {
      direction = 'sell';
      suggestion = '卖出 10%';
      diagnostic = `Z20=${fmtZ(z20.zScore)} > +1.5 卖出`;
    } else if (z20.zScore < 1.0 && z20.zScore >= 0) {
      const prev = calcZScore(bars.slice(0, -1), 20);
      if (prev && prev.zScore >= 1.5) {
        direction = 'sell';
        suggestion = '清仓（Z20 从高位回落）';
        diagnostic = `Z20=${fmtZ(z20.zScore)} 从 ${fmtZ(prev.zScore)} 回落至 +1.0 以下`;
      }
    }
  }

  // ── Buy signals ──
  if (direction === 'none') {
    // Build diagnostic explaining what's blocking
    const blockers: string[] = [];
    if (blockedByVolume) blockers.push('成交额不足50亿');
    if (blockedByNewLow) blockers.push(`连续${consecutiveNewLows}日新低`);
    if (!trendOk) blockers.push(`Z120=${fmtZ(z120s)} ≥ 0 大势不配合`);

    if (!blockedByVolume && !blockedByNewLow && trendOk) {
      if (z20.zScore <= BUY_STRONG) {
        direction = 'buy';
        suggestion = '买入 2-3 份';
        diagnostic = `Z20=${fmtZ(z20.zScore)} ≤ -2.0 Z120=${fmtZ(z120s)}<0 强买入`;
      } else if (z20.zScore < BUY_THRESHOLD) {
        direction = 'buy';
        suggestion = '买入 1 份';
        diagnostic = `Z20=${fmtZ(z20.zScore)} < -1.5 Z120=${fmtZ(z120s)}<0 买入`;
      } else if (z20.zScore > -1.0 && z20.zScore <= -0.5) {
        const prev = calcZScore(bars.slice(0, -1), 20);
        if (prev && prev.zScore < -1.5) {
          direction = 'buy';
          suggestion = '最后一次加仓（Z20 反弹）';
          diagnostic = `Z20=${fmtZ(z20.zScore)} 从 ${fmtZ(prev.zScore)} 反弹 最后加仓`;
        }
      }

      if (direction === 'none') {
        // All conditions met but Z20 not at threshold
        if (z20.zScore < 0 && z20.zScore > BUY_THRESHOLD) {
          diagnostic = `Z20=${fmtZ(z20.zScore)} 距买入线(-1.5)差${fmtZ(BUY_THRESHOLD - z20.zScore)}`;
        } else if (z20.zScore >= 0 && z20.zScore < SELL_THRESHOLD) {
          diagnostic = `Z20=${fmtZ(z20.zScore)} 距卖出线(+1.5)差${fmtZ(SELL_THRESHOLD - z20.zScore)}`;
        } else {
          diagnostic = `无信号`;
        }
      }
    } else {
      // Blocked by at least one filter
      if (z20.zScore < BUY_THRESHOLD) {
        diagnostic = `Z20=${fmtZ(z20.zScore)} 触发买入线 但 ${blockers.join(' + ')}`;
      } else if (z20.zScore < 0) {
        diagnostic = `Z20=${fmtZ(z20.zScore)} 偏便宜 但 ${blockers.join(' + ')}`;
      } else {
        diagnostic = `Z20=${fmtZ(z20.zScore)} ${blockers.join(' + ')}`;
      }
    }

    // Volume-blocked sell fallback
    if (direction === 'none' && blockedByVolume && z20.zScore > SELL_THRESHOLD) {
      diagnostic = `Z20=${fmtZ(z20.zScore)} > +1.5 但成交额不足50亿`;
    }
  }

  return {
    direction,
    zScore20: z20.zScore,
    zScore120: z120s,
    latestClose,
    ma20: z20.ma,
    ma120: z120?.ma ?? 0,
    std20: z20.std,
    avgTurnover,
    suggestion,
    blockedByVolume,
    blockedByNewLow,
    trendOk,
    diagnostic,
  };
}
