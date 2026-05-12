import { create } from 'zustand';
import type { DailyPnl } from '../types';
import { useStockStore } from './useStockStore';
import { useFundStore } from './useFundStore';

interface PnlCalendarStore {
  records: DailyPnl[];
  recordToday: () => void;
  setRecords: (records: DailyPnl[]) => void;
}

const STORAGE_KEY = 'stockvault_pnl_calendar';

function load(): DailyPnl[] {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (!d) return [];
    const arr: DailyPnl[] = JSON.parse(d);
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return arr.filter(r => new Date(r.date).getTime() > cutoff);
  } catch { return []; }
}

function save(records: DailyPnl[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}

export const usePnlCalendarStore = create<PnlCalendarStore>((set, get) => ({
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

    const today = new Date().toISOString().slice(0, 10);
    const pnl = totalValue - totalCost;
    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    const records = get().records.filter(r => r.date !== today);
    records.push({ date: today, pnl, pnlPercent });

    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = records.filter(r => new Date(r.date).getTime() > cutoff);
    save(filtered);
    set({ records: filtered });
  },

  setRecords: (records) => {
    save(records);
    set({ records });
  },
}));
