import { useMemo } from 'react';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { calcStock, calcFund } from '../utils/api';
import styles from './ConcentrationPanel.module.css';

const ETF_SECTOR_KEYWORDS: [string, string[]][] = [
  ['中证A500', ['a500', '沪深300', '优选300', '中证全指', '消费龙头', '主要消费', '消费50', '家用电器']],
  ['红利', ['红利', '股息', '自由现金流']],
  ['双创', ['科创', '创业', '双创', '医药', '医疗', '生物科技']],
  ['恒科', ['恒生科技', '恒科', '港股通科技']],
  ['中证500', ['中证500']],
  ['白酒', ['白酒']],
  ['黄金', ['黄金']],
  ['港消费', ['港股消费', '恒生消费', '港消费', '沪港深消费']],
];

function classifyEtf(name: string): string {
  const lower = name.toLowerCase();
  for (const [sector, keywords] of ETF_SECTOR_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return sector;
    }
  }
  return '其他ETF';
}

export default function ConcentrationPanel() {
  const stocks = useStockStore(s => s.stocks);
  const stockPrices = useStockStore(s => s.prices);
  const funds = useFundStore(s => s.funds);
  const fundNavs = useFundStore(s => s.navs);

  const { topHoldings, sectorConcentration } = useMemo(() => {
    let totalValue = 0;
    const items: { name: string; value: number; pct: number }[] = [];

    for (const s of stocks) {
      const cp = stockPrices[s.code] ?? 0;
      const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
      totalValue += calc.currentMarketValue;
      items.push({ name: s.name, value: calc.currentMarketValue, pct: 0 });
    }

    for (const f of funds) {
      const nav = fundNavs[f.code] ?? 0;
      const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
      totalValue += calc.marketValue;
      items.push({ name: f.name || f.code, value: calc.marketValue, pct: 0 });
    }

    // Calc percentages
    for (const item of items) {
      item.pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    }

    const topHoldings = items.sort((a, b) => b.pct - a.pct).slice(0, 5);

    // Sector concentration for funds and ETFs
    const sectorMap: Record<string, number> = {};
    for (const f of funds) {
      const nav = fundNavs[f.code] ?? 0;
      const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
      const sector = f.sector || '未分类';
      sectorMap[sector] = (sectorMap[sector] || 0) + calc.marketValue;
    }
    // Include ETFs classified by name keywords
    for (const s of stocks) {
      if (s.type !== 'etf') continue;
      const cp = stockPrices[s.code] ?? 0;
      const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
      const sector = classifyEtf(s.name);
      sectorMap[sector] = (sectorMap[sector] || 0) + calc.currentMarketValue;
    }
    const sectorConcentration = Object.entries(sectorMap)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);

    return { topHoldings, sectorConcentration, totalValue };
  }, [stocks, stockPrices, funds, fundNavs]);

  const maxSinglePct = topHoldings[0]?.pct ?? 0;
  const maxSectorPct = sectorConcentration[0]?.pct ?? 0;

  if (stocks.length + funds.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>集中度分析</h3>

      <div className={styles.warning}>
        {maxSinglePct > 30 && <span className={styles.warnTag}>单只重仓 {maxSinglePct.toFixed(0)}%</span>}
        {maxSectorPct > 50 && <span className={styles.warnTag}>行业集中 {maxSectorPct.toFixed(0)}%</span>}
        {maxSinglePct <= 30 && maxSectorPct <= 50 && <span className={styles.okTag}>分散度良好</span>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>前5大重仓</div>
        {topHoldings.map((h, i) => (
          <div key={i} className={styles.bar}>
            <span className={styles.barLabel} title={h.name}>{h.name}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${Math.min(h.pct, 100)}%`, background: h.pct > 30 ? 'var(--warn)' : 'var(--primary)' }} />
            </div>
            <span className={styles.barPct}>{h.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {sectorConcentration.length > 1 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>行业分布</div>
          {sectorConcentration.map((s, i) => (
            <div key={i} className={styles.bar}>
              <span className={styles.barLabel} title={s.name}>{s.name}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${Math.min(s.pct, 100)}%`, background: s.pct > 50 ? 'var(--warn)' : 'var(--primary)' }} />
              </div>
              <span className={styles.barPct}>{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
