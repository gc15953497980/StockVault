import { useState, useEffect } from 'react';
import { useWatchlistStore } from '../store/useWatchlistStore';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { fetchStockPrices, fetchForeignPrices, fetchFundPrices, toStockCode, toFundCode, marketLabel, fetchStockList } from '../utils/api';
import KlineChartModal from './KlineChartModal';
import type { WatchItem, Market } from '../types';
import styles from './WatchlistView.module.css';

export default function WatchlistView() {
  const { items, addItem, addItems, updateItem, deleteItem } = useWatchlistStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [itemType, setItemType] = useState<'stock' | 'fund'>('stock');
  const [market, setMarket] = useState<Market>('a');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [changePercents, setChangePercents] = useState<Record<string, number>>({});
  const [wlLoading, setWlLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [klineItem, setKlineItem] = useState<{ code: string; name: string; market: Market } | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'changePercent' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleBatchImport = async () => {
    if (!window.confirm('将导入所有A股主板股票（排除创业板、科创板、北交所、ST），确认继续？')) return;
    setImporting(true);
    setImportMsg('正在拉取A股列表...');
    try {
      const list = await fetchStockList();
      if (list.length === 0) {
        setImportMsg('未获取到股票数据');
        return;
      }
      setImportMsg(`获取到 ${list.length} 只股票，正在导入...`);
      const existingCodes = new Set(items.map(i => i.code));
      const now = new Date().toISOString();
      const newItems: WatchItem[] = [];
      for (const s of list) {
        const wlCode = toStockCode(s.code, 'a');
        if (existingCodes.has(wlCode)) continue;
        newItems.push({
          id: Date.now().toString(36) + '_' + s.code,
          code: wlCode,
          name: s.name,
          type: 'stock',
          market: 'a',
          note: '',
          addedAt: now,
        });
      }
      if (newItems.length > 0) {
        addItems(newItems);
        setImportMsg(`完成：新增 ${newItems.length} 只股票到关注列表（已跳过 ${list.length - newItems.length} 只重复）`);
      } else {
        setImportMsg('所有股票已在关注列表中，无需导入');
      }
    } catch (e: unknown) {
      setImportMsg(`导入失败：${e instanceof Error ? e.message : '网络错误'}`);
    } finally {
      setImporting(false);
    }
  };

  const refreshWatchlist = async (itemList: WatchItem[]) => {
    if (itemList.length === 0) return;
    setWlLoading(true);
    try {
      const aStocks = itemList.filter(i => i.type === 'stock' && i.market === 'a');
      const foreignStocks = itemList.filter(i => i.type === 'stock' && i.market !== 'a');
      const funds = itemList.filter(i => i.type === 'fund');

      const newPrices: Record<string, number> = {};
      const newCP: Record<string, number> = {};

      if (aStocks.length > 0) {
        const result = await fetchStockPrices(aStocks.map(s => s.code));
        for (const s of aStocks) {
          if (result[s.code]) {
            newPrices[s.code] = result[s.code].price;
            newCP[s.code] = result[s.code].changePercent;
          }
        }
      }
      if (foreignStocks.length > 0) {
        const result = await fetchForeignPrices(foreignStocks.map(s => ({ code: s.code, market: s.market })));
        for (const s of foreignStocks) {
          if (result[s.code]) {
            newPrices[s.code] = result[s.code].price;
            newCP[s.code] = result[s.code].changePercent;
          }
        }
      }
      if (funds.length > 0) {
        const result = await fetchFundPrices(funds.map(f => f.code));
        for (const f of funds) {
          if (result[f.code]) {
            newPrices[f.code] = result[f.code].currentNAV;
            newCP[f.code] = result[f.code].dailyChangePercent;
          }
        }
      }
      setPrices(newPrices);
      setChangePercents(newCP);
    } finally {
      setWlLoading(false);
    }
  };

  const handleRefreshWatch = () => refreshWatchlist(items);

  useEffect(() => {
    // Defer to microtask to avoid cascading renders (react-hooks/set-state-in-effect)
    Promise.resolve().then(() => refreshWatchlist(items));
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
      formation: '',
      market: item.market,
      type: 'stock',
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
      formation: '',
    });
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={handleAdd}>+ 添加关注</button>
        <button className={styles.btn} onClick={handleBatchImport} disabled={importing}>
          {importing ? '导入中...' : '批量导入A股'}
        </button>
        <button className={styles.btn} onClick={handleRefreshWatch} disabled={wlLoading}>
          {wlLoading ? '刷新中...' : '刷新行情'}
        </button>
        <span className={styles.count}>{items.length} 个关注标的</span>
      </div>
      {importMsg && <div className={styles.importMsg}>{importMsg}</div>}

      {showForm && (
        <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.formModal} onClick={e => e.stopPropagation()}>
            <h3>{editingId ? '编辑关注' : '添加关注'}</h3>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>类型</label>
                <select value={itemType} onChange={e => setItemType(e.target.value as 'stock' | 'fund')}>
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
        (() => {
          const sorted = [...items].sort((a, b) => {
            if (!sortBy) return 0;
            const av = sortBy === 'price' ? (prices[a.code] ?? -Infinity) : (changePercents[a.code] ?? -Infinity);
            const bv = sortBy === 'price' ? (prices[b.code] ?? -Infinity) : (changePercents[b.code] ?? -Infinity);
            return sortOrder === 'desc' ? bv - av : av - bv;
          });

          const handleSort = (col: 'price' | 'changePercent') => {
            if (sortBy === col) {
              setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
            } else {
              setSortBy(col);
              setSortOrder('desc');
            }
          };

          const sortArrow = (col: 'price' | 'changePercent') => {
            if (sortBy !== col) return ' ↕';
            return sortOrder === 'desc' ? ' ↓' : ' ↑';
          };

          return (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>类型</th>
              <th>代码</th>
              <th>名称</th>
              <th>市场</th>
              <th className={styles.sortable} onClick={() => handleSort('price')}>最新价{sortArrow('price')}</th>
              <th className={styles.sortable} onClick={() => handleSort('changePercent')}>涨跌幅{sortArrow('changePercent')}</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
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
                      <button className={styles.btnSmall} onClick={() => setKlineItem({ code: item.code, name: item.name, market: item.market })}>K线</button>
                    )}
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
          );
        })()
      )}

      {klineItem && (
        <KlineChartModal
          code={klineItem.code}
          name={klineItem.name}
          market={klineItem.market}
          onClose={() => setKlineItem(null)}
        />
      )}
    </div>
  );
}
