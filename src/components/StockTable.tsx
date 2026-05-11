import { useStockStore } from '../store/useStockStore';
import { calcStock, formatMoney, formatPercent } from '../utils/api';
import styles from './StockTable.module.css';

interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function StockTable({ onEdit, onDelete }: Props) {
  const stocks = useStockStore((s) => s.stocks);
  const prices = useStockStore((s) => s.prices);
  const marketCaps = useStockStore((s) => s.marketCaps);
  const timestamps = useStockStore((s) => s.timestamps);

  if (stocks.length === 0) {
    return (
      <div className={styles.empty}>
        暂无持仓数据，点击上方"添加股票"开始
      </div>
    );
  }

  const maxBuyBatches = Math.max(1, ...stocks.map((s) => s.buyPrices.length));
  const maxTpBatches = Math.max(1, ...stocks.map((s) => s.takeProfitPrices.length));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>股票</th>
            <th>现价</th>
            <th>持仓成本</th>
            <th>持仓数量</th>
            <th>当前市值</th>
            <th>浮动盈亏</th>
            <th>盈亏比例</th>
            <th>目标价</th>
            <th>距目标跌幅</th>
            <th>目标市值</th>
            {Array.from({ length: maxBuyBatches }, (_, i) => (
              <th key={`buy${i}`}>买{i + 1}</th>
            ))}
            {Array.from({ length: maxBuyBatches }, (_, i) => (
              <th key={`buyS${i}`}>买{i + 1}股数</th>
            ))}
            {Array.from({ length: maxTpBatches }, (_, i) => (
              <th key={`tp${i}`}>止盈{i + 1}价 / 占比</th>
            ))}
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => {
            const cp = prices[stock.code] ?? 0;
            const apiMC = marketCaps[stock.code] ?? 0;
            const calc = calcStock(
              cp,
              stock.holdingCost,
              stock.shares,
              stock.targetPrice,
              stock.targetMarketValue
            );
            const ts = timestamps[stock.code];
            const timeStr = ts
              ? new Date(ts).toLocaleTimeString('zh-CN')
              : '-';

            return (
              <tr key={stock.id}>
                <td>
                  <span className={styles.stockName}>{stock.name}</span>
                  <span className={styles.stockCode}>{stock.code}</span>
                </td>
                <td className={cp > 0 ? styles.priceUp : ''}>
                  {cp > 0 ? cp.toFixed(2) : '-'}
                </td>
                <td>{stock.holdingCost.toFixed(2)}</td>
                <td>{stock.shares}</td>
                <td>{apiMC > 0 ? formatMoney(apiMC) : stock.marketCap > 0 ? formatMoney(stock.marketCap) : formatMoney(calc.costTotal)}</td>
                <td className={calc.profitLoss >= 0 ? styles.up : styles.down}>
                  {formatMoney(calc.profitLoss)}
                </td>
                <td
                  className={
                    calc.profitLossPercent >= 0 ? styles.up : styles.down
                  }
                >
                  {formatPercent(calc.profitLossPercent)}
                </td>
                <td>{calc.targetPrice > 0 ? calc.targetPrice.toFixed(2) : '-'}</td>
                <td className={styles.down}>
                  {calc.targetPrice > 0
                    ? calc.dropToTargetPercent > 0
                      ? formatPercent(-calc.dropToTargetPercent)
                      : '已到位'
                    : '-'}
                </td>
                <td>{calc.targetMarketValue > 0 ? formatMoney(calc.targetMarketValue) : '-'}</td>
                {Array.from({ length: maxBuyBatches }, (_, i) => (
                  <td key={`buy${i}`}>
                    {stock.buyPrices[i] !== undefined && stock.buyPrices[i] > 0
                      ? stock.buyPrices[i].toFixed(2)
                      : '-'}
                  </td>
                ))}
                {Array.from({ length: maxBuyBatches }, (_, i) => (
                  <td key={`buyS${i}`}>
                    {stock.buyShares[i] !== undefined && stock.buyShares[i] > 0
                      ? stock.buyShares[i]
                      : '-'}
                  </td>
                ))}
                {Array.from({ length: maxTpBatches }, (_, i) => {
                  const tpPrice = stock.takeProfitPrices[i];
                  const tpShares = stock.takeProfitShares[i];
                  const hasTp = tpPrice !== undefined && tpPrice > 0;
                  const pct =
                    hasTp && tpShares > 0 && stock.shares > 0
                      ? ((tpShares / stock.shares) * 100).toFixed(1)
                      : null;
                  return (
                    <td key={`tp${i}`} className={styles.tp}>
                      {hasTp
                        ? `${tpPrice.toFixed(2)}${pct ? ` (${pct}%)` : ''}`
                        : '-'}
                    </td>
                  );
                })}
                <td className={styles.time}>{timeStr}</td>
                <td>
                  <button
                    className={styles.btnEdit}
                    onClick={() => onEdit(stock.id)}
                  >
                    编辑
                  </button>
                  <button
                    className={styles.btnDel}
                    onClick={() => onDelete(stock.id)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
