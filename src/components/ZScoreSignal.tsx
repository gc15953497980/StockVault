import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useWatchlistStore } from '../store/useWatchlistStore';
import { fetchStockKline } from '../utils/api';
import { generateSignal, type SignalResult } from '../utils/zscore';
import styles from './ZScoreSignal.module.css';

const CONCURRENCY = 1;
const BATCH_DELAY = 2000;
const FETCH_TIMEOUT = 15000;
const CACHE_KEY = 'stockvault_zscore_v3';
const CACHE_TTL = 4 * 3600_000;

interface CachedSignals {
  results: Record<string, SignalResult>;
  ts: number;
}

function loadCache(): Record<string, SignalResult> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const data: CachedSignals = JSON.parse(raw);
    if (Date.now() - data.ts < CACHE_TTL) return data.results;
  } catch { /* ignore */ }
  return {};
}

function saveCache(results: Record<string, SignalResult>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ results, ts: Date.now() }));
  } catch { /* ignore */ }
}

async function fetchWithRetry(code: string): Promise<ReturnType<typeof fetchStockKline>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT)
      );
      return await Promise.race([fetchStockKline(code, 'day', 200), timeout]);
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error('fetch failed after retry');
}

export default function ZScoreSignal() {
  const items = useWatchlistStore(s => s.items);
  const stocks = items.filter(i => i.type === 'stock' && i.market === 'a');

  const [signals, setSignals] = useState<Record<string, SignalResult>>(() => loadCache());
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [signalOnly, setSignalOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [computeLimit, setComputeLimit] = useState<number>(20);

  const filtered = filterText.trim()
    ? stocks.filter(s => s.code.includes(filterText.trim()) || s.name.includes(filterText.trim()))
    : stocks;
  const computeTargets = computeLimit > 0 ? filtered.slice(0, computeLimit) : filtered;

  const handleCompute = useCallback(async () => {
    if (computeTargets.length === 0) return;
    setComputing(true);
    setError(null);
    setProgress({ done: 0, total: computeTargets.length });

    const results: Record<string, SignalResult> = { ...signals };
    let failed = 0;

    for (let i = 0; i < computeTargets.length; i += CONCURRENCY) {
      const batch = computeTargets.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (s) => {
          try {
            const bars = await fetchWithRetry(s.code);
            const signal = generateSignal(bars);
            return { code: s.code, signal };
          } catch {
            return { code: s.code, signal: null, failed: true };
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          if ('failed' in r.value && r.value.failed) {
            failed++;
          } else if (r.value.signal) {
            results[r.value.code] = r.value.signal;
          }
        } else {
          failed++;
        }
      }

      flushSync(() => setSignals({ ...results }));
      setProgress({ done: Math.min(i + CONCURRENCY, computeTargets.length), total: computeTargets.length });

      if (i + CONCURRENCY < computeTargets.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    if (failed > 0) {
      setError(`${failed} 只股票请求超时/失败（可稍后重试）`);
    }
    saveCache(results);
    setComputing(false);
  }, [computeTargets, signals]);

  // All computed entries, sorted
  const entries = Object.entries(signals).sort((a, b) => {
    if (a[1].direction !== b[1].direction) {
      return a[1].direction === 'sell' ? -1 : a[1].direction === 'buy' ? 1 : 2;
    }
    return a[1].zScore20 - b[1].zScore20;
  });

  const visible = signalOnly ? entries.filter(([, s]) => s.direction !== 'none') : entries;
  const signalCount = entries.filter(([, s]) => s.direction !== 'none').length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={handleCompute} disabled={computing}>
          {computing ? '计算中...' : '计算信号'}
        </button>
        {computing && (
          <button className={styles.btnCancel} onClick={() => setComputing(false)}>取消</button>
        )}
        <span className={styles.count}>
          共 {stocks.length} 只 · 计算 {computeTargets.length} 只 · 已算 {entries.length} 只{signalCount > 0 ? ` · ${signalCount} 个信号` : ''}
        </span>
      </div>

      {computing && (
        <>
          <div className={styles.progressText}>
            正在分析 {progress.done}/{progress.total}（{pct}%）
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {error && <div style={{ color: 'var(--down)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {stocks.length > 0 && (
        <div className={styles.filterRow}>
          <input
            className={styles.filterInput}
            placeholder="筛选代码/名称..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
          {[20, 50, 100, 0].map(n => (
            <button
              key={n}
              className={`${styles.limitBtn} ${(n === 0 ? computeLimit === 0 : computeLimit === n) ? styles.limitBtnActive : ''}`}
              onClick={() => setComputeLimit(n)}
            >
              {n === 0 ? '全部' : `前${n}`}
            </button>
          ))}
          <span className={styles.hint}>
            {filterText ? `匹配 ${filtered.length} 只，` : ''}计算前 {computeLimit > 0 ? Math.min(computeLimit, filtered.length) : filtered.length} 只
          </span>
        </div>
      )}

      {entries.length > 0 && (
        <div className={styles.filterBar}>
          <label>
            <input
              type="checkbox"
              checked={signalOnly}
              onChange={e => setSignalOnly(e.target.checked)}
            />
            仅看有信号
          </label>
          <span className={styles.count}>
            显示 {visible.length}/{entries.length} 只
          </span>
        </div>
      )}

      {stocks.length === 0 ? (
        <div className={styles.empty}>关注列表中没有股票，请先在"关注"中添加</div>
      ) : entries.length === 0 && !computing ? (
        <div className={styles.empty}>点击"计算信号"开始分析</div>
      ) : visible.length === 0 && !computing ? (
        <div className={styles.empty}>当前无符合条件的交易信号</div>
      ) : visible.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>最新价</th>
              <th>Z20</th>
              <th>Z120</th>
              <th>方向</th>
              <th>建议</th>
              <th>诊断</th>
              <th>成交额(亿)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(([code, s]) => {
              const stock = stocks.find(x => x.code === code);
              const name = stock?.name || code;
              const turnoverYi = s.avgTurnover / 1e8;

              const z20Cls = s.direction === 'buy' ? styles.buy : s.direction === 'sell' ? styles.sell : '';
              const dirCls = s.direction === 'buy' ? styles.buy : s.direction === 'sell' ? styles.sell : '';

              return (
                <tr key={code}>
                  <td>{code}</td>
                  <td>{name}</td>
                  <td>{s.latestClose.toFixed(2)}</td>
                  <td className={z20Cls}>
                    {(s.zScore20 >= 0 ? '+' : '') + s.zScore20.toFixed(2)}
                  </td>
                  <td className={s.trendOk ? styles.buy : ''}>
                    {(s.zScore120 >= 0 ? '+' : '') + s.zScore120.toFixed(2)}
                  </td>
                  <td className={dirCls}>
                    {s.direction === 'buy' ? '买入' : s.direction === 'sell' ? '卖出' : '-'}
                  </td>
                  <td>{s.suggestion || '-'}</td>
                  <td className={s.direction !== 'none' ? '' : styles.warn}>
                    {s.diagnostic}
                  </td>
                  <td>{turnoverYi.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
