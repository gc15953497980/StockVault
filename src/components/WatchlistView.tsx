import { useState, useEffect } from 'react';
import { useWatchlistStore } from '../store/useWatchlistStore';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { fetchStockPrices, fetchFundPrices, toStockCode, toFundCode, marketLabel } from '../utils/api';
import type { WatchItem, Market } from '../types';
import styles from './WatchlistView.module.css';

export default function WatchlistView() {
  const { items, addItem, updateItem, deleteItem } = useWatchlistStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [itemType, setItemType] = useState<'stock' | 'fund'>('stock');
  const [market, setMarket] = useState<Market>('a');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [changePercents, setChangePercents] = useState<Record<string, number>>({});

  useEffect(() => {
    const refreshWatchPrices = async () => {
      if (items.length === 0) return;
      const stocks = items.filter(i => i.type === 'stock' && i.market === 'a');
      const funds = items.filter(i => i.type === 'fund');

      if (stocks.length > 0) {
        const result = await fetchStockPrices(stocks.map(s => s.code));
        const p: Record<string, number> = {};
        for (const s of stocks) {
          if (result[s.code]) p[s.code] = result[s.code].price;
        }
        setPrices(prev => ({ ...prev, ...p }));
      }

      if (funds.length > 0) {
        const result = await fetchFundPrices(funds.map(f => f.code));
        const p: Record<string, number> = {};
        const cp: Record<string, number> = {};
        for (const f of funds) {
          if (result[f.code]) {
            p[f.code] = result[f.code].currentNAV;
            cp[f.code] = result[f.code].dailyChangePercent;
          }
        }
        setPrices(prev => ({ ...prev, ...p }));
        setChangePercents(prev => ({ ...prev, ...cp }));
      }
    };
    refreshWatchPrices();
  }, [items]);

  const handleAdd = () => {
    setShowForm(true);
    setEditingId(null);
    setCode('');
    setName('');
    setNote('');
    setItemType('stock');
    setMarket('a');
  };

  const handleSave = () => {
    if (!code.trim()) return;
    const id = editingId || Date.now().toString(36);
    const item: WatchItem = {
      id,
      code: itemType === 'stock' ? toStockCode(code, market) : toFundCode(code),
      name: name.trim() || (itemType === 'stock' ? toStockCode(code, market) : code),
      type: itemType,
      market: itemType === 'stock' ? market : 'a',
      note: note.trim(),
      addedAt: editingId ? (items.find(i => i.id === editingId)?.addedAt || new Date().toISOString()) : new Date().toISOString(),
    };
    if (editingId) updateItem(item);
    else addItem(item);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: WatchItem) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setNote(item.note);
    setItemType(item.type);
    setMarket(item.market);
    setShowForm(true);
  };

  const moveToStock = (item: WatchItem) => {
    const { addStock } = useStockStore.getState();
    addStock({
      id: Date.now().toString(36),
      code: item.code,
      name: item.name,
      shares: 0,
      holdingCost: 0,
      targetPrice: 0,
      targetMarketValue: 0,
      marketCap: 0,
      buyPrices: [],
      buyShares: [],
      takeProfitPrices: [],
      takeProfitShares: [],
      tags: [],
      market: item.market,
    });
  };

  const moveToFund = (item: WatchItem) => {
    const { addFund } = useFundStore.getState();
    addFund({
      id: Date.now().toString(36),
      code: item.code,
      name: item.name,
      sector: '',
      holdingAmount: 0,
      holdingCost: 0,
      tags: [],
    });
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={handleAdd}>+ 添加关注</button>
        <span className={styles.count}>{items.length} 个关注标的</span>
      </div>

      {showForm && (
        <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.formModal} onClick={e => e.stopPropagation()}>
            <h3>{editingId ? '编辑关注' : '添加关注'}</h3>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>类型</label>
                <select value={itemType} onChange={e => setItemType(e.target.value as any)}>
                  <option value="stock">股票</option>
                  <option value="fund">基金</option>
                </select>
              </div>
              {itemType === 'stock' && (
                <div className={styles.field}>
                  <label>市场</label>
                  <select value={market} onChange={e => setMarket(e.target.value as Market)}>
                    <option value="a">A股</option>
                    <option value="hk">港股</option>
                    <option value="us">美股</option>
                  </select>
                </div>
              )}
            </div>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>代码</label>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder={itemType === 'stock' ? '600036' : '000001'} />
              </div>
              <div className={styles.field}>
                <label>名称</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="选填" />
              </div>
            </div>
            <div className={styles.field}>
              <label>备注</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="为什么关注？" />
            </div>
            <div className={styles.formActions}>
              <button className={styles.btnCancel} onClick={() => setShowForm(false)}>取消</button>
              <button className={styles.btnSave} onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className={styles.empty}>暂无关注标的，点击上方"添加关注"开始</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>类型</th>
              <th>代码</th>
              <th>名称</th>
              <th>市场</th>
              <th>最新价</th>
              <th>涨跌幅</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const price = prices[item.code];
              const cp = changePercents[item.code];
              return (
                <tr key={item.id}>
                  <td className={item.type === 'stock' ? styles.stockTag : styles.fundTag}>
                    {item.type === 'stock' ? '股票' : '基金'}
                  </td>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{marketLabel(item.market)}</td>
                  <td>{price ? price.toFixed(item.type === 'stock' ? 2 : 4) : '-'}</td>
                  <td className={cp !== undefined ? (cp >= 0 ? styles.up : styles.down) : ''}>
                    {cp !== undefined ? (cp >= 0 ? '+' : '') + cp.toFixed(2) + '%' : '-'}
                  </td>
                  <td className={styles.note}>{item.note || '-'}</td>
                  <td>
                    <button className={styles.btnSmall} onClick={() => handleEdit(item)}>编辑</button>
                    {item.type === 'stock' && (
                      <button className={styles.btnSmall} onClick={() => moveToStock(item)} title="转为股票持仓">→股票</button>
                    )}
                    {item.type === 'fund' && (
                      <button className={styles.btnSmall} onClick={() => moveToFund(item)} title="转为基金持仓">→基金</button>
                    )}
                    <button className={styles.btnDel} onClick={() => { if (window.confirm('确定删除？')) deleteItem(item.id); }}>删</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
