import { create } from 'zustand';
import { useStockStore } from './useStockStore';
import { useFundStore } from './useFundStore';

interface HistoryPoint {
  time: number;
  stockValue: number;
  fundValue: number;
  totalValue: number;
}

interface ValueHistoryStore {
  history: HistoryPoint[];
  recordSnapshot: () => void;
  clearHistory: () => void;
  setHistory: (history: HistoryPoint[]) => void;
}

const STORAGE_KEY = 'stockvault_value_history';

function loadHistory(): HistoryPoint[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const arr = JSON.parse(data);
    // Keep last 180 days
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    return arr.filter((p: HistoryPoint) => p.time > cutoff);
  } catch { return []; }
}

function saveHistory(history: HistoryPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* quota exceeded, ignore */ }
}

export const useValueHistoryStore = create<ValueHistoryStore>((set, get) => ({
  history: loadHistory(),

  recordSnapshot: () => {
    const { stocks, prices } = useStockStore.getState();
    const { funds, navs } = useFundStore.getState();

    let stockValue = 0;
    for (const s of stocks) {
      const cp = prices[s.code] ?? 0;
      if (cp > 0) {
        stockValue += cp * s.shares;
      } else {
        stockValue += s.holdingCost * s.shares;
      }
    }

    let fundValue = 0;
    for (const f of funds) {
      const nav = navs[f.code] ?? 0;
      if (nav > 0 && f.holdingCost > 0) {
        fundValue += (f.holdingAmount / f.holdingCost) * nav;
      } else {
        fundValue += f.holdingAmount;
      }
    }

    const point: HistoryPoint = {
      time: Date.now(),
      stockValue,
      fundValue,
      totalValue: stockValue + fundValue,
    };

    const now = Date.now();
    const cutoff = now - 180 * 24 * 60 * 60 * 1000;
    const history = [
      ...get().history.filter((p) => p.time > cutoff),
      point,
    ];

    // Deduplicate within 10 minutes
    const deduped = [history[0]];
    for (let i = 1; i < history.length; i++) {
      if (history[i].time - deduped[deduped.length - 1].time > 10 * 60 * 1000) {
        deduped.push(history[i]);
      } else {
        // Replace with latest
        deduped[deduped.length - 1] = history[i];
      }
    }

    saveHistory(deduped);
    set({ history: deduped });
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistory([]);
  },

  setHistory: (history) => {
    saveHistory(history);
    set({ history });
  },
}));
