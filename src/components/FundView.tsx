import { useState, useCallback } from 'react';
import { useFundStore } from '../store/useFundStore';
import FundSummaryCards from './FundSummaryCards';
import FundTable from './FundTable';
import FundForm from './FundForm';
import Toolbar from './Toolbar';
import type { Fund } from '../types';

export default function FundView() {
  const { funds, navs, loading, error, addFund, setFunds, updateFund, deleteFund, refreshPrices } =
    useFundStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const editingFund = editingId
    ? funds.find((f) => f.id === editingId) ?? null
    : null;

  const handleSave = useCallback(
    (fund: Fund) => {
      if (editingId) {
        updateFund(fund);
        setEditingId(null);
      } else {
        addFund(fund);
        setShowForm(false);
      }
    },
    [editingId, addFund, updateFund]
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
    const data = JSON.stringify(funds, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_funds_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [funds]);

  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as unknown;
          if (!Array.isArray(data)) {
            throw new Error('invalid');
          }

          const normalized: Fund[] = [];
          for (const item of data) {
            if (typeof item !== 'object' || item === null) continue;
            const raw = item as Partial<Fund>;
            if (typeof raw.code !== 'string') continue;

            const fund: Fund = {
              id:
                typeof raw.id === 'string' && raw.id.trim().length > 0
                  ? raw.id
                  : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              code: raw.code.trim(),
              name: typeof raw.name === 'string' ? raw.name.trim() : '',
              holdingAmount: typeof raw.holdingAmount === 'number' ? raw.holdingAmount : 0,
              holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
            };
            if (fund.code) {
              normalized.push(fund);
            }
          }

          if (normalized.length === 0) {
            alert('导入失败：没有可用的基金数据');
            return;
          }

          const merged = [...funds];
          for (const incoming of normalized) {
            const idx = merged.findIndex(
              (f) => f.id === incoming.id || f.code === incoming.code
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...incoming, id: merged[idx].id };
            } else {
              merged.push(incoming);
            }
          }
          setFunds(merged);
        } catch {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    },
    [funds, setFunds]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('确定删除这只基金吗？')) {
        deleteFund(id);
      }
    },
    [deleteFund]
  );

  return (
    <>
      <FundSummaryCards funds={funds} navs={navs} />
      <Toolbar
        addLabel="添加基金"
        onAdd={() => {
          setEditingId(null);
          setShowForm(true);
        }}
        onExport={handleExport}
        onImport={handleImport}
        loading={loading}
        error={error}
        count={funds.length}
        onRefresh={refreshPrices}
      />
      <FundTable onEdit={handleEdit} onDelete={handleDelete} />
      {showForm && (
        <FundForm
          key={editingId ?? 'new-fund'}
          fund={editingFund}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  );
}
