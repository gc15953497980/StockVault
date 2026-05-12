import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { fetchFundHistoryNAV } from '../utils/api';
import type { FundNavPoint } from '../types';
import styles from './DcaCalculator.module.css';

interface Props { onClose: () => void }
interface StrategyResult {
  stopLossPct: number;
  takeProfitPct: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  trades: number;
  finalReturn: number;
}

function simulate(
  history: FundNavPoint[],
  stopLossPct: number,
  takeProfitPct: number
): StrategyResult {
  if (history.length < 2) return { stopLossPct, takeProfitPct, winRate: 0, avgReturn: 0, maxDrawdown: 0, trades: 0, finalReturn: 0 };

  let position = 0; // 0 = no position, 1 = in position
  let buyNav = 0;
  let returns: number[] = [];
  let maxPeak = history[0].nav;
  let maxDrawdown = 0;
  let wins = 0;
  let trades = 0;

  for (const point of history) {
    const nav = point.nav;
    if (nav <= 0) continue;

    // Track max drawdown
    if (nav > maxPeak) maxPeak = nav;
    const dd = (maxPeak - nav) / maxPeak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (position === 0) {
      // Buy at start
      position = 1;
      buyNav = nav;
    } else {
      const returnPct = (nav - buyNav) / buyNav * 100;
      if (returnPct <= -stopLossPct || returnPct >= takeProfitPct) {
        returns.push(returnPct);
        trades++;
        if (returnPct > 0) wins++;
        position = 0; // Close position
        // Immediately open next
        position = 1;
        buyNav = nav;
      }
    }
  }

  // Close any open position at end
  if (position === 1 && buyNav > 0) {
    const finalNav = history[history.length - 1].nav;
    const returnPct = (finalNav - buyNav) / buyNav * 100;
    returns.push(returnPct);
    trades++;
    if (returnPct > 0) wins++;
  }

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const finalReturn = returns.reduce((a, b) => a + b, 0);

  return { stopLossPct, takeProfitPct, winRate, avgReturn, maxDrawdown, trades, finalReturn };
}

export default function StrategySimulator({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StrategyResult[]>([]);

  const handleSim = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const history = await fetchFundHistoryNAV(code.trim(), 12, 300);
    if (history.length < 2) { setLoading(false); return; }

    const scenarios: StrategyResult[] = [];
    for (const sl of [3, 5, 8, 10]) {
      for (const tp of [5, 10, 15, 20, 30]) {
        scenarios.push(simulate(history, sl, tp));
      }
    }
    setResults(scenarios);
    setLoading(false);
  };

  const chartData = results.map(r => ({
    name: `SL${r.stopLossPct}% TP${r.takeProfitPct}%`,
    finalReturn: r.finalReturn,
    winRate: r.winRate,
  })).sort((a, b) => b.finalReturn - a.finalReturn).slice(0, 15);

  const best = results.sort((a, b) => b.finalReturn - a.finalReturn)[0];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>止盈/止损策略回测</h2>
        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>基金代码</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="000001" />
            </div>
            <button className={styles.btnCalc} onClick={handleSim} disabled={loading}>
              {loading ? '回测中...' : '开始回测'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            将回测止盈(5-30%) x 止损(3-10%) 共20种组合
          </span>
        </div>

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
          </div>
        )}

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'var(--text)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="finalReturn" name="累计收益%" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.finalReturn >= 0 ? '#e83929' : '#1ca051'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
