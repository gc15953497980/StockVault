import { create } from 'zustand';
import type { BenchmarkPoint } from '../types';
import { fetchBenchmark, type BenchmarkCode } from '../utils/benchmark';

interface BenchmarkStore {
  data: Record<string, BenchmarkPoint[]>;
  loading: boolean;
  selectedIndex: BenchmarkCode;
  fetchData: (code: BenchmarkCode) => Promise<void>;
  setSelectedIndex: (code: BenchmarkCode) => void;
  setData: (data: Record<string, BenchmarkPoint[]>) => void;
}

export const useBenchmarkStore = create<BenchmarkStore>((set, get) => ({
  data: {},
  loading: false,
  selectedIndex: '000300',

  fetchData: async (code) => {
    if (get().data[code]?.length) return;
    set({ loading: true });
    const points = await fetchBenchmark(code);
    set(s => ({
      data: { ...s.data, [code]: points },
      loading: false,
    }));
  },

  setSelectedIndex: (code) => {
    set({ selectedIndex: code });
    get().fetchData(code);
  },

  setData: (data) => set({ data }),
}));
