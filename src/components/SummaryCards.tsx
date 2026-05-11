import { calcStock, formatMoney, formatPercent } from '../utils/api';
import styles from './SummaryCards.module.css';

interface Props {
  stocks: Array<{
    code: string;
    holdingCost: number;
    shares: number;
    targetPrice: number;
    targetMarketValue: number;
  }>;
  prices: Record<string, number>;
}

export default function SummaryCards({ stocks, prices }: Props) {
  let totalMarketValue = 0;
  let totalCost = 0;
  let totalPL = 0;

  for (const stock of stocks) {
    const currentPrice = prices[stock.code] ?? 0;
    const calc = calcStock(
      currentPrice,
      stock.holdingCost,
      stock.shares,
      stock.targetPrice,
      stock.targetMarketValue
    );
    totalMarketValue += calc.currentMarketValue;
    totalCost += calc.costTotal;
    totalPL += calc.profitLoss;
  }

  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.label}>总市值</div>
        <div className={styles.value}>{formatMoney(totalMarketValue)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>总成本</div>
        <div className={styles.value}>{formatMoney(totalCost)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>浮动盈亏</div>
        <div
          className={`${styles.value} ${totalPL >= 0 ? styles.up : styles.down}`}
        >
          {formatMoney(totalPL)}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>盈亏比例</div>
        <div
          className={`${styles.value} ${totalPLPercent >= 0 ? styles.up : styles.down}`}
        >
          {formatPercent(totalPLPercent)}
        </div>
      </div>
    </div>
  );
}
