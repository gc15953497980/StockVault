import { useState, useCallback, useEffect } from 'react';
import { useFundStore } from '../store/useFundStore';
import FundSummaryCards from './FundSummaryCards';
import FundTable from './FundTable';
import FundForm from './FundForm';
import Toolbar from './Toolbar';
import PortfolioChart from './PortfolioChart';
import ValueTrendChart from './ValueTrendChart';
import SectorChart from './SectorChart';
import { fundsToCSV, downloadCSV } from '../utils/csv';
import { requestNotificationPermission, checkFundAlerts } from '../utils/notifications';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import type { Fund } from '../types';

export default function FundView() {
  const { funds, navs, accumulatedNAVs, avgDownsides, loading, error, addFund, setFunds, updateFund, deleteFund, refreshPrices, refreshHistoryNAVs } =
    useFundStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hideNames, setHideNames] = useState(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const editingFund = editingId ? funds.find((f) => f.id === editingId) ?? null : null;

  const handleSave = useCallback(
    (fund: Fund) => {
      if (editingId) { updateFund(fund); setEditingId(null); }
      else { addFund(fund); setShowForm(false); }
    },
    [editingId, addFund, updateFund]
  );

  const handleEdit = useCallback((id: string) => { setEditingId(id); setShowForm(true); }, []);
  const handleClose = useCallback(() => { setShowForm(false); setEditingId(null); }, []);

  const handleExportJSON = useCallback(() => {
    const data = JSON.stringify(funds, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_funds_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [funds]);

  const handleExportCSV = useCallback(() => {
    const csv = fundsToCSV(funds, navs, accumulatedNAVs, avgDownsides);
    downloadCSV(csv, `stockvault_funds_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [funds, navs, accumulatedNAVs, avgDownsides]);

  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as unknown;
          if (!Array.isArray(data)) throw new Error('invalid');
          const normalized: Fund[] = [];
          for (const item of data) {
            if (typeof item !== 'object' || item === null) continue;
            const raw = item as Partial<Fund>;
            if (typeof raw.code !== 'string') continue;
            const fund: Fund = {
              id: typeof raw.id === 'string' && raw.id.trim().length > 0
                ? raw.id
                : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              code: raw.code.trim(),
              name: typeof raw.name === 'string' ? raw.name.trim() : '',
              sector: typeof raw.sector === 'string' ? raw.sector.trim() : '',
              holdingAmount: typeof raw.holdingAmount === 'number' ? raw.holdingAmount : 0,
              holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
            };
            if (fund.code) normalized.push(fund);
          }
          if (normalized.length === 0) { alert('导入失败：没有可用的基金数据'); return; }
          const merged = [...funds];
          for (const incoming of normalized) {
            const idx = merged.findIndex((f) => f.id === incoming.id || f.code === incoming.code);
            if (idx >= 0) merged[idx] = { ...merged[idx], ...incoming, id: merged[idx].id };
            else merged.push(incoming);
          }
          setFunds(merged);
        } catch { alert('导入失败：文件格式不正确'); }
      };
      reader.readAsText(file);
    },
    [funds, setFunds]
  );

  const handleDelete = useCallback(
    (id: string) => { if (window.confirm('确定删除这只基金吗？')) deleteFund(id); },
    [deleteFund]
  );

  const handleRefresh = useCallback(async () => {
    await refreshPrices();
    const { funds: f, navs: n } = useFundStore.getState();
    checkFundAlerts(f, n);
    useValueHistoryStore.getState().recordSnapshot();
    refreshHistoryNAVs();
  }, [refreshPrices, refreshHistoryNAVs]);

  const hasData = funds.length > 0;

  return (
    <>
      <FundSummaryCards funds={funds} navs={navs} />
      <Toolbar
        addLabel="添加基金"
        onAdd={() => { setEditingId(null); setShowForm(true); }}
        onExportJSON={handleExportJSON}
        onExportCSV={handleExportCSV}
        onImport={handleImport}
        loading={loading}
        error={error}
        count={funds.length}
        onRefresh={handleRefresh}
      />
      {hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <PortfolioChart
            stocks={
              funds.map((f) => {
                const nav = navs[f.code] ?? 0;
                const mv = nav > 0 && f.holdingCost > 0 ? (f.holdingAmount / f.holdingCost) * nav : f.holdingAmount;
                return { name: hideNames ? '***' : (f.name || f.code), value: mv };
              })
            }
          />
          <ValueTrendChart type="funds" />
          <SectorChart />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={() => setHideNames((v) => !v)}
          title={hideNames ? '显示基金名称' : '隐藏基金名称'}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 8px',
            lineHeight: 1,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {hideNames ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      <FundTable onEdit={handleEdit} onDelete={handleDelete} hideNames={hideNames} />
      {showForm && (
        <FundForm key={editingId ?? 'new-fund'} fund={editingFund} onSave={handleSave} onClose={handleClose} />
      )}
    </>
  );
}
