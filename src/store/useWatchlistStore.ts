import { create } from 'zustand';
import type { WatchItem } from '../types';

interface WatchlistStore {
  items: WatchItem[];
  addItem: (item: WatchItem) => void;
  addItems: (items: WatchItem[]) => void;
  updateItem: (item: WatchItem) => void;
  deleteItem: (id: string) => void;
  setItems: (items: WatchItem[]) => void;
}

const STORAGE_KEY = 'stockvault_watchlist';

function load(): WatchItem[] {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function save(items: WatchItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  items: load(),

  addItem: (item) => {
    const items = [...get().items, item];
    save(items);
    set({ items });
  },

  addItems: (newItems) => {
    const items = [...get().items, ...newItems];
    save(items);
    set({ items });
  },

  updateItem: (item) => {
    const items = get().items.map(i => i.id === item.id ? item : i);
    save(items);
    set({ items });
  },

  deleteItem: (id) => {
    const items = get().items.filter(i => i.id !== id);
    save(items);
    set({ items });
  },

  setItems: (items) => {
    save(items);
    set({ items });
  },
}));
