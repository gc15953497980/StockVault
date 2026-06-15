import { useEffect, useMemo } from 'react';
import { useGoldStore } from '../store/useGoldStore';
import { goldUsdToCny } from '../utils/goldApi';
import { formatPercent } from '../utils/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import styles from './GoldCostView.module.css';

export default function GoldCostView() {
  const {
    goldPrice, goldPrevClose, goldChangePercent,
    usdCnyRate,
    aisc, setAisc,
    goldHistory,
    loading, error,
    refreshAll, fetchHistory,
  } = useGoldStore();

  // Load data on mount
  useEffect(() => {
    refreshAll();
    fetchHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goldPriceCNY = goldUsdToCny(goldPrice, usdCnyRate);
  const aiscCNY = goldUsdToCny(aisc, usdCnyRate);
  const spread = goldPrice > 0 ? goldPrice - aisc : 0;
  const spreadPercent = aisc > 0 ? (spread / aisc) * 100 : 0;

  // Chart data: merge history with AISC reference line
  const chartData = useMemo(() => {
    if (goldHistory.length === 0) return [];
    return goldHistory.map(p => ({
      date: p.date.slice(5), // MM-DD
      gold: p.close,
      aisc,
    }));
  }, [goldHistory, aisc]);

  const handleRefresh = () => {
    refreshAll();
    fetchHistory();
  };

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button
          className={styles.btnRefresh}
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新行情'}
        </button>

        <div className={styles.aiscControl}>
          <span className={styles.aiscLabel}>AISC 开采成本:</span>
          <input
            type="range"
            className={styles.aiscSlider}
            min={800}
            max={2500}
            step={10}
            value={aisc}
            onChange={e => setAisc(parseInt(e.target.value))}
          />
          <input
            type="number"
            className={styles.aiscInput}
            min={800}
            max={2500}
            step={10}
            value={aisc}
            onChange={e => setAisc(parseInt(e.target.value) || 1400)}
          />
          <span className={styles.aiscLabel}>$/oz</span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && <div className={styles.error}>{error}</div>}

      {/* ── Summary Cards ── */}
      {goldPrice > 0 && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>伦敦金 (USD)</div>
            <div className={styles.cardValue}>${goldPrice.toFixed(2)}</div>
            <div className={`${styles.cardSub} ${goldChangePercent >= 0 ? styles.up : styles.down}`}>
              {formatPercent(goldChangePercent)}
            </div>
            <div className={styles.cardSub}>昨收: ${goldPrevClose.toFixed(2)}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>伦敦金 (CNY)</div>
            <div className={styles.cardValue}>¥{goldPriceCNY.toFixed(2)}/g</div>
            <div className={styles.cardSub}>汇率: {usdCnyRate.toFixed(4)}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>AISC 开采成本</div>
            <div className={styles.cardValue}>${aisc}/oz</div>
            <div className={styles.cardSub}>≈ ¥{aiscCNY.toFixed(2)}/g</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>利润空间</div>
            <div className={`${styles.cardValue} ${spread >= 0 ? styles.up : styles.down}`}>
              ${spread.toFixed(1)}/oz
            </div>
            <div className={`${styles.cardSub} ${spread >= 0 ? styles.up : styles.down}`}>
              ¥{goldUsdToCny(spread, usdCnyRate).toFixed(2)}/g
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>利润率</div>
            <div className={`${styles.cardValue} ${spreadPercent >= 0 ? styles.up : styles.down}`}>
              {formatPercent(spreadPercent)}
            </div>
            <div className={styles.cardSub}>金价 / AISC</div>
          </div>
        </div>
      )}

      {/* ── Price Chart ── */}
      {chartData.length > 0 && (
        <div className={styles.chartBox}>
          <h3>黄金价格 vs 开采成本</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} domain={['auto', 'auto']} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => {
                  if (name === 'gold') return [`$${Number(v).toFixed(2)}/oz`, '黄金价格'];
                  if (name === 'aisc') return [`$${Number(v).toFixed(2)}/oz`, 'AISC成本'];
                  return [v, name];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gold"
                name="黄金价格"
                stroke="#f5b342"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="aisc"
                name="AISC成本"
                stroke="#e83929"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && goldPrice === 0 && !error && (
        <div className={styles.empty}>
          <p>暂无黄金行情数据</p>
          <p>点击"刷新行情"获取最新金价</p>
        </div>
      )}
    </div>
  );
}
