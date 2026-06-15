import { useState } from 'react';
import { useTxStore } from '../store/useTxStore';
import styles from './GridTradingPanel.module.css';

const EMPTY_ARRAY: never[] = [];

interface Props { stockId: string }

export default function GridTradingPanel({ stockId }: Props) {
  const txs = useTxStore(s => s.stockTxs[stockId] ?? EMPTY_ARRAY);
  const addStockTx = useTxStore(s => s.addStockTx);
  const deleteStockTx = useTxStore(s => s.deleteStockTx);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'grid_buy' | 'grid_sell'>('grid_buy');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');

  const gridTxs = txs.filter(tx => tx.type === 'grid_buy' || tx.type === 'grid_sell');

  const handleAdd = () => {
    const p = parseFloat(price);
    const s = parseInt(shares, 10);
    if (!p || !s || p <= 0 || s <= 0) return;
    addStockTx(stockId, { id: Date.now().toString(36), date, type, price: p, shares: s });
    setPrice(''); setShares(''); setShowForm(false);
  };

  // Calculate grid statistics
  let buyTotal = 0, sellTotal = 0, buyAmount = 0, sellAmount = 0;
  for (const tx of gridTxs) {
    if (tx.type === 'grid_buy') {
      buyTotal += tx.shares;
      buyAmount += tx.price * tx.shares;
    } else {
      sellTotal += tx.shares;
      sellAmount += tx.price * tx.shares;
    }
  }
  const realizedPL = sellAmount - (buyTotal > 0 && sellTotal > 0 ? buyAmount * (sellTotal / buyTotal) : 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>网格交易</span>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 添加'}
        </button>
      </div>

      {gridTxs.length > 0 && (
        <div className={styles.stats}>
          <span>买入 {buyTotal}股 共{Math.round(buyAmount)}</span>
          <span>卖出 {sellTotal}股 共{Math.round(sellAmount)}</span>
          <span className={realizedPL >= 0 ? styles.up : styles.down}>
            已实现盈亏 {realizedPL >= 0 ? '+' : ''}{Math.round(realizedPL)}
          </span>
        </div>
      )}

      {showForm && (
        <div className={styles.form}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.field} />
          <select value={type} onChange={e => setType(e.target.value as 'grid_buy' | 'grid_sell')} className={styles.field}>
            <option value="grid_buy">网格买入</option>
            <option value="grid_sell">网格卖出</option>
          </select>
          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="价格" className={styles.field} style={{ width: 80 }} />
          <input type="number" value={shares} onChange={e => setShares(e.target.value)} placeholder="股数" className={styles.field} style={{ width: 70 }} />
          <button onClick={handleAdd} className={styles.saveBtn}>保存</button>
        </div>
      )}

      {gridTxs.length > 0 && (
        <div className={styles.list}>
          {gridTxs.map(tx => (
            <div key={tx.id} className={styles.row}>
              <span className={styles.date}>{tx.date}</span>
              <span className={tx.type === 'grid_buy' ? styles.buyTag : styles.sellTag}>
                {tx.type === 'grid_buy' ? '买入' : '卖出'}
              </span>
              <span>{tx.price.toFixed(2)}</span>
              <span>{tx.shares}股</span>
              <span>{(tx.price * tx.shares).toFixed(2)}</span>
              <button className={styles.delBtn} onClick={() => deleteStockTx(stockId, tx.id)}>删</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
