import { useState, useCallback, useEffect } from 'react';
import { useFundStore } from '../store/useFundStore';
import { fetchFundHistoryNAV } from '../utils/api';
import {
  analyzePositionSignal,
  backtestStrategies,
  HOLD_LABELS,
  STRATEGY_LABELS,
  type PositionSignalResult,
  type BacktestResult,
} from '../utils/positionSignal';
import styles from './PositionSignal.module.css';

type SortKey = 'name' | 'stdDev' | 'avgDrop' | 'avgRise' | 'latestPct' | 'addThreshold' | 'reduceThreshold';

export default function PositionSignal() {
  const funds = useFundStore(s => s.funds);

  const [results, setResults] = useState<Map<string, PositionSignalResult>>(new Map());
  const [backtests, setBacktests] = useState<Map<string, BacktestResult>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('stdDev');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(new Map());
    setBacktests(new Map());
    setExpanded(null);

    const newResults = new Map<string, PositionSignalResult>();

    for (let i = 0; i < funds.length; i++) {
      const f = funds[i];
      setProgress(`${i + 1}/${funds.length}`);
      try {
        const history = await fetchFundHistoryNAV(f.code, 6);
        const result = analyzePositionSignal(history, f.name);
        newResults.set(f.code, result);
        setResults(new Map(newResults));
      } catch {
        newResults.set(f.code, {
          name: f.name, avgDrop: 0, avgRise: 0, stdDev: 0,
          addThreshold: 0, reduceThreshold: 0, latestPct: 0,
          addSignal: false, reduceSignal: false,
          statStart: '', statEnd: '', dataPoints: 0,
          error: '数据获取失败',
        });
        setResults(new Map(newResults));
      }
    }

    setProgress('');
    setLoading(false);
  }, [funds]);

  // Auto-run on mount
  useEffect(() => {
    if (funds.length > 0) runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClick = useCallback(async (code: string) => {
    if (expanded === code) {
      setExpanded(null);
      return;
    }
    setExpanded(code);

    if (backtests.has(code)) return;

    try {
      const history = await fetchFundHistoryNAV(code, 24);
      const bt = backtestStrategies(history);
      setBacktests(prev => new Map(prev).set(code, bt));
    } catch {
      setBacktests(prev => new Map(prev).set(code, { dataPoints: 0, drop: {}, std: {}, error: '回测失败' }));
    }
  }, [expanded, backtests]);

  // Sort results
  const sorted = [...results.entries()]
    .sort(([, a], [, b]) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (sortBy === 'name') return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortBy !== key) return '';
    return sortDir === 'asc' ? styles.sortAsc : styles.sortDesc;
  };

  // Count signals
  let addCount = 0;
  let reduceCount = 0;
  results.forEach(r => {
    if (r.addSignal) addCount++;
    if (r.reduceSignal) reduceCount++;
  });

  if (funds.length === 0) {
    return (
      <div className={styles.empty}>
        <p>暂无基金数据</p>
        <p>请先在持仓管理中添加基金</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button className={styles.btnRefresh} onClick={runAnalysis} disabled={loading}>
          {loading ? '分析中...' : '刷新分析'}
        </button>
        {progress && <span className={styles.progress}>{progress}</span>}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Summary Cards ── */}
      {results.size > 0 && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>分析基金</div>
            <div className={styles.cardValue}>{results.size}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>加仓信号</div>
            <div className={`${styles.cardValue} ${styles.signalAdd}`}>{addCount}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>减仓信号</div>
            <div className={`${styles.cardValue} ${styles.signalReduce}`}>{reduceCount}</div>
          </div>
        </div>
      )}

      {/* ── Fund Table ── */}
      {sorted.length > 0 && (
        <div className={styles.tableBox}>
          <h3>仓位信号分析（近6月）</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={sortIndicator('name')} onClick={() => handleSort('name')}>名称</th>
                <th className={sortIndicator('latestPct')} onClick={() => handleSort('latestPct')}>最新涨跌</th>
                <th className={sortIndicator('stdDev')} onClick={() => handleSort('stdDev')}>标准差</th>
                <th className={sortIndicator('avgDrop')} onClick={() => handleSort('avgDrop')}>均跌幅</th>
                <th className={sortIndicator('avgRise')} onClick={() => handleSort('avgRise')}>均涨幅</th>
                <th className={sortIndicator('addThreshold')} onClick={() => handleSort('addThreshold')}>加仓线</th>
                <th className={sortIndicator('reduceThreshold')} onClick={() => handleSort('reduceThreshold')}>减仓线</th>
                <th>信号</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([code, r]) => (
                <>
                  <tr key={code} onClick={() => handleRowClick(code)}>
                    <td>{r.name || code}</td>
                    <td className={r.latestPct >= 0 ? styles.signalAdd : styles.signalReduce}>
                      {fmtPct(r.latestPct)}
                    </td>
                    <td>{r.stdDev > 0 ? `${r.stdDev}%` : '-'}</td>
                    <td>{r.avgDrop < 0 ? `${r.avgDrop}%` : '-'}</td>
                    <td>{r.avgRise > 0 ? `${r.avgRise}%` : '-'}</td>
                    <td>{r.addThreshold < 0 ? `${r.addThreshold}%` : '-'}</td>
                    <td>{r.reduceThreshold > 0 ? `${r.reduceThreshold}%` : '-'}</td>
                    <td>
                      {r.addSignal && <span className={styles.signalAdd}>★ 加仓</span>}
                      {r.reduceSignal && <span className={styles.signalReduce}>★ 减仓</span>}
                      {!r.addSignal && !r.reduceSignal && (r.error ? <span style={{color:'var(--text-muted)'}}>{r.error}</span> : '-')}
                    </td>
                  </tr>
                  {expanded === code && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={8}>
                        <BacktestPanel code={code} name={r.name} bt={backtests.get(code)} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && results.size === 0 && (
        <div className={styles.loading}>正在分析基金数据...</div>
      )}
    </div>
  );
}

// ─── Backtest Sub-Panel ───

function BacktestPanel({ code, name, bt }: { code: string; name: string; bt?: BacktestResult }) {
  if (!bt) {
    return <div className={styles.btBox} style={{color:'var(--text-muted)',padding:'20px'}}>加载回测中...</div>;
  }

  if (bt.error) {
    return <div className={styles.btBox} style={{color:'var(--text-muted)'}}>{bt.error}</div>;
  }

  return (
    <div className={styles.btBox}>
      <h4>{name}（{code}）— 回测对比（近2年，滚动6月窗口）</h4>
      <table className={styles.btTable}>
        <thead>
          <tr>
            <th>持有</th>
            <th>策略</th>
            <th>信号数</th>
            <th>胜率</th>
            <th>均收益</th>
            <th>中位收益</th>
            <th>最差</th>
          </tr>
        </thead>
        <tbody>
          {[5, 10, 20].map(hold => (
            <>
              <tr key={`${hold}-drop`}>
                <td>{HOLD_LABELS[hold]}</td>
                <td className={styles.stratDrop}>{STRATEGY_LABELS.drop}</td>
                <td>{bt.drop[hold]?.signals ?? 0}</td>
                <td>{bt.drop[hold]?.winRate ?? 0}%</td>
                <td className={((bt.drop[hold]?.avgRet ?? 0) >= 0) ? styles.signalAdd : styles.signalReduce}>
                  {fmtPct(bt.drop[hold]?.avgRet ?? 0)}
                </td>
                <td className={((bt.drop[hold]?.medRet ?? 0) >= 0) ? styles.signalAdd : styles.signalReduce}>
                  {fmtPct(bt.drop[hold]?.medRet ?? 0)}
                </td>
                <td className={styles.signalReduce}>{fmtPct(bt.drop[hold]?.worst ?? 0)}</td>
              </tr>
              <tr key={`${hold}-std`}>
                <td></td>
                <td className={styles.stratStd}>{STRATEGY_LABELS.std}</td>
                <td>{bt.std[hold]?.signals ?? 0}</td>
                <td>{bt.std[hold]?.winRate ?? 0}%</td>
                <td className={((bt.std[hold]?.avgRet ?? 0) >= 0) ? styles.signalAdd : styles.signalReduce}>
                  {fmtPct(bt.std[hold]?.avgRet ?? 0)}
                </td>
                <td className={((bt.std[hold]?.medRet ?? 0) >= 0) ? styles.signalAdd : styles.signalReduce}>
                  {fmtPct(bt.std[hold]?.medRet ?? 0)}
                </td>
                <td className={styles.signalReduce}>{fmtPct(bt.std[hold]?.worst ?? 0)}</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>
      <div style={{fontSize: 11, color: 'var(--text-muted)'}}>
        数据点: {bt.dataPoints} | 策略说明：均值跌幅×2.0 / 标准差×1.3 触发买入信号
      </div>
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
