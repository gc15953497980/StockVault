import { create } from 'zustand';
import { useStockStore } from './useStockStore';
import { useFundStore } from './useFundStore';
import { useAccountStore } from './useAccountStore';
import { ls } from '../utils/storage';

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

const BASE_KEY = 'stockvault_value_history';

function getKey(): string {
  const accountId = useAccountStore.getState().activeAccountId;
  return accountId === 'default' ? BASE_KEY : `${BASE_KEY}_${accountId}`;
}

function loadHistory(): HistoryPoint[] {
  try {
    const data = localStorage.getItem(getKey());
    if (!data) return [];
    const arr = JSON.parse(data);
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    return arr.filter((p: HistoryPoint) => p.time > cutoff);
  } catch { return []; }
}

function saveHistory(history: HistoryPoint[]) {
  ls.set(getKey(), history);
}

export const useValueHistoryStore = create<ValueHistoryStore>((set, get) => {
  // Subscribe to account changes to reload history for new account
  useAccountStore.subscribe(() => {
    set({ history: loadHistory() });
  });

  return {
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
  };
});
