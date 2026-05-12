import { create } from 'zustand';
import type { Fund, FundWithPrice } from '../types';
import { fetchFundPrices } from '../utils/api';
import { pushToGist } from '../utils/gistSync';

function autoSyncPush() {
  if (localStorage.getItem('stockvault_sync_auto') === '1') {
    pushToGist().catch(() => {});
  }
}

interface FundStore {
  funds: Fund[];
  navs: Record<string, number>;
  accumulatedNAVs: Record<string, number>;
  dailyChanges: Record<string, number>;
  dailyChangePercents: Record<string, number>;
  timestamps: Record<string, number>;
  loading: boolean;
  error: string | null;

  addFund: (fund: Fund) => void;
  setFunds: (funds: Fund[]) => void;
  updateFund: (fund: Fund) => void;
  deleteFund: (id: string) => void;
  refreshPrices: () => Promise<void>;
  getFundWithPrice: (fund: Fund) => FundWithPrice;
}

const STORAGE_KEY = 'stockvault_funds';

function loadFunds(): Fund[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const funds = JSON.parse(data);
    for (const f of funds) {
      if (f.holdingAmount === undefined) {
        f.holdingAmount = f.shares ?? 0;
      }
      if (f.holdingCost === undefined) {
        f.holdingCost = 0;
      }
    }
    return funds;
  } catch {
    return [];
  }
}

function saveFunds(funds: Fund[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(funds));
}

export const useFundStore = create<FundStore>((set, get) => ({
  funds: loadFunds(),
  navs: {},
  accumulatedNAVs: {},
  dailyChanges: {},
  dailyChangePercents: {},
  timestamps: {},
  loading: false,
  error: null,

  addFund: (fund) => {
    const funds = [...get().funds, fund];
    saveFunds(funds);
    set({ funds });
    autoSyncPush();
  },

  setFunds: (funds) => {
    saveFunds(funds);
    set({ funds });
    autoSyncPush();
  },

  updateFund: (fund) => {
    const funds = get().funds.map((f) => (f.id === fund.id ? fund : f));
    saveFunds(funds);
    set({ funds });
    autoSyncPush();
  },

  deleteFund: (id) => {
    const funds = get().funds.filter((f) => f.id !== id);
    saveFunds(funds);
    set({ funds });
    autoSyncPush();
  },

  refreshPrices: async () => {
    const { funds } = get();
    if (funds.length === 0) return;

    set({ loading: true, error: null });
    try {
      const codes = funds.map((f) => f.code);
      const result = await fetchFundPrices(codes);
      const navs: Record<string, number> = {};
      const accumulatedNAVs: Record<string, number> = {};
      const dailyChanges: Record<string, number> = {};
      const dailyChangePercents: Record<string, number> = {};
      const timestamps: Record<string, number> = {};
      let nameUpdated = false;
      const updatedFunds = funds.map((f) => {
        const data = result[f.code];
        if (data) {
          navs[f.code] = data.currentNAV;
          accumulatedNAVs[f.code] = data.accumulatedNAV;
          dailyChanges[f.code] = data.dailyChange;
          dailyChangePercents[f.code] = data.dailyChangePercent;
          timestamps[f.code] = Date.now();
          if (!f.name && data.name) {
            nameUpdated = true;
            return { ...f, name: data.name };
          }
        }
        return f;
      });
      if (nameUpdated) {
        saveFunds(updatedFunds);
      }
      set({
        funds: nameUpdated ? updatedFunds : funds,
        navs,
        accumulatedNAVs,
        dailyChanges,
        dailyChangePercents,
        timestamps,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  getFundWithPrice: (fund) => {
    const { navs, accumulatedNAVs, dailyChanges, dailyChangePercents, timestamps } = get();
    return {
      ...fund,
      currentNAV: navs[fund.code] ?? 0,
      accumulatedNAV: accumulatedNAVs[fund.code] ?? 0,
      dailyChange: dailyChanges[fund.code] ?? 0,
      dailyChangePercent: dailyChangePercents[fund.code] ?? 0,
      timestamp: timestamps[fund.code] ?? 0,
    };
  },
}));
