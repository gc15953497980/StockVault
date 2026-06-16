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

interface RatioRange {
  label: string;
  min: number;
  max: number;
  market: string;
  strategy: string;
  history: string;
}

const RATIO_RANGES: RatioRange[] = [
  {
    label: '< 1.4',
    min: 0, max: 1.4,
    market: '全行业步入寒冬，矿商大面积亏损或仅勉强保本',
    strategy: '左侧战略性长线埋伏（注：本轮牛市周期内未曾出现）',
    history: '—',
  },
  {
    label: '1.4 – 1.6',
    min: 1.4, max: 1.7,
    market: '行业健康复苏，估值低洼。矿商每盎司净赚 $700+，利润率极佳，股价具有极高安全垫',
    strategy: '最佳核心买入区（强烈买入）— 长线建仓、定投或重仓的黄金时机',
    history: '2025年Q1（金价 ~$2,600，AISC ~$1,650）',
  },
  {
    label: '1.7 – 2.1',
    min: 1.7, max: 2.2,
    market: '剪刀差扩大，利润暴增。金价涨幅远超成本，经营杠杆全面爆发，基本面强烈支撑',
    strategy: '右侧追随加仓区 — 顺势而为，对优质 Tier 1 矿企股进行加仓',
    history: '2025年下半年（金价冲破 ~$3,200）',
  },
  {
    label: '2.2 – 2.6',
    min: 2.2, max: 2.7,
    market: '高位震荡，利润夯实。每盎司净利润达 $2,000+。虽非绝对低点，但行业估值正被高利润被动消化',
    strategy: '持有，停止追高 / 逢低分批吸纳 — 当前可视为大跌后的价值重估观望区',
    history: '当前时点 2026.6.15（金价 $4,338，AISC ~$1,700，比率 2.55）',
  },
  {
    label: '2.7 – 2.9',
    min: 2.7, max: 3.0,
    market: '情绪过热，估值高企。市场对金价预期过于乐观，矿企股价透支未来数年业绩',
    strategy: '持有观望，停止任何买入 — 开始提高警惕，逐步制定止盈计划',
    history: '2026年1月上旬（金价向 $5,000 冲刺）',
  },
  {
    label: '≥ 3.0',
    min: 3.0, max: Infinity,
    market: '极度疯狂，行业暴利不可持续。比率突破 3.0 意味着毛利率超 66%（每盎司净赚 $3,500+），历史罕见',
    strategy: '绝对禁止买入，执行分批止盈 — 坚定执行纪律，逢高将金矿股分批换回黄金现货或现金',
    history: '2026.1.28 前后（金价触及历史高点 $5,589，比率 3.2）',
  },
];

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
  const aiscRatio = aisc > 0 ? goldPrice / aisc : 0;

  // Chart data: merge history with AISC reference line
  const chartData = useMemo(() => {
    if (goldHistory.length === 0) return [];
    return goldHistory.map(p => ({
      date: p.date.slice(5), // MM-DD
      gold: p.close,
      aisc,
    }));
  }, [goldHistory, aisc]);

  // Volatility-based valuation range (1-year lookback, 1σ band)
  const valuationRange = useMemo(() => {
    if (goldHistory.length < 30) return null;
    const closes = goldHistory.map(p => p.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const annualVol = dailyVol * Math.sqrt(252);
    const upper = goldPrice * (1 + annualVol);
    const lower = goldPrice * (1 - annualVol);
    return { upper, lower, annualVol };
  }, [goldHistory, goldPrice]);

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
            <div className={styles.cardLabel}>金价 / AISC</div>
            <div className={styles.cardValue}>
              {aiscRatio.toFixed(2)}
            </div>
            <div className={styles.cardSub}>利润空间 ${spread.toFixed(1)}/oz</div>
          </div>

          {valuationRange && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>波动率估值区间 (1σ)</div>
              <div className={styles.cardValue}>
                ${valuationRange.lower.toFixed(0)} – ${valuationRange.upper.toFixed(0)}
              </div>
              <div className={styles.cardSub}>
                年化波动率 {(valuationRange.annualVol * 100).toFixed(1)}%
              </div>
            </div>
          )}
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

      {/* ── Ratio Analysis ── */}
      {goldPrice > 0 && aisc > 0 && (
        <div className={`${styles.chartBox} ${styles.ratioSection}`}>
          <h3 className={styles.ratioTitle}>金价/AISC 比率分析</h3>
          <table className={styles.ratioTable}>
            <thead>
              <tr>
                <th>比率区间</th>
                <th>市场含义</th>
                <th>对应操作策略</th>
                <th>历史参考区间<br />(2025.01 – 2026.06)</th>
              </tr>
            </thead>
            <tbody>
              {RATIO_RANGES.map((row, i) => {
                const isActive = aiscRatio >= row.min && aiscRatio < row.max;
                const rowClass = [
                  styles.ratioRow,
                  isActive ? styles.activeRow : '',
                  isActive ? styles[`tier${i}`] : '',
                ].filter(Boolean).join(' ');
                return (
                  <tr key={i} className={rowClass}>
                    <td>{row.label}</td>
                    <td>{row.market}</td>
                    <td>{row.strategy}</td>
                    <td>{row.history}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
