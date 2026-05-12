import { useState, useEffect } from 'react';
import type { Stock } from '../types';
import { toStockCode } from '../utils/api';
import styles from './StockForm.module.css';

interface Props {
  stock: Stock | null;
  onSave: (stock: Stock) => void;
  onClose: () => void;
}

function emptyStock(): Stock {
  return {
    id: '',
    code: '',
    name: '',
    shares: 0,
    holdingCost: 0,
    targetPrice: 0,
    targetMarketValue: 0,
    marketCap: 0,
    buyPrices: [],
    buyShares: [],
    takeProfitPrices: [],
    takeProfitShares: [],
  };
}

export default function StockForm({ stock, onSave, onClose }: Props) {
  const [form, setForm] = useState<Stock>(stock ?? emptyStock());
  const [codeInput, setCodeInput] = useState(stock?.code ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = toStockCode(codeInput);
    onSave({ ...form, id: stock?.id || Date.now().toString(36), code });
  };

  const set = (key: keyof Stock, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addBuyBatch = () => {
    setForm((prev) => ({
      ...prev,
      buyPrices: [...prev.buyPrices, 0],
      buyShares: [...prev.buyShares, 0],
    }));
  };

  const removeBuyBatch = (i: number) => {
    setForm((prev) => ({
      ...prev,
      buyPrices: prev.buyPrices.filter((_, idx) => idx !== i),
      buyShares: prev.buyShares.filter((_, idx) => idx !== i),
    }));
  };

  const updateBuyPrice = (i: number, v: number) => {
    setForm((prev) => {
      const arr = [...prev.buyPrices];
      arr[i] = v;
      return { ...prev, buyPrices: arr };
    });
  };

  const updateBuyShares = (i: number, v: number) => {
    setForm((prev) => {
      const arr = [...prev.buyShares];
      arr[i] = v;
      return { ...prev, buyShares: arr };
    });
  };

  const addTakeProfit = () => {
    setForm((prev) => ({
      ...prev,
      takeProfitPrices: [...prev.takeProfitPrices, 0],
      takeProfitShares: [...prev.takeProfitShares, 0],
    }));
  };

  const removeTakeProfit = (i: number) => {
    setForm((prev) => ({
      ...prev,
      takeProfitPrices: prev.takeProfitPrices.filter((_, idx) => idx !== i),
      takeProfitShares: prev.takeProfitShares.filter((_, idx) => idx !== i),
    }));
  };

  const updateTakeProfitPrice = (i: number, v: number) => {
    setForm((prev) => {
      const arr = [...prev.takeProfitPrices];
      arr[i] = v;
      return { ...prev, takeProfitPrices: arr };
    });
  };

  const updateTakeProfitShares = (i: number, v: number) => {
    setForm((prev) => {
      const arr = [...prev.takeProfitShares];
      arr[i] = v;
      return { ...prev, takeProfitShares: arr };
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{stock ? '编辑股票' : '添加股票'}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>股票代码</label>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="sh600036 / 600036"
                required
              />
            </div>
            <div className={styles.field}>
              <label>股票名称</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="招商银行"
                required
              />
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.field}>
              <label>持仓均价</label>
              <input
                type="number"
                step="0.01"
                value={form.holdingCost || ''}
                onChange={(e) => set('holdingCost', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label>持仓股数</label>
              <input
                type="number"
                value={form.shares || ''}
                onChange={(e) => set('shares', parseInt(e.target.value, 10) || 0)}
                placeholder="0"
              />
            </div>
            <div className={styles.field}>
              <label>目标价格</label>
              <input
                type="number"
                step="0.01"
                value={form.targetPrice || ''}
                onChange={(e) => set('targetPrice', parseFloat(e.target.value) || 0)}
                placeholder="选填"
              />
            </div>
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>目标市值</label>
              <input
                type="number"
                step="0.01"
                value={form.targetMarketValue || ''}
                onChange={(e) => set('targetMarketValue', parseFloat(e.target.value) || 0)}
                placeholder="选填"
              />
            </div>
            <div className={styles.field}>
              <label>当前市值（流通市值）</label>
              <input
                type="number"
                step="0.01"
                value={form.marketCap || ''}
                onChange={(e) => set('marketCap', parseFloat(e.target.value) || 0)}
                placeholder="选填"
              />
            </div>
          </div>

          <div className={styles.sectionHeader}>
            <h3 className={styles.section}>分批买入</h3>
            <button type="button" className={styles.btnAdd} onClick={addBuyBatch}>
              + 添加批次
            </button>
          </div>
          {form.buyPrices.map((price, i) => (
            <div className={styles.batchRow} key={i}>
              <div className={styles.field}>
                <label>第{i + 1}批买入价</label>
                <input
                  type="number"
                  step="0.01"
                  value={price || ''}
                  onChange={(e) => updateBuyPrice(i, parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className={styles.field}>
                <label>第{i + 1}批股数</label>
                <input
                  type="number"
                  value={form.buyShares[i] || ''}
                  onChange={(e) => updateBuyShares(i, parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <button
                type="button"
                className={styles.btnRemove}
                onClick={() => removeBuyBatch(i)}
              >
                删除
              </button>
            </div>
          ))}

          <div className={styles.sectionHeader}>
            <h3 className={styles.section}>分批止盈</h3>
            <button type="button" className={styles.btnAdd} onClick={addTakeProfit}>
              + 添加批次
            </button>
          </div>
          {form.takeProfitPrices.map((price, i) => (
            <div className={styles.batchRow} key={i}>
              <div className={styles.field}>
                <label>第{i + 1}批止盈价</label>
                <input
                  type="number"
                  step="0.01"
                  value={price || ''}
                  onChange={(e) => updateTakeProfitPrice(i, parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className={styles.field}>
                <label>第{i + 1}批止盈股数</label>
                <input
                  type="number"
                  value={form.takeProfitShares[i] || ''}
                  onChange={(e) => updateTakeProfitShares(i, parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <button
                type="button"
                className={styles.btnRemove}
                onClick={() => removeTakeProfit(i)}
              >
                删除
              </button>
            </div>
          ))}

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.btnSave}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
