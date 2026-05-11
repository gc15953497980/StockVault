import { useState, useCallback } from 'react';
import { useStockStore } from '../store/useStockStore';
import SummaryCards from './SummaryCards';
import StockTable from './StockTable';
import StockForm from './StockForm';
import Toolbar from './Toolbar';
import type { Stock } from '../types';

export default function StockView() {
  const { stocks, prices, loading, error, addStock, setStocks, updateStock, deleteStock, refreshPrices } =
    useStockStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const editingStock = editingId
    ? stocks.find((s) => s.id === editingId) ?? null
    : null;

  const handleSave = useCallback(
    (stock: Stock) => {
      if (editingId) {
        updateStock(stock);
        setEditingId(null);
      } else {
        addStock(stock);
        setShowForm(false);
      }
    },
    [editingId, addStock, updateStock]
  );

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setShowForm(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
  }, []);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(stocks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_stocks_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stocks]);

  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as unknown;
          if (!Array.isArray(data)) {
            throw new Error('invalid');
          }

          const normalized: Stock[] = [];
          for (const item of data) {
            if (typeof item !== 'object' || item === null) continue;
            const raw = item as Partial<Stock>;
            if (typeof raw.code !== 'string' || typeof raw.name !== 'string') continue;

            const stock: Stock = {
              id:
                typeof raw.id === 'string' && raw.id.trim().length > 0
                  ? raw.id
                  : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              code: raw.code.trim(),
              name: raw.name.trim(),
              shares: typeof raw.shares === 'number' ? raw.shares : 0,
              holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
              targetPrice: typeof raw.targetPrice === 'number' ? raw.targetPrice : 0,
              targetMarketValue:
                typeof raw.targetMarketValue === 'number' ? raw.targetMarketValue : 0,
              marketCap: typeof raw.marketCap === 'number' ? raw.marketCap : 0,
              buyPrices: Array.isArray(raw.buyPrices)
                ? raw.buyPrices.filter((v): v is number => typeof v === 'number')
                : [],
              buyShares: Array.isArray(raw.buyShares)
                ? raw.buyShares.filter((v): v is number => typeof v === 'number')
                : [],
              takeProfitPrices: Array.isArray(raw.takeProfitPrices)
                ? raw.takeProfitPrices.filter((v): v is number => typeof v === 'number')
                : [],
              takeProfitShares: Array.isArray(raw.takeProfitShares)
                ? raw.takeProfitShares.filter((v): v is number => typeof v === 'number')
                : [],
            };

            if (stock.code && stock.name) {
              normalized.push(stock);
            }
          }

          if (normalized.length === 0) {
            alert('导入失败：没有可用的股票数据');
            return;
          }

          const merged = [...stocks];
          for (const incoming of normalized) {
            const idx = merged.findIndex(
              (s) => s.id === incoming.id || s.code === incoming.code
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...incoming, id: merged[idx].id };
            } else {
              merged.push(incoming);
            }
          }
          setStocks(merged);
        } catch {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    },
    [stocks, setStocks]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('确定删除这只股票吗？')) {
        deleteStock(id);
      }
    },
    [deleteStock]
  );

  return (
    <>
      <SummaryCards stocks={stocks} prices={prices} />
      <Toolbar
        addLabel="添加股票"
        onAdd={() => {
          setEditingId(null);
          setShowForm(true);
        }}
        onExport={handleExport}
        onImport={handleImport}
        loading={loading}
        error={error}
        count={stocks.length}
        onRefresh={refreshPrices}
      />
      <StockTable onEdit={handleEdit} onDelete={handleDelete} />
      {showForm && (
        <StockForm
          key={editingId ?? 'new-stock'}
          stock={editingStock}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  );
}
