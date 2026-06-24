import { create } from 'zustand';
import type { Fund, FundWithPrice } from '../types';
import { fetchFundPrices, fetchFundHistoryNAV, calcAvgDownside } from '../utils/api';
import { autoSyncPush } from '../utils/gistSync';
import { useAccountStore } from './useAccountStore';

interface FundStore {
  funds: Fund[];
  navs: Record<string, number>;
  accumulatedNAVs: Record<string, number>;
  dailyChanges: Record<string, number>;
  dailyChangePercents: Record<string, number>;
  timestamps: Record<string, number>;
  avgDownsides: Record<string, number>;
  loading: boolean;
  error: string | null;

  addFund: (fund: Fund) => void;
  setFunds: (funds: Fund[]) => void;
  updateFund: (fund: Fund) => void;
  deleteFund: (id: string) => void;
  refreshPrices: () => Promise<void>;
  refreshHistoryNAVs: () => Promise<void>;
  getFundWithPrice: (fund: Fund) => FundWithPrice;
}

const STORAGE_KEY = 'stockvault_funds';

function filterByAccount(funds: Fund[], accountId: string): Fund[] {
  if (accountId === 'default') return funds;
  return funds.filter(f => f.accountId === accountId);
}

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
      if (f.sector === undefined) f.sector = '';
      if (f.formation === undefined) f.formation = '';
      if (f.tags === undefined) f.tags = [];
      if (f.avgDownPrices === undefined) f.avgDownPrices = [];
    }
    return funds;
  } catch {
    return [];
  }
}

function saveFunds(funds: Fund[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(funds));
  } catch { /* quota exceeded, ignore */ }
}

export const useFundStore = create<FundStore>((set, get) => {
  const allFunds = loadFunds();
  const activeId = useAccountStore.getState().activeAccountId;

  // Subscribe to account changes to re-filter and refresh prices
  useAccountStore.subscribe((state) => {
    const filtered = filterByAccount(allFunds, state.activeAccountId);
    set({ funds: filtered });
    if (filtered.length > 0) {
      get().refreshPrices().catch(() => {});
    }
  });

  return {
    funds: filterByAccount(allFunds, activeId),
    navs: {},
    accumulatedNAVs: {},
    dailyChanges: {},
    dailyChangePercents: {},
    timestamps: {},
    avgDownsides: {},
    loading: false,
    error: null,

    addFund: (fund) => {
      const activeId = useAccountStore.getState().activeAccountId;
      const tagged = activeId !== 'default' ? { ...fund, accountId: activeId } : fund;
      const newAll = [...allFunds, tagged];
      allFunds.length = 0;
      allFunds.push(...newAll);
      saveFunds(newAll);
      set({ funds: filterByAccount(newAll, activeId) });
      autoSyncPush();
    },

    setFunds: (funds) => {
      allFunds.length = 0;
      allFunds.push(...funds);
      saveFunds(funds);
      set({ funds: filterByAccount(funds, useAccountStore.getState().activeAccountId) });
      autoSyncPush();
    },

    updateFund: (fund) => {
      const idx = allFunds.findIndex(f => f.id === fund.id);
      if (idx !== -1) {
        if (fund.accountId === undefined) {
          fund = { ...fund, accountId: allFunds[idx].accountId };
        }
        allFunds[idx] = fund;
      }
      saveFunds(allFunds);
      set({ funds: filterByAccount(allFunds, useAccountStore.getState().activeAccountId) });
      autoSyncPush();
    },

    deleteFund: (id) => {
      const idx = allFunds.findIndex(f => f.id === id);
      if (idx !== -1) allFunds.splice(idx, 1);
      saveFunds(allFunds);
      set({ funds: filterByAccount(allFunds, useAccountStore.getState().activeAccountId) });
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
        const updatedFunds = allFunds.map((f) => {
          const data = result[f.code];
          if (data) {
            if (codes.includes(f.code)) {
              navs[f.code] = data.currentNAV;
              accumulatedNAVs[f.code] = data.accumulatedNAV;
              dailyChanges[f.code] = data.dailyChange;
              dailyChangePercents[f.code] = data.dailyChangePercent;
              timestamps[f.code] = Date.now();
            }
            if (!f.name && data.name) {
              nameUpdated = true;
              return { ...f, name: data.name };
            }
          }
          return f;
        });
        if (nameUpdated) {
          allFunds.length = 0;
          allFunds.push(...updatedFunds);
          saveFunds(updatedFunds);
        }
        set({
          funds: nameUpdated
            ? filterByAccount(updatedFunds, useAccountStore.getState().activeAccountId)
            : funds,
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

    refreshHistoryNAVs: async () => {
      const { funds } = get();
      if (funds.length === 0) return;

      const avgDownsides: Record<string, number> = { ...get().avgDownsides };

      for (const fund of funds) {
        const history = await fetchFundHistoryNAV(fund.code);
        avgDownsides[fund.code] = calcAvgDownside(history);
      }

      set({ avgDownsides });
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
  };
});
