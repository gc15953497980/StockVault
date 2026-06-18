import { create } from 'zustand';
import type { Stock, StockWithPrice } from '../types';
import { fetchStockPrices, fetchForeignPrices } from '../utils/api';
import type { Market } from '../types';
import { autoSyncPush } from '../utils/gistSync';
import { useAccountStore } from './useAccountStore';

interface StockStore {
  stocks: Stock[];
  prices: Record<string, number>;
  marketCaps: Record<string, number>;
  dailyChangePercents: Record<string, number>;
  timestamps: Record<string, number>;
  loading: boolean;
  error: string | null;

  addStock: (stock: Stock) => void;
  setStocks: (stocks: Stock[]) => void;
  updateStock: (stock: Stock) => void;
  deleteStock: (id: string) => void;
  refreshPrices: () => Promise<void>;
  getStockWithPrice: (stock: Stock) => StockWithPrice;
}

const STORAGE_KEY = 'stockvault_stocks';

function filterByAccount(stocks: Stock[], accountId: string): Stock[] {
  if (accountId === 'default') return stocks;
  return stocks.filter(s => s.accountId === accountId);
}

function loadStocks(): Stock[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const stocks = JSON.parse(data);
    for (const s of stocks) {
      if (s.formation === undefined) s.formation = '';
      if (s.targetMarketValue === undefined) s.targetMarketValue = 0;
      if (s.marketCap === undefined) s.marketCap = 0;
      if (s.tags === undefined) s.tags = [];
      if (s.market === undefined) s.market = 'a';
      if (s.type === undefined) s.type = 'stock';
      if (s.buyPrices === undefined) {
        s.buyPrices = [];
        s.buyShares = [];
        for (let i = 1; i <= 3; i++) {
          const bp = s[`batch${i}BuyPrice`];
          const bs = s[`batch${i}Shares`];
          if (bp !== undefined && bp > 0) {
            s.buyPrices.push(bp);
            s.buyShares.push(bs ?? 0);
          }
          delete s[`batch${i}BuyPrice`];
          delete s[`batch${i}Shares`];
        }
      }
      if (s.takeProfitPrices === undefined) {
        s.takeProfitPrices = [];
        s.takeProfitShares = [];
        for (let i = 1; i <= 3; i++) {
          const tp = s[`batch${i}TakeProfitPrice`];
          if (tp !== undefined && tp > 0) {
            s.takeProfitPrices.push(tp);
            s.takeProfitShares.push(0);
          }
          delete s[`batch${i}TakeProfitPrice`];
        }
      }
    }
    return stocks;
  } catch {
    return [];
  }
}

function saveStocks(stocks: Stock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

export const useStockStore = create<StockStore>((set, get) => {
  const allStocks = loadStocks();
  const activeId = useAccountStore.getState().activeAccountId;

  // Subscribe to account changes to re-filter and refresh prices
  useAccountStore.subscribe((state) => {
    const filtered = filterByAccount(allStocks, state.activeAccountId);
    set({ stocks: filtered });
    if (filtered.length > 0) {
      get().refreshPrices().catch(() => {});
    }
  });

  return {
    stocks: filterByAccount(allStocks, activeId),
    prices: {},
    marketCaps: {},
    dailyChangePercents: {},
    timestamps: {},
    loading: false,
    error: null,

    addStock: (stock) => {
      const activeId = useAccountStore.getState().activeAccountId;
      const tagged = activeId !== 'default' ? { ...stock, accountId: activeId } : stock;
      const newAll = [...allStocks, tagged];
      // Update the mutable allStocks reference
      allStocks.length = 0;
      allStocks.push(...newAll);
      saveStocks(newAll);
      set({ stocks: filterByAccount(newAll, activeId) });
      autoSyncPush();
    },

    setStocks: (stocks) => {
      allStocks.length = 0;
      allStocks.push(...stocks);
      saveStocks(stocks);
      set({ stocks: filterByAccount(stocks, useAccountStore.getState().activeAccountId) });
      autoSyncPush();
    },

    updateStock: (stock) => {
      const idx = allStocks.findIndex(s => s.id === stock.id);
      if (idx !== -1) {
        if (stock.accountId === undefined) {
          stock = { ...stock, accountId: allStocks[idx].accountId };
        }
        allStocks[idx] = stock;
      }
      saveStocks(allStocks);
      set({ stocks: filterByAccount(allStocks, useAccountStore.getState().activeAccountId) });
      autoSyncPush();
    },

    deleteStock: (id) => {
      const idx = allStocks.findIndex(s => s.id === id);
      if (idx !== -1) allStocks.splice(idx, 1);
      saveStocks(allStocks);
      set({ stocks: filterByAccount(allStocks, useAccountStore.getState().activeAccountId) });
      autoSyncPush();
    },

    refreshPrices: async () => {
      const { stocks } = get();
      if (stocks.length === 0) return;

      set({ loading: true, error: null });
      try {
        const aStocks = stocks.filter(s => s.market === 'a');
        const foreignStocks = stocks.filter(s => s.market === 'hk' || s.market === 'us');

        const prices: Record<string, number> = {};
        const marketCaps: Record<string, number> = {};
        const dailyChangePercents: Record<string, number> = {};
        const timestamps: Record<string, number> = {};

        // A-share via fetchStockPrices
        if (aStocks.length > 0) {
          const aCodes = aStocks.map(s => s.code);
          const aResult = await fetchStockPrices(aCodes);
          for (const code of aCodes) {
            if (aResult[code]) {
              prices[code] = aResult[code].price;
              marketCaps[code] = aResult[code].marketCap;
              dailyChangePercents[code] = aResult[code].changePercent;
              timestamps[code] = Date.now();
            }
          }
        }

        // HK/US via fetchForeignPrices
        if (foreignStocks.length > 0) {
          const foreignResult = await fetchForeignPrices(
            foreignStocks.map(s => ({ code: s.code, market: s.market as Market }))
          );
          for (const s of foreignStocks) {
            if (foreignResult[s.code]) {
              prices[s.code] = foreignResult[s.code].price;
              dailyChangePercents[s.code] = foreignResult[s.code].changePercent;
              timestamps[s.code] = Date.now();
            }
          }
        }

        set({ prices, marketCaps, dailyChangePercents, timestamps, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    getStockWithPrice: (stock) => {
      const { prices, timestamps } = get();
      return {
        ...stock,
        currentPrice: prices[stock.code] ?? 0,
        timestamp: timestamps[stock.code] ?? 0,
      };
    },
  };
});
