import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import SummaryCards from './SummaryCards';
import StockTable from './StockTable';
import StockForm from './StockForm';
import FundSummaryCards from './FundSummaryCards';
import FundTable from './FundTable';
import FundForm from './FundForm';
import Toolbar from './Toolbar';
import PortfolioChart from './PortfolioChart';
import ValueTrendChart from './ValueTrendChart';
import SectorChart from './SectorChart';
import FormationChart from './FormationChart';
import ProfitAttribution from './ProfitAttribution';
import ConcentrationPanel from './ConcentrationPanel';
import BenchmarkChart from './BenchmarkChart';
const DcaCalculator = lazy(() => import('./DcaCalculator'));
const StrategySimulator = lazy(() => import('./StrategySimulator'));
import { stocksToCSV, fundsToCSV, downloadCSV } from '../utils/csv';
import { requestNotificationPermission, checkStockAlerts, checkFundAlerts } from '../utils/notifications';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { usePnlCalendarStore } from '../store/usePnlCalendarStore';
import type { Stock, Fund } from '../types';

export default function HoldingsView() {
  // Stock state
  const { stocks, prices, marketCaps, loading: sLoading, error: sError, addStock, setStocks, updateStock, deleteStock, refreshPrices: refreshSP } = useStockStore();
  const [sEditingId, setSEditingId] = useState<string | null>(null);
  const [sShowForm, setSShowForm] = useState(false);

  // Fund state
  const { funds, navs, accumulatedNAVs, avgDownsides, loading: fLoading, error: fError, addFund, setFunds, updateFund, deleteFund, refreshPrices: refreshFP, refreshHistoryNAVs } = useFundStore();
  const [fEditingId, setFEditingId] = useState<string | null>(null);
  const [fShowForm, setFShowForm] = useState(false);

  // Shared state
  const [showDca, setShowDca] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [stockFilterTag, setStockFilterTag] = useState('');
  const [fundFilterTag, setFundFilterTag] = useState('');
  const [chartsExpanded, setChartsExpanded] = useState(true);

  useEffect(() => { requestNotificationPermission(); }, []);

  // --- Stock handlers ---
  const sEditing = sEditingId ? stocks.find(s => s.id === sEditingId) ?? null : null;
  const handleSSave = useCallback((stock: Stock) => {
    if (sEditingId) { updateStock(stock); setSEditingId(null); setSShowForm(false); }
    else { addStock(stock); setSShowForm(false); }
  }, [sEditingId, addStock, updateStock]);
  const handleSEdit = useCallback((id: string) => { setSEditingId(id); setSShowForm(true); }, []);
  const handleSClose = useCallback(() => { setSShowForm(false); setSEditingId(null); }, []);
  const handleSDelete = useCallback((id: string) => { if (window.confirm('确定删除这只股票吗？')) deleteStock(id); }, [deleteStock]);

  const handleSExportJSON = useCallback(() => {
    const data = JSON.stringify(stocks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stockvault_stocks_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, [stocks]);

  const handleSExportCSV = useCallback(() => {
    const csv = stocksToCSV(stocks, prices, marketCaps);
    downloadCSV(csv, `stockvault_stocks_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [stocks, prices, marketCaps]);

  const handleSImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as unknown;
        if (!Array.isArray(data)) throw new Error('invalid');
        const normalized: Stock[] = [];
        for (const item of data) {
          if (typeof item !== 'object' || item === null) continue;
          const raw = item as Partial<Stock>;
          if (typeof raw.code !== 'string' || typeof raw.name !== 'string') continue;
          const stock: Stock = {
            id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            code: raw.code.trim(), name: raw.name.trim(),
            shares: typeof raw.shares === 'number' ? raw.shares : 0,
            holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
            targetPrice: typeof raw.targetPrice === 'number' ? raw.targetPrice : 0,
            targetMarketValue: typeof raw.targetMarketValue === 'number' ? raw.targetMarketValue : 0,
            marketCap: typeof raw.marketCap === 'number' ? raw.marketCap : 0,
            buyPrices: Array.isArray(raw.buyPrices) ? raw.buyPrices.filter((v): v is number => typeof v === 'number') : [],
            buyShares: Array.isArray(raw.buyShares) ? raw.buyShares.filter((v): v is number => typeof v === 'number') : [],
            takeProfitPrices: Array.isArray(raw.takeProfitPrices) ? raw.takeProfitPrices.filter((v): v is number => typeof v === 'number') : [],
            takeProfitShares: Array.isArray(raw.takeProfitShares) ? raw.takeProfitShares.filter((v): v is number => typeof v === 'number') : [],
            tags: Array.isArray(raw.tags) ? raw.tags.filter((v): v is string => typeof v === 'string') : [],
            formation: typeof raw.formation === 'string' ? raw.formation : '',
            market: raw.market === 'hk' || raw.market === 'us' || raw.market === 'a' ? raw.market : 'a',
            type: raw.type === 'etf' ? 'etf' : 'stock',
          };
          if (stock.code && stock.name) normalized.push(stock);
        }
        if (normalized.length === 0) { alert('导入失败：没有可用的股票数据'); return; }
        const merged = [...stocks];
        for (const incoming of normalized) {
          const idx = merged.findIndex(s => s.id === incoming.id || s.code === incoming.code);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...incoming, id: merged[idx].id };
          else merged.push(incoming);
        }
        setStocks(merged);
      } catch { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }, [stocks, setStocks]);

  const handleSRefresh = useCallback(async () => {
    await refreshSP();
    const { stocks: s, prices: p } = useStockStore.getState();
    checkStockAlerts(s, p);
    useValueHistoryStore.getState().recordSnapshot();
    usePnlCalendarStore.getState().recordToday();
  }, [refreshSP]);

  // --- Fund handlers ---
  const fEditing = fEditingId ? funds.find(f => f.id === fEditingId) ?? null : null;
  const handleFSave = useCallback((fund: Fund) => {
    if (fEditingId) { updateFund(fund); setFEditingId(null); setFShowForm(false); }
    else { addFund(fund); setFShowForm(false); }
  }, [fEditingId, addFund, updateFund]);
  const handleFEdit = useCallback((id: string) => { setFEditingId(id); setFShowForm(true); }, []);
  const handleFClose = useCallback(() => { setFShowForm(false); setFEditingId(null); }, []);
  const handleFDelete = useCallback((id: string) => { if (window.confirm('确定删除这只基金吗？')) deleteFund(id); }, [deleteFund]);

  const handleFExportJSON = useCallback(() => {
    const data = JSON.stringify(funds, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stockvault_funds_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, [funds]);

  const handleFExportCSV = useCallback(() => {
    const csv = fundsToCSV(funds, navs, accumulatedNAVs, avgDownsides);
    downloadCSV(csv, `stockvault_funds_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [funds, navs, accumulatedNAVs, avgDownsides]);

  const handleFImport = useCallback((file: File) => {
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
            formation: typeof raw.formation === 'string' ? raw.formation.trim() : '',
            holdingAmount: typeof raw.holdingAmount === 'number' ? raw.holdingAmount : 0,
            holdingCost: typeof raw.holdingCost === 'number' ? raw.holdingCost : 0,
            tags: Array.isArray(raw.tags) ? raw.tags.filter((v): v is string => typeof v === 'string') : [],
          };
          if (fund.code) normalized.push(fund);
        }
        if (normalized.length === 0) { alert('导入失败：没有可用的基金数据'); return; }
        const merged = [...funds];
        for (const incoming of normalized) {
          const idx = merged.findIndex(f => f.id === incoming.id || f.code === incoming.code);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...incoming, id: merged[idx].id };
          else merged.push(incoming);
        }
        setFunds(merged);
      } catch { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }, [funds, setFunds]);

  const handleFRefresh = useCallback(async () => {
    await refreshFP();
    const { funds: f, navs: n } = useFundStore.getState();
    checkFundAlerts(f, n);
    useValueHistoryStore.getState().recordSnapshot();
    usePnlCalendarStore.getState().recordToday();
    refreshHistoryNAVs();
  }, [refreshFP, refreshHistoryNAVs]);

  const hasStocks = stocks.length > 0;
  const hasFunds = funds.length > 0;
  const hasAny = hasStocks || hasFunds;

  return (
    <>
      {/* ====== 股票持仓 ====== */}
      {hasStocks && <SummaryCards stocks={stocks} prices={prices} />}
      <Toolbar
        addLabel="添加股票"
        onAdd={() => { setSEditingId(null); setSShowForm(true); }}
        onExportJSON={handleSExportJSON}
        onExportCSV={handleSExportCSV}
        onImport={handleSImport}
        loading={sLoading}
        error={sError}
        count={stocks.length}
        onRefresh={handleSRefresh}
        showDca={() => setShowDca(true)}
        showSim={() => setShowSim(true)}
        privacyMode={privacyMode}
        onTogglePrivacy={() => setPrivacyMode(p => !p)}
        filterTag={stockFilterTag || undefined}
        availableTags={[...new Set(stocks.map(s => s.tags).flat())].sort()}
        onFilterTagChange={setStockFilterTag}
      />

      <StockTable onEdit={handleSEdit} onDelete={handleSDelete} hideNames={privacyMode} filterTag={stockFilterTag || undefined} loading={sLoading} />

      {sShowForm && (
        <StockForm key={sEditingId ?? 'new-stock'} stock={sEditing} onSave={handleSSave} onClose={handleSClose} />
      )}

      {/* ====== 基金持仓 ====== */}
      <div style={{ borderTop: hasStocks ? '2px solid var(--border-heavy)' : 'none', margin: hasStocks ? '24px 0 16px' : '0' }} />
      {hasFunds && <FundSummaryCards funds={funds} navs={navs} />}
      <Toolbar
        addLabel="添加基金"
        onAdd={() => { setFEditingId(null); setFShowForm(true); }}
        onExportJSON={handleFExportJSON}
        onExportCSV={handleFExportCSV}
        onImport={handleFImport}
        loading={fLoading}
        error={fError}
        count={funds.length}
        onRefresh={handleFRefresh}
        privacyMode={privacyMode}
        onTogglePrivacy={() => setPrivacyMode(p => !p)}
        filterTag={fundFilterTag || undefined}
        availableTags={[...new Set(funds.map(f => f.tags).flat())].sort()}
        onFilterTagChange={setFundFilterTag}
      />

      <FundTable onEdit={handleFEdit} onDelete={handleFDelete} hideNames={privacyMode} filterTag={fundFilterTag || undefined} loading={fLoading} />

      {fShowForm && (
        <FundForm key={fEditingId ?? 'new-fund'} fund={fEditing} onSave={handleFSave} onClose={handleFClose} />
      )}

      {/* ====== 图表和分析（可折叠）====== */}
      {hasAny && (
        <>
          <div style={{ borderTop: hasFunds ? '2px solid var(--border-heavy)' : 'none', margin: hasFunds ? '24px 0 16px' : '16px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setChartsExpanded(v => !v)}
              style={{
                border: '1px solid var(--border-heavy)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                padding: '4px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {chartsExpanded ? '▼ 收起图表' : '▶ 展开图表'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {chartsExpanded ? '资产配置 · 市值趋势 · 行业分布 · 阵容图 · 归因 · 集中度 · 基准对比' : '点击展开查看分析图表'}
            </span>
          </div>
          {chartsExpanded && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
                <PortfolioChart
                  stocks={[
                    ...stocks.map(s => {
                      const cp = prices[s.code] ?? 0;
                      return { name: s.name, value: cp * s.shares || s.holdingCost * s.shares };
                    }),
                    ...funds.map(f => {
                      const nav = navs[f.code] ?? 0;
                      const mv = nav > 0 && f.holdingCost > 0 ? (f.holdingAmount / f.holdingCost) * nav : f.holdingAmount;
                      return { name: f.name || f.code, value: mv };
                    }),
                  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value)}
                />
                <ValueTrendChart type={hasStocks ? 'stocks' : 'funds'} />
                <SectorChart />
                <FormationChart />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <ProfitAttribution type={hasStocks && hasFunds ? 'all' : hasStocks ? 'stocks' : 'funds'} />
                <ConcentrationPanel />
              </div>

              <div style={{ marginBottom: 20 }}>
                <BenchmarkChart />
              </div>
            </>
          )}
        </>
      )}

      {showDca && <Suspense fallback={null}><DcaCalculator onClose={() => setShowDca(false)} /></Suspense>}
      {showSim && <Suspense fallback={null}><StrategySimulator onClose={() => setShowSim(false)} /></Suspense>}
    </>
  );
}
