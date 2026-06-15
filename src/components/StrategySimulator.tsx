import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, Scatter, Line } from 'recharts';
import { fetchFundHistoryNAV } from '../utils/api';
import type { FundNavPoint } from '../types';
import { createLogger } from '../utils/logger';
import styles from './DcaCalculator.module.css';

const log = createLogger('StrategySimulator');

interface Props { onClose: () => void }

interface TradeEvent {
  date: string;
  action: 'buy' | 'sell';
  nav: number;
  returnPct?: number;
}

interface StrategyResult {
  stopLossPct: number;
  takeProfitPct: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  trades: number;
  finalReturn: number;
  tradeEvents: TradeEvent[];
}

function compound(returns: number[]): number {
  if (returns.length === 0) return 0;
  return (returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;
}

function simulate(
  history: FundNavPoint[],
  stopLossPct: number,
  takeProfitPct: number
): StrategyResult {
  const empty = {
    stopLossPct, takeProfitPct, winRate: 0, avgReturn: 0,
    maxDrawdown: 0, trades: 0, finalReturn: 0, tradeEvents: [] as TradeEvent[],
  };
  if (history.length < 2) return empty;

  let position = 0;
  let buyNav = 0;
  const returns: number[] = [];
  let maxPeak = history[0].nav;
  let maxDrawdown = 0;
  let wins = 0;
  let trades = 0;
  const events: TradeEvent[] = [];

  for (const point of history) {
    const nav = point.nav;
    if (nav <= 0) continue;

    if (nav > maxPeak) maxPeak = nav;
    const dd = ((maxPeak - nav) / maxPeak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (position === 0) {
      position = 1;
      buyNav = nav;
      events.push({ date: point.date, action: 'buy', nav });
    } else {
      const returnPct = ((nav - buyNav) / buyNav) * 100;
      if (returnPct <= -stopLossPct || returnPct >= takeProfitPct) {
        returns.push(returnPct);
        trades++;
        if (returnPct > 0) wins++;
        events.push({ date: point.date, action: 'sell', nav, returnPct });
        // immediately re-enter
        position = 1;
        buyNav = nav;
        events.push({ date: point.date, action: 'buy', nav });
      }
    }
  }

  if (position === 1 && buyNav > 0) {
    const last = history[history.length - 1];
    const returnPct = ((last.nav - buyNav) / buyNav) * 100;
    returns.push(returnPct);
    trades++;
    if (returnPct > 0) wins++;
    events.push({ date: last.date, action: 'sell', nav: last.nav, returnPct });
  }

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  return {
    stopLossPct, takeProfitPct,
    winRate, avgReturn, maxDrawdown, trades,
    finalReturn: compound(returns),
    tradeEvents: events,
  };
}

export default function StrategySimulator({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StrategyResult[]>([]);
  const [history, setHistory] = useState<FundNavPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSim = async () => {
    if (!code.trim()) return;

    setError(null);
    setResults([]);
    setHistory([]);

    log.info(`[handleSim] 开始策略回测 code=${code}`);
    setLoading(true);

    try {
      const hist = await fetchFundHistoryNAV(code.trim(), 12, 300);
      log.info(`[handleSim] 获取到 ${hist.length} 条历史净值数据`);
      setHistory(hist);

      if (hist.length < 2) {
        setError('历史数据不足（少于2个交易日），无法进行策略回测。请检查基金代码是否正确');
        log.warn(`[handleSim] 数据不足 hist.length=${hist.length}`);
        setLoading(false);
        return;
      }

      const scenarios: StrategyResult[] = [];
      for (const sl of [3, 5, 8, 10]) {
        for (const tp of [5, 10, 15, 20, 30]) {
          scenarios.push(simulate(hist, sl, tp));
        }
      }

      log.info(`[handleSim] 完成 ${scenarios.length} 种策略组合的模拟`);

      // Log top 3 results
      const top3 = [...scenarios].sort((a, b) => b.finalReturn - a.finalReturn).slice(0, 3);
      top3.forEach((r, i) => {
        log.info(`[handleSim] Top${i+1}: SL${r.stopLossPct}%/TP${r.takeProfitPct}% finalReturn=${r.finalReturn.toFixed(2)}% winRate=${r.winRate.toFixed(1)}% trades=${r.trades}`);
      });

      setResults(scenarios);
    } catch (err) {
      log.error('[handleSim] 回测异常', err);
      setError('策略回测过程发生异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const barData = results
    .map((r) => ({
      name: `SL${r.stopLossPct}% TP${r.takeProfitPct}%`,
      finalReturn: r.finalReturn,
      winRate: r.winRate,
    }))
    .sort((a, b) => b.finalReturn - a.finalReturn)
    .slice(0, 15);

  const best = [...results].sort((a, b) => b.finalReturn - a.finalReturn)[0];

  // Build daily cycle chart data for best strategy
  const tradeDateSet = new Map<string, { action: 'buy' | 'sell'; returnPct?: number }>();
  best?.tradeEvents.forEach((e) => {
    if (e.action === 'sell') tradeDateSet.set(e.date, { action: 'sell', returnPct: e.returnPct });
    else if (!tradeDateSet.has(e.date)) tradeDateSet.set(e.date, { action: 'buy' });
  });
  const navChartData = history.map((p) => ({
    label: p.date.slice(5),
    nav: p.nav,
    trade: tradeDateSet.get(p.date)?.action || null,
    returnPct: tradeDateSet.get(p.date)?.returnPct ?? null,
  }));

  const buyPoints = navChartData.filter((d) => d.trade === 'buy');
  const sellPoints = navChartData.filter((d) => d.trade === 'sell');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>止盈/止损策略回测</h2>
        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>基金代码</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000001" />
            </div>
            <button className={styles.btnCalc} onClick={handleSim} disabled={loading}>
              {loading ? '回测中...' : '开始回测'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            将回测止盈(5-30%) x 止损(3-10%) 共20种组合
          </span>
        </div>

        {error && (
          <div style={{ color: '#e83929', fontSize: 13, margin: '12px 0', padding: '8px 12px', background: 'rgba(232,57,41,0.08)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {best && (
          <div className={styles.resultGrid}>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>最佳策略</div>
              <div className={styles.rValue}>SL{best.stopLossPct}% / TP{best.takeProfitPct}%</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>累计收益率</div>
              <div className={`${styles.rValue} ${best.finalReturn >= 0 ? styles.up : styles.down}`}>
                {best.finalReturn >= 0 ? '+' : ''}{best.finalReturn.toFixed(2)}%
              </div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>胜率</div>
              <div className={styles.rValue}>{best.winRate.toFixed(1)}%</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>最大回撤</div>
              <div className={`${styles.rValue} ${styles.down}`}>{best.maxDrawdown.toFixed(2)}%</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>交易次数</div>
              <div className={styles.rValue}>{best.trades}</div>
            </div>
          </div>
        )}

        {barData.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0 8px' }}>策略排名（累计收益）</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'var(--text)' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="finalReturn" name="累计收益%" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.finalReturn >= 0 ? '#e83929' : '#1ca051'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {best && history.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0 8px' }}>
              每日周期 — SL{best.stopLossPct}% / TP{best.takeProfitPct}%
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={navChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} domain={['auto', 'auto']} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => {
                    if (name === 'nav') return [Number(v).toFixed(4), '净值'];
                    if (name === 'buy') return [Number(v).toFixed(4), '买入'];
                    if (name === 'sell') return [Number(v).toFixed(4), '卖出'];
                    return [v, name];
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="nav" name="净值" stroke="#1a73e8" dot={false} strokeWidth={1.5} />
                <Scatter dataKey="nav" name="买入" fill="#1ca051" data={buyPoints} legendType="circle" />
                <Scatter dataKey="nav" name="卖出" fill="#e83929" data={sellPoints} legendType="circle" />
              </ComposedChart>
            </ResponsiveContainer>

            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-heavy)' }}>日期</th>
                    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-heavy)' }}>操作</th>
                    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-heavy)' }}>净值</th>
                    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-heavy)' }}>收益率</th>
                  </tr>
                </thead>
                <tbody>
                  {best.tradeEvents.map((e, i) => (
                    <tr key={i} style={{ color: 'var(--text)' }}>
                      <td style={{ padding: '3px 8px' }}>{e.date}</td>
                      <td style={{ padding: '3px 8px', color: e.action === 'buy' ? '#1ca051' : '#e83929' }}>
                        {e.action === 'buy' ? '买入' : '卖出'}
                      </td>
                      <td style={{ padding: '3px 8px' }}>{e.nav.toFixed(4)}</td>
                      <td style={{
                        padding: '3px 8px',
                        color: e.returnPct !== undefined ? (e.returnPct >= 0 ? '#e83929' : '#1ca051') : 'var(--text-muted)',
                      }}>
                        {e.returnPct !== undefined ? `${e.returnPct >= 0 ? '+' : ''}${e.returnPct.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
