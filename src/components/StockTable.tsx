import { useState, useMemo } from 'react';
import { useStockStore } from '../store/useStockStore';
import { calcStock, formatMoney, formatPercent, marketLabel } from '../utils/api';
import { StockTxPanel, StockDividendPanel } from './TxPanel';
import styles from './StockTable.module.css';

interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  filterTag?: string;
}

type SortField = 'code' | 'price' | 'cost' | 'shares' | 'marketValue' | 'profitLoss' | 'profitLossPercent' | 'targetPrice' | 'dropToTarget' | 'time';
type SortDir = 'asc' | 'desc';

export default function StockTable({ onEdit, onDelete, filterTag }: Props) {
  const stocks = useStockStore((s) => s.stocks);
  const prices = useStockStore((s) => s.prices);
  const marketCaps = useStockStore((s) => s.marketCaps);
  const timestamps = useStockStore((s) => s.timestamps);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() =>
    filterTag ? stocks.filter(s => s.tags.includes(filterTag)) : stocks,
    [stocks, filterTag]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const sortArrow = <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  const maxBuyBatches = Math.max(1, ...stocks.map((s) => s.buyPrices.length));
  const maxTpBatches = Math.max(1, ...stocks.map((s) => s.takeProfitPrices.length));

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cpA = prices[a.code] ?? 0;
      const cpB = prices[b.code] ?? 0;
      const calcA = calcStock(cpA, a.holdingCost, a.shares, a.targetPrice, a.targetMarketValue);
      const calcB = calcStock(cpB, b.holdingCost, b.shares, b.targetPrice, b.targetMarketValue);
      const tsA = timestamps[a.code] ?? 0;
      const tsB = timestamps[b.code] ?? 0;
      let va: number, vb: number;
      switch (sortField) {
        case 'price': va = cpA; vb = cpB; break;
        case 'cost': va = a.holdingCost; vb = b.holdingCost; break;
        case 'shares': va = a.shares; vb = b.shares; break;
        case 'marketValue': va = calcA.currentMarketValue; vb = calcB.currentMarketValue; break;
        case 'profitLoss': va = calcA.profitLoss; vb = calcB.profitLoss; break;
        case 'profitLossPercent': va = calcA.profitLossPercent; vb = calcB.profitLossPercent; break;
        case 'targetPrice': va = calcA.targetPrice; vb = calcB.targetPrice; break;
        case 'dropToTarget': va = calcA.dropToTargetPercent; vb = calcB.dropToTargetPercent; break;
        case 'time': va = tsA; vb = tsB; break;
        default: va = a.code.localeCompare(b.code); vb = 0; break;
      }
      if (sortField === 'code') return sortDir === 'asc' ? (va as unknown as number) : (vb as unknown as number);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, prices, timestamps, sortField, sortDir]);

  if (stocks.length === 0) {
    return <div className={styles.empty}>暂无持仓数据，点击上方"添加股票"开始</div>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th onClick={() => handleSort('code')}>股票 {sortField === 'code' && sortArrow}</th>
            <th>市场</th>
            <th>标签</th>
            <th onClick={() => handleSort('price')}>现价 {sortField === 'price' && sortArrow}</th>
            <th onClick={() => handleSort('cost')}>持仓成本 {sortField === 'cost' && sortArrow}</th>
            <th onClick={() => handleSort('shares')}>持仓数量 {sortField === 'shares' && sortArrow}</th>
            <th onClick={() => handleSort('marketValue')}>当前市值 {sortField === 'marketValue' && sortArrow}</th>
            <th onClick={() => handleSort('profitLoss')}>浮动盈亏 {sortField === 'profitLoss' && sortArrow}</th>
            <th onClick={() => handleSort('profitLossPercent')}>盈亏比例 {sortField === 'profitLossPercent' && sortArrow}</th>
            <th onClick={() => handleSort('targetPrice')}>目标价 {sortField === 'targetPrice' && sortArrow}</th>
            <th onClick={() => handleSort('dropToTarget')}>距目标跌幅 {sortField === 'dropToTarget' && sortArrow}</th>
            <th>目标市值</th>
            {Array.from({ length: maxBuyBatches }, (_, i) => <th key={`buy${i}`}>买{i + 1}</th>)}
            {Array.from({ length: maxBuyBatches }, (_, i) => <th key={`buyS${i}`}>买{i + 1}股数</th>)}
            {Array.from({ length: maxTpBatches }, (_, i) => <th key={`tp${i}`}>止盈{i + 1}价 / 占比</th>)}
            <th onClick={() => handleSort('time')}>更新时间 {sortField === 'time' && sortArrow}</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((stock) => {
            const cp = prices[stock.code] ?? 0;
            const apiMC = marketCaps[stock.code] ?? 0;
            const calc = calcStock(cp, stock.holdingCost, stock.shares, stock.targetPrice, stock.targetMarketValue);
            const ts = timestamps[stock.code];
            const timeStr = ts ? new Date(ts).toLocaleTimeString('zh-CN') : '-';

            return (
              <>
                <tr key={stock.id}>
                  <td>
                    <button className={styles.detailToggle} onClick={() => toggleExpand(stock.id)}>
                      {expanded.has(stock.id) ? '▼' : '▶'}
                    </button>
                    <span className={styles.stockName}>{stock.name}</span>
                    <span className={styles.stockCode}>{stock.code}</span>
                  </td>
                  <td className={styles.market}>{marketLabel(stock.market)}</td>
                  <td className={styles.tagsCell}>
                    {stock.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                  </td>
                  <td className={cp > 0 ? styles.priceUp : ''}>{cp > 0 ? cp.toFixed(2) : '-'}</td>
                  <td>{stock.holdingCost.toFixed(2)}</td>
                  <td>{stock.shares}</td>
                  <td>{apiMC > 0 ? formatMoney(apiMC) : stock.marketCap > 0 ? formatMoney(stock.marketCap) : formatMoney(calc.costTotal)}</td>
                  <td className={calc.profitLoss >= 0 ? styles.up : styles.down}>{formatMoney(calc.profitLoss)}</td>
                  <td className={calc.profitLossPercent >= 0 ? styles.up : styles.down}>{formatPercent(calc.profitLossPercent)}</td>
                  <td>{calc.targetPrice > 0 ? calc.targetPrice.toFixed(2) : '-'}</td>
                  <td className={styles.down}>
                    {calc.targetPrice > 0 ? (calc.dropToTargetPercent > 0 ? formatPercent(-calc.dropToTargetPercent) : '已到位') : '-'}
                  </td>
                  <td>{calc.targetMarketValue > 0 ? formatMoney(calc.targetMarketValue) : '-'}</td>
                  {Array.from({ length: maxBuyBatches }, (_, i) => (
                    <td key={`buy${i}`}>{stock.buyPrices[i] !== undefined && stock.buyPrices[i] > 0 ? stock.buyPrices[i].toFixed(2) : '-'}</td>
                  ))}
                  {Array.from({ length: maxBuyBatches }, (_, i) => (
                    <td key={`buyS${i}`}>{stock.buyShares[i] !== undefined && stock.buyShares[i] > 0 ? stock.buyShares[i] : '-'}</td>
                  ))}
                  {Array.from({ length: maxTpBatches }, (_, i) => {
                    const tpPrice = stock.takeProfitPrices[i];
                    const tpShares = stock.takeProfitShares[i];
                    const hasTp = tpPrice !== undefined && tpPrice > 0;
                    const pct = hasTp && tpShares > 0 && stock.shares > 0 ? ((tpShares / stock.shares) * 100).toFixed(1) : null;
                    return <td key={`tp${i}`} className={styles.tp}>{hasTp ? `${tpPrice.toFixed(2)}${pct ? ` (${pct}%)` : ''}` : '-'}</td>;
                  })}
                  <td className={styles.time}>{timeStr}</td>
                  <td>
                    <button className={styles.btnEdit} onClick={() => onEdit(stock.id)}>编辑</button>
                    <button className={styles.btnDel} onClick={() => onDelete(stock.id)}>删除</button>
                  </td>
                </tr>
                {expanded.has(stock.id) && (
                  <tr className={styles.detailRow}>
                    <td colSpan={14 + maxBuyBatches * 2 + maxTpBatches}>
                      <div className={styles.detailPanel}>
                        <div className={styles.detailSection}>
                          <span className={styles.detailLabel}>目标价:</span>
                          <span className={styles.detailValue}>{calc.targetPrice > 0 ? calc.targetPrice.toFixed(2) : '未设置'}</span>
                          <span className={styles.detailLabel}>目标市值:</span>
                          <span className={styles.detailValue}>{calc.targetMarketValue > 0 ? formatMoney(calc.targetMarketValue) : '未设置'}</span>
                        </div>
                        <div className={styles.detailSection}>
                          <span className={styles.detailLabel}>成本总计:</span>
                          <span className={styles.detailValue}>{formatMoney(calc.costTotal)}</span>
                          <span className={styles.detailLabel}>当前市值:</span>
                          <span className={styles.detailValue}>{formatMoney(calc.currentMarketValue)}</span>
                        </div>
                        <StockTxPanel stockId={stock.id} />
                        <StockDividendPanel stockId={stock.id} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
