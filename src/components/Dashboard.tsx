import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { calcStock, calcFund, formatMoney, formatPercent } from '../utils/api';
import PnlCalendar from './PnlCalendar';
import styles from './Dashboard.module.css';

const PIE_COLORS = ['#1a73e8', '#e83929', '#1ca051'];

export default function Dashboard() {
  const stocks = useStockStore(s => s.stocks);
  const stockPrices = useStockStore(s => s.prices);
  const funds = useFundStore(s => s.funds);
  const fundNavs = useFundStore(s => s.navs);
  const fundChangePercents = useFundStore(s => s.dailyChangePercents);
  const history = useValueHistoryStore(s => s.history);

  const { totalValue, totalCost, totalPL, totalPLPct, stockValue, fundValue, topGainers, topLosers } = useMemo(() => {
    let totalValue = 0, totalCost = 0, stockValue = 0, fundValue = 0;
    const perf: { name: string; pl: number; plPct: number; dailyChange: number }[] = [];

    for (const s of stocks) {
      const cp = stockPrices[s.code] ?? 0;
      const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
      totalValue += calc.currentMarketValue;
      totalCost += calc.costTotal;
      stockValue += calc.currentMarketValue;
      perf.push({ name: s.name, pl: calc.profitLoss, plPct: calc.profitLossPercent, dailyChange: 0 });
    }

    for (const f of funds) {
      const nav = fundNavs[f.code] ?? 0;
      const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
      totalValue += calc.marketValue;
      totalCost += calc.costTotal;
      fundValue += calc.marketValue;
      perf.push({
        name: f.name || f.code,
        pl: calc.profitLoss,
        plPct: calc.profitLossPercent,
        dailyChange: fundChangePercents[f.code] ?? 0,
      });
    }

    const totalPL = totalValue - totalCost;
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    const sortedByDaily = [...perf].sort((a, b) => b.dailyChange - a.dailyChange);
    const topGainers = sortedByDaily.filter(p => p.dailyChange > 0).slice(0, 3);
    const topLosers = sortedByDaily.filter(p => p.dailyChange <= 0).sort((a, b) => a.dailyChange - b.dailyChange).slice(0, 3);

    return { totalValue, totalCost, totalPL, totalPLPct, stockValue, fundValue, topGainers, topLosers };
  }, [stocks, stockPrices, funds, fundNavs, fundChangePercents]);

  const totalTrend = useMemo(() => {
    return history.map(p => ({
      time: new Date(p.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      value: p.totalValue,
    }));
  }, [history]);

  const allocationData = [
    { name: '股票', value: stockValue },
    { name: '基金', value: fundValue },
  ].filter(d => d.value > 0);

  const hasData = stocks.length + funds.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>总资产</div>
          <div className={styles.cardValue}>{formatMoney(totalValue)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>总成本</div>
          <div className={styles.cardValue}>{formatMoney(totalCost)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>浮动盈亏</div>
          <div className={`${styles.cardValue} ${totalPL >= 0 ? styles.up : styles.down}`}>
            {formatMoney(totalPL)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>盈亏比例</div>
          <div className={`${styles.cardValue} ${totalPLPct >= 0 ? styles.up : styles.down}`}>
            {formatPercent(totalPLPct)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>持仓数量</div>
          <div className={styles.cardValue}>{stocks.length + funds.length}</div>
        </div>
      </div>

      {hasData && (
        <>
          <div className={styles.chartsRow}>
            {totalTrend.length >= 2 && (
              <div className={styles.chartBox}>
                <h3>总资产走势</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={totalTrend}>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={v => formatMoney(v as number)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={65} />
                    <Tooltip formatter={(v: any) => [formatMoney(Number(v ?? 0)), '总资产']} />
                    <Line type="monotone" dataKey="value" name="总资产" stroke="#1a73e8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {allocationData.length > 0 && (
              <div className={styles.chartBox}>
                <h3>资产配置</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                      const pct = ((percent ?? 0) * 100).toFixed(0);
                      const RADIAN = Math.PI / 180;
                      const sin = Math.sin(-RADIAN * (midAngle ?? 0));
                      const cos = Math.cos(-RADIAN * (midAngle ?? 0));
                      const sx = (cx ?? 0) + ((outerRadius ?? 90) + 0) * cos;
                      const sy = (cy ?? 0) + ((outerRadius ?? 90) + 0) * sin;
                      const tx = (cx ?? 0) + ((outerRadius ?? 90) + 30) * cos;
                      const ty = (cy ?? 0) + ((outerRadius ?? 90) + 30) * sin;
                      const textAnchor = cos >= 0 ? 'start' : 'end';
                      return (
                        <g>
                          <path d={`M${sx},${sy}L${tx},${ty}`} stroke="var(--text-muted)" fill="none" />
                          <text x={tx + (cos >= 0 ? 4 : -4)} y={ty - 5} textAnchor={textAnchor} fill="var(--text)" fontSize={12}>{name}</text>
                          <text x={tx + (cos >= 0 ? 4 : -4)} y={ty + 10} textAnchor={textAnchor} fill="var(--text-muted)" fontSize={11}>{pct}%</text>
                        </g>
                      );
                    }} labelLine={false}>
                      {allocationData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [formatMoney(Number(v ?? 0)), '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className={styles.chartsRow}>
            <div className={styles.perfBox}>
              <h4>今日涨幅 Top 3</h4>
              {topGainers.length > 0 ? topGainers.map((p, i) => (
                <div key={i} className={styles.perfRow}>
                  <span>{p.name}</span>
                  <span className={styles.up}>+{p.dailyChange.toFixed(2)}%</span>
                </div>
              )) : <div className={styles.empty}>暂无</div>}
            </div>
            <div className={styles.perfBox}>
              <h4>今日跌幅 Top 3</h4>
              {topLosers.length > 0 ? topLosers.map((p, i) => (
                <div key={i} className={styles.perfRow}>
                  <span>{p.name}</span>
                  <span className={styles.down}>{p.dailyChange.toFixed(2)}%</span>
                </div>
              )) : <div className={styles.empty}>暂无</div>}
            </div>
          </div>

          <PnlCalendar />
        </>
      )}

      {!hasData && (
        <div className={styles.emptyPage}>
          <p>还没有持仓数据</p>
          <p>点击上方"股票"或"基金"标签开始管理您的投资组合</p>
        </div>
      )}
    </div>
  );
}
