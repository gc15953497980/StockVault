import { useState, useCallback, useEffect } from 'react';
import { useFundStore } from '../store/useFundStore';
import FundSummaryCards from './FundSummaryCards';
import FundTable from './FundTable';
import FundForm from './FundForm';
import Toolbar from './Toolbar';
import PortfolioChart from './PortfolioChart';
import ValueTrendChart from './ValueTrendChart';
import SectorChart from './SectorChart';
import ProfitAttribution from './ProfitAttribution';
import ConcentrationPanel from './ConcentrationPanel';
import BenchmarkChart from './BenchmarkChart';
import DcaCalculator from './DcaCalculator';
import StrategySimulator from './StrategySimulator';
import { fundsToCSV, downloadCSV } from '../utils/csv';
import { requestNotificationPermission, checkFundAlerts } from '../utils/notifications';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { usePnlCalendarStore } from '../store/usePnlCalendarStore';
import type { Fund } from '../types';
import styles from './FundView.module.css';

export default function FundView() {
  const { funds, navs, accumulatedNAVs, avgDownsides, loading, error, addFund, setFunds, updateFund, deleteFund, refreshPrices, refreshHistoryNAVs } =
    useFundStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  const [showDca, setShowDca] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('');

  useEffect(() => { requestNotificationPermission(); }, []);

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
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
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
              id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              code: raw.code.trim(),
              name: typeof raw.name === 'string' ? raw.name.trim() : '',
              sector: typeof raw.sector === 'string' ? raw.sector.trim() : '',
              holdingAmount: typeof raw.holdingAmount === 'number' ? raw.holdingAmount : 0,
              holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
              tags: Array.isArray(raw.tags) ? raw.tags.filter((v): v is string => typeof v === 'string') : [],
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
    usePnlCalendarStore.getState().recordToday();
    refreshHistoryNAVs();
  }, [refreshPrices, refreshHistoryNAVs]);

  const hasData = funds.length > 0;

  const allTags = [...new Set(funds.flatMap(f => f.tags))];
  const filteredFunds = filterTag ? funds.filter(f => f.tags.includes(filterTag)) : funds;

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
        showDca={() => setShowDca(true)}
        showSim={() => setShowSim(true)}
      />

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>标签筛选:</span>
          <button
            onClick={() => setFilterTag('')}
            style={{
              padding: '2px 8px', border: '1px solid var(--border-heavy)', borderRadius: 12,
              background: filterTag === '' ? 'var(--primary)' : 'var(--surface)',
              color: filterTag === '' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 11,
            }}
          >全部</button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              style={{
                padding: '2px 8px', border: '1px solid var(--border-heavy)', borderRadius: 12,
                background: filterTag === tag ? 'var(--primary)' : 'var(--surface)',
                color: filterTag === tag ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 11,
              }}
            >{tag}</button>
          ))}
        </div>
      )}

      {hasData && (
        <div className={styles.charts}>
          <PortfolioChart
            stocks={
              filteredFunds.map((f) => {
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

      {hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <ProfitAttribution type="funds" />
          <ConcentrationPanel />
        </div>
      )}

      {hasData && (
        <div style={{ marginBottom: 20 }}>
          <BenchmarkChart />
        </div>
      )}

      <div className={styles.toggleRow}>
        <button
          className={styles.toggleBtn}
          onClick={() => setHideNames((v) => !v)}
          title={hideNames ? '显示基金名称' : '隐藏基金名称'}
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
      <FundTable onEdit={handleEdit} onDelete={handleDelete} hideNames={hideNames} filterTag={filterTag} />

      {showForm && (
        <FundForm key={editingId ?? 'new-fund'} fund={editingFund} onSave={handleSave} onClose={handleClose} />
      )}

      {showDca && <DcaCalculator onClose={() => setShowDca(false)} />}
      {showSim && <StrategySimulator onClose={() => setShowSim(false)} />}
    </>
  );
}
