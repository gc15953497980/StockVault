import { create } from 'zustand';
import type { Stock, StockWithPrice } from '../types';
import { fetchStockPrices } from '../utils/api';
import { pushToGist } from '../utils/gistSync';

function autoSyncPush() {
  if (localStorage.getItem('stockvault_sync_auto') === '1') {
    pushToGist().catch(() => {});
  }
}

interface StockStore {
  stocks: Stock[];
  prices: Record<string, number>;
  marketCaps: Record<string, number>;
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

function loadStocks(): Stock[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const stocks = JSON.parse(data);
    for (const s of stocks) {
      if (s.targetMarketValue === undefined) {
        s.targetMarketValue = 0;
      }
      if (s.marketCap === undefined) {
        s.marketCap = 0;
      }
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

export const useStockStore = create<StockStore>((set, get) => ({
  stocks: loadStocks(),
  prices: {},
  marketCaps: {},
  timestamps: {},
  loading: false,
  error: null,

  addStock: (stock) => {
    const stocks = [...get().stocks, stock];
    saveStocks(stocks);
    set({ stocks });
    autoSyncPush();
  },

  setStocks: (stocks) => {
    saveStocks(stocks);
    set({ stocks });
    autoSyncPush();
  },

  updateStock: (stock) => {
    const stocks = get().stocks.map((s) => (s.id === stock.id ? stock : s));
    saveStocks(stocks);
    set({ stocks });
    autoSyncPush();
  },

  deleteStock: (id) => {
    const stocks = get().stocks.filter((s) => s.id !== id);
    saveStocks(stocks);
    set({ stocks });
    autoSyncPush();
  },

  refreshPrices: async () => {
    const { stocks } = get();
    if (stocks.length === 0) return;

    set({ loading: true, error: null });
    try {
      const codes = stocks.map((s) => s.code);
      const result = await fetchStockPrices(codes);
      const prices: Record<string, number> = {};
      const marketCaps: Record<string, number> = {};
      const timestamps: Record<string, number> = {};
      for (const code of codes) {
        if (result[code]) {
          prices[code] = result[code].price;
          marketCaps[code] = result[code].marketCap;
          timestamps[code] = Date.now();
        }
      }
      set({ prices, marketCaps, timestamps, loading: false });
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
}));
