import React, { useState, useCallback, useEffect } from 'react';
import { useFundStore } from '../store/useFundStore';
import { useStockStore } from '../store/useStockStore';
import { fetchFundHistoryNAV, fetchETFNavHistory, fetchFundRedemptionFee } from '../utils/api';
import type { Stock } from '../types';
import {
  analyzePositionSignal,
  backtestStrategies,
  getHoldLabel,
  getZeroFeeDays,
  STRATEGY_LABELS,
  type PositionSignalResult,
  type BacktestResult,
} from '../utils/positionSignal';
import styles from './PositionSignal.module.css';

type SortKey = 'kind' | 'name' | 'stdDev' | 'avgDrop' | 'avgRise' | 'latestPct' | 'addThreshold' | 'reduceThreshold' | 'redemptionFee';

interface AnalysisItem {
  kind: '基金' | 'ETF/股票';
  code: string;
  name: string;
  result: PositionSignalResult;
  redemptionFee?: string;
}

export default function PositionSignal() {
  const funds = useFundStore(s => s.funds);
  const stocks = useStockStore(s => s.stocks);

  // Only A-share stocks (skip HK/US which use different APIs)
  const aStocks: Stock[] = stocks.filter(s => !s.market || s.market === 'sh' || s.market === 'sz' || s.market === 'bj');

  const [items, setItems] = useState<AnalysisItem[]>([]);
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
    setItems([]);
    setBacktests(new Map());
    setExpanded(null);

    const rawEntries: { kind: '基金' | 'ETF/股票'; code: string; name: string }[] = [
      ...funds.map(f => ({ kind: '基金' as const, code: f.code, name: f.name })),
      ...aStocks.map(s => ({ kind: 'ETF/股票' as const, code: s.code, name: s.name })),
    ];

    // Deduplicate by code (keep first occurrence — funds take priority)
    const seen = new Set<string>();
    const entries = rawEntries.filter(e => {
      if (seen.has(e.code)) return false;
      seen.add(e.code);
      return true;
    });

    if (entries.length === 0) {
      setLoading(false);
      return;
    }

    const newItems: AnalysisItem[] = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      setProgress(`${i + 1}/${entries.length}`);

      const emptyResult: PositionSignalResult = {
        name: e.name, avgDrop: 0, avgRise: 0, stdDev: 0,
        addThreshold: 0, reduceThreshold: 0, latestPct: 0,
        addSignal: false, reduceSignal: false,
        statStart: '', statEnd: '', dataPoints: 0,
      };

      try {
        const history = e.kind === '基金'
          ? await fetchFundHistoryNAV(e.code, 6)
          : await fetchETFNavHistory(e.code, 6);

        if (history.length === 0) {
          newItems.push({ ...e, result: { ...emptyResult, error: '无历史数据' } });
        } else {
          const result = analyzePositionSignal(history, e.name);
          let redemptionFee: string | undefined;
          if (e.kind === '基金') {
            redemptionFee = await fetchFundRedemptionFee(e.code);
            result.redemptionFee = redemptionFee;
          }
          newItems.push({ ...e, result, redemptionFee });
        }
      } catch {
        newItems.push({ ...e, result: { ...emptyResult, error: '数据获取失败' } });
      }
      setItems([...newItems]);
    }

    setProgress('');
    setLoading(false);
  }, [funds, aStocks]);

  // Auto-run on mount
  useEffect(() => {
    if (funds.length > 0 || aStocks.length > 0) runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClick = useCallback(async (kind: string, code: string, redemptionFee?: string) => {
    const key = `${kind}:${code}`;
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);

    if (backtests.has(key)) return;

    // Compute hold days: for funds use 0-fee threshold, for ETFs use defaults
    const zeroDays = kind === '基金' ? getZeroFeeDays(redemptionFee) : 0;
    const holdDays = zeroDays > 0 ? [zeroDays] : [5, 10, 20];

    try {
      const history = kind === '基金'
        ? await fetchFundHistoryNAV(code, 24)
        : await fetchETFNavHistory(code, 24);
      const bt = backtestStrategies(history, holdDays);
      setBacktests(prev => new Map(prev).set(key, bt));
    } catch {
      setBacktests(prev => new Map(prev).set(key, { dataPoints: 0, holdDays: [], drop: {}, std: {}, error: '回测失败' }));
    }
  }, [expanded, backtests]);

  // Sort items
  const sorted = [...items].sort((a, b) => {
    const va = getSortValue(a, sortBy);
    const vb = getSortValue(b, sortBy);
    if (sortBy === 'kind' || sortBy === 'name' || sortBy === 'redemptionFee') {
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }
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

  let addCount = 0;
  let reduceCount = 0;
  items.forEach(r => {
    if (r.result.addSignal) addCount++;
    if (r.result.reduceSignal) reduceCount++;
  });

  const totalCount = funds.length + aStocks.length;

  if (totalCount === 0) {
    return (
      <div className={styles.empty}>
        <p>暂无基金或ETF数据</p>
        <p>请先在持仓管理中添加基金或A股ETF</p>
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
        {!loading && items.length > 0 && (
          <span className={styles.progress}>基金 {funds.length} · ETF {aStocks.length}</span>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Summary Cards ── */}
      {items.length > 0 && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>分析标的</div>
            <div className={styles.cardValue}>{items.length}</div>
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

      {/* ── Table ── */}
      {sorted.length > 0 && (
        <div className={styles.tableBox}>
          <h3>仓位信号分析（近6月）</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={sortIndicator('kind')} onClick={() => handleSort('kind')}>类型</th>
                <th className={sortIndicator('name')} onClick={() => handleSort('name')}>名称</th>
                <th className={sortIndicator('latestPct')} onClick={() => handleSort('latestPct')}>最新涨跌</th>
                <th className={sortIndicator('stdDev')} onClick={() => handleSort('stdDev')}>标准差</th>
                <th className={sortIndicator('avgDrop')} onClick={() => handleSort('avgDrop')}>均跌幅</th>
                <th className={sortIndicator('avgRise')} onClick={() => handleSort('avgRise')}>均涨幅</th>
                <th className={sortIndicator('addThreshold')} onClick={() => handleSort('addThreshold')}>加仓线</th>
                <th className={sortIndicator('reduceThreshold')} onClick={() => handleSort('reduceThreshold')}>减仓线</th>
                <th className={sortIndicator('redemptionFee')} onClick={() => handleSort('redemptionFee')}>赎回费率</th>
                <th>信号</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ kind, code, name, result: r }) => {
                const key = `${kind}:${code}`;
                return (
                  <React.Fragment key={key}>
                    <tr onClick={() => handleRowClick(kind, code, r.redemptionFee)}>
                      <td style={{color: 'var(--text-muted)', fontSize: 12}}>{kind}</td>
                      <td>{r.name || name || code}</td>
                      <td className={r.latestPct >= 0 ? styles.signalAdd : styles.signalReduce}>
                        {fmtPct(r.latestPct)}
                      </td>
                      <td>{r.stdDev > 0 ? `${r.stdDev}%` : '-'}</td>
                      <td>{r.avgDrop < 0 ? `${r.avgDrop}%` : '-'}</td>
                      <td>{r.avgRise > 0 ? `${r.avgRise}%` : '-'}</td>
                      <td>{r.addThreshold < 0 ? `${r.addThreshold}%` : '-'}</td>
                      <td>{r.reduceThreshold > 0 ? `${r.reduceThreshold}%` : '-'}</td>
                      <td style={{fontSize: 11}}>{r.redemptionFee || (kind === '基金' ? '获取中...' : '-')}</td>
                      <td>
                        {r.addSignal && <span className={styles.signalAdd}>★ 加仓</span>}
                        {r.reduceSignal && <span className={styles.signalReduce}>★ 减仓</span>}
                        {!r.addSignal && !r.reduceSignal && (r.error ? <span style={{color:'var(--text-muted)'}}>{r.error}</span> : '-')}
                      </td>
                    </tr>
                    {expanded === key && (
                      <tr className={styles.expandedRow}>
                        <td colSpan={10}>
                          <BacktestPanel code={code} name={r.name} bt={backtests.get(key)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className={styles.loading}>正在分析数据...</div>
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

  const days = [...(bt.holdDays || [5, 10, 20])].sort((a, b) => a - b);

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
          {days.map(hold => (
            <React.Fragment key={hold}>
              <tr>
                <td>{getHoldLabel(hold)}</td>
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
              <tr>
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
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{fontSize: 11, color: 'var(--text-muted)'}}>
        数据点: {bt.dataPoints} | 策略说明：均值跌幅×2.0 / 标准差×1.3 触发买入信号
      </div>
    </div>
  );
}

function getSortValue(item: AnalysisItem, key: SortKey): string | number {
  switch (key) {
    case 'kind': return item.kind;
    case 'name': return item.result.name || item.name;
    case 'redemptionFee': return item.redemptionFee || '';
    default: return item.result[key] ?? 0;
  }
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
