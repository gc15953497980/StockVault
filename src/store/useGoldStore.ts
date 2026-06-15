import { create } from 'zustand';
import {
  fetchGoldSpot,
  fetchUsdCny,
  fetchGoldKline,
  GOLD_MINING_STOCKS,
} from '../utils/goldApi';
import { fetchStockPrices } from '../utils/api';
import type { GoldKlinePoint } from '../types';

interface MiningStockInfo {
  price: number;
  changePercent: number;
  name: string;
}

interface GoldStore {
  // Gold spot price
  goldPrice: number;
  goldPrevClose: number;
  goldChangePercent: number;
  goldTimestamp: number;

  // USD/CNY rate
  usdCnyRate: number;
  usdCnyPrevClose: number;

  // AISC (user-configurable, persisted)
  aisc: number;

  // Historical K-line
  goldHistory: GoldKlinePoint[];

  // Mining stock prices
  miningStockPrices: Record<string, MiningStockInfo>;

  // State
  loading: boolean;
  error: string | null;

  // Actions
  refreshAll: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  setAisc: (value: number) => void;
}

function loadAisc(): number {
  const raw = localStorage.getItem('stockvault_gold_aisc');
  if (raw) {
    const v = parseFloat(raw);
    if (v >= 800 && v <= 2500) return v;
  }
  return 1400; // default: $1400/oz (2024-2025 industry average)
}

export const useGoldStore = create<GoldStore>((set) => ({
  goldPrice: 0,
  goldPrevClose: 0,
  goldChangePercent: 0,
  goldTimestamp: 0,

  usdCnyRate: 0,
  usdCnyPrevClose: 0,

  aisc: loadAisc(),

  goldHistory: [],

  miningStockPrices: {},

  loading: false,
  error: null,

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      const [goldResult, forexResult, stockResult] = await Promise.all([
        fetchGoldSpot(),
        fetchUsdCny(),
        fetchStockPrices(GOLD_MINING_STOCKS.map(s => s.code)),
      ]);

      const miningStockPrices: Record<string, MiningStockInfo> = {};
      for (const s of GOLD_MINING_STOCKS) {
        if (stockResult[s.code]) {
          miningStockPrices[s.code] = {
            price: stockResult[s.code].price,
            changePercent: stockResult[s.code].changePercent,
            name: s.name,
          };
        }
      }

      set({
        goldPrice: goldResult?.price ?? 0,
        goldPrevClose: goldResult?.prevClose ?? 0,
        goldChangePercent: goldResult?.changePercent ?? 0,
        goldTimestamp: goldResult?.timestamp ?? 0,
        usdCnyRate: forexResult?.rate ?? 0,
        usdCnyPrevClose: forexResult?.prevClose ?? 0,
        miningStockPrices,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchHistory: async () => {
    const history = await fetchGoldKline(200);
    set({ goldHistory: history });
  },

  setAisc: (value: number) => {
    const clamped = Math.max(800, Math.min(2500, Math.round(value / 10) * 10));
    localStorage.setItem('stockvault_gold_aisc', String(clamped));
    set({ aisc: clamped });
  },
}));
