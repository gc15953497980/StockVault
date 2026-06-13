import { create } from 'zustand';
import type { DailyPnl } from '../types';
import { useStockStore } from './useStockStore';
import { useFundStore } from './useFundStore';
import { useAccountStore } from './useAccountStore';

interface PnlCalendarStore {
  records: DailyPnl[];
  recordToday: () => void;
  setRecords: (records: DailyPnl[]) => void;
}

const BASE_KEY = 'stockvault_pnl_calendar';
const MIGRATED_KEY = 'stockvault_pnl_migrated_v2';

function getKey(): string {
  const accountId = useAccountStore.getState().activeAccountId;
  return accountId === 'default' ? BASE_KEY : `${BASE_KEY}_${accountId}`;
}

function load(): DailyPnl[] {
  try {
    const d = localStorage.getItem(getKey());
    if (!d) return [];
    const arr: DailyPnl[] = JSON.parse(d);
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = arr.filter(r => new Date(r.date).getTime() > cutoff);
    // Sort by date for migration
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    // Migrate: convert cumulative PnL to daily change
    if (filtered.length > 1 && !localStorage.getItem(MIGRATED_KEY)) {
      for (let i = filtered.length - 1; i > 0; i--) {
        filtered[i].pnl = filtered[i].pnl - filtered[i - 1].pnl;
      }
      // First record stays as-is (becomes initial daily baseline)
      save(filtered);
      localStorage.setItem(MIGRATED_KEY, '1');
    }
    return filtered;
  } catch { return []; }
}

function save(records: DailyPnl[]) {
  try { localStorage.setItem(getKey(), JSON.stringify(records)); } catch { /* ignore */ }
}

export const usePnlCalendarStore = create<PnlCalendarStore>((set, get) => {
  useAccountStore.subscribe(() => {
    set({ records: load() });
  });

  return {
    records: load(),

    recordToday: () => {
      const { stocks, prices } = useStockStore.getState();
      const { funds, navs } = useFundStore.getState();

      let totalValue = 0;
      let totalCost = 0;

      for (const s of stocks) {
        const cp = prices[s.code] ?? 0;
        const mv = cp * s.shares || s.holdingCost * s.shares;
        totalValue += mv;
        totalCost += s.holdingCost * s.shares;
      }

      for (const f of funds) {
        const nav = navs[f.code] ?? 0;
        const mv = nav > 0 && f.holdingCost > 0 ? (f.holdingAmount / f.holdingCost) * nav : f.holdingAmount;
        totalValue += mv;
        totalCost += f.holdingAmount;
      }

      if (totalCost <= 0) return; // No holdings, nothing to record

      const today = new Date().toISOString().slice(0, 10);
      const todayCumulative = totalValue - totalCost;

      // Find most recent previous record to compute daily change
      const prevRecords = get().records
        .filter(r => r.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));

      // Reconstruct cumulative from previous daily-change records
      let prevCumulative = 0;
      for (const r of get().records.filter(r => r.date < today).sort((a, b) => a.date.localeCompare(b.date))) {
        prevCumulative += r.pnl;
      }

      const dailyPnl = prevRecords.length > 0 ? todayCumulative - prevCumulative : todayCumulative;
      const dailyPnlPercent = totalCost > 0 ? (dailyPnl / totalCost) * 100 : 0;

      const records = get().records.filter(r => r.date !== today);
      records.push({ date: today, pnl: dailyPnl, pnlPercent: dailyPnlPercent });

      const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const filtered = records.filter(r => new Date(r.date).getTime() > cutoff);
      filtered.sort((a, b) => a.date.localeCompare(b.date));
      save(filtered);
      set({ records: filtered });
    },

    setRecords: (records) => {
      records.sort((a, b) => a.date.localeCompare(b.date));
      save(records);
      set({ records });
    },
  };
});
