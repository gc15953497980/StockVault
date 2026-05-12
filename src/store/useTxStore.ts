import { create } from 'zustand';
import type { StockTx, FundTx, StockDividend, FundDividend } from '../types';
import { pushToGist } from '../utils/gistSync';

function autoSyncPush() {
  if (localStorage.getItem('stockvault_sync_auto') === '1') {
    pushToGist().catch(() => {});
  }
}

interface TxStore {
  stockTxs: Record<string, StockTx[]>;
  fundTxs: Record<string, FundTx[]>;
  stockDividends: Record<string, StockDividend[]>;
  fundDividends: Record<string, FundDividend[]>;

  addStockTx: (stockId: string, tx: StockTx) => void;
  deleteStockTx: (stockId: string, txId: string) => void;
  addFundTx: (fundId: string, tx: FundTx) => void;
  deleteFundTx: (fundId: string, txId: string) => void;
  addStockDividend: (stockId: string, d: StockDividend) => void;
  deleteStockDividend: (stockId: string, dId: string) => void;
  addFundDividend: (fundId: string, d: FundDividend) => void;
  deleteFundDividend: (fundId: string, dId: string) => void;
  setAllData: (data: {
    stockTxs?: Record<string, StockTx[]>;
    fundTxs?: Record<string, FundTx[]>;
    stockDividends?: Record<string, StockDividend[]>;
    fundDividends?: Record<string, FundDividend[]>;
  }) => void;
}

const STOCK_TX_KEY = 'stockvault_stock_txs';
const FUND_TX_KEY = 'stockvault_fund_txs';
const STOCK_DIV_KEY = 'stockvault_stock_divs';
const FUND_DIV_KEY = 'stockvault_fund_divs';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
}

function saveJSON(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded, ignore */ }
  autoSyncPush();
}

export const useTxStore = create<TxStore>((set, get) => ({
  stockTxs: loadJSON(STOCK_TX_KEY, {}),
  fundTxs: loadJSON(FUND_TX_KEY, {}),
  stockDividends: loadJSON(STOCK_DIV_KEY, {}),
  fundDividends: loadJSON(FUND_DIV_KEY, {}),

  addStockTx: (stockId, tx) => {
    const txs = { ...get().stockTxs };
    if (!txs[stockId]) txs[stockId] = [];
    txs[stockId] = [...txs[stockId], tx].sort((a, b) => b.date.localeCompare(a.date));
    saveJSON(STOCK_TX_KEY, txs);
    set({ stockTxs: txs });
  },

  deleteStockTx: (stockId, txId) => {
    const txs = { ...get().stockTxs };
    if (txs[stockId]) txs[stockId] = txs[stockId].filter((t) => t.id !== txId);
    saveJSON(STOCK_TX_KEY, txs);
    set({ stockTxs: txs });
  },

  addFundTx: (fundId, tx) => {
    const txs = { ...get().fundTxs };
    if (!txs[fundId]) txs[fundId] = [];
    txs[fundId] = [...txs[fundId], tx].sort((a, b) => b.date.localeCompare(a.date));
    saveJSON(FUND_TX_KEY, txs);
    set({ fundTxs: txs });
  },

  deleteFundTx: (fundId, txId) => {
    const txs = { ...get().fundTxs };
    if (txs[fundId]) txs[fundId] = txs[fundId].filter((t) => t.id !== txId);
    saveJSON(FUND_TX_KEY, txs);
    set({ fundTxs: txs });
  },

  addStockDividend: (stockId, d) => {
    const divs = { ...get().stockDividends };
    if (!divs[stockId]) divs[stockId] = [];
    divs[stockId] = [...divs[stockId], d].sort((a, b) => b.date.localeCompare(a.date));
    saveJSON(STOCK_DIV_KEY, divs);
    set({ stockDividends: divs });
  },

  deleteStockDividend: (stockId, dId) => {
    const divs = { ...get().stockDividends };
    if (divs[stockId]) divs[stockId] = divs[stockId].filter((d) => d.id !== dId);
    saveJSON(STOCK_DIV_KEY, divs);
    set({ stockDividends: divs });
  },

  addFundDividend: (fundId, d) => {
    const divs = { ...get().fundDividends };
    if (!divs[fundId]) divs[fundId] = [];
    divs[fundId] = [...divs[fundId], d].sort((a, b) => b.date.localeCompare(a.date));
    saveJSON(FUND_DIV_KEY, divs);
    set({ fundDividends: divs });
  },

  deleteFundDividend: (fundId, dId) => {
    const divs = { ...get().fundDividends };
    if (divs[fundId]) divs[fundId] = divs[fundId].filter((d) => d.id !== dId);
    saveJSON(FUND_DIV_KEY, divs);
    set({ fundDividends: divs });
  },

  setAllData: (data) => {
    const state: Partial<TxStore> = {};
    if (data.stockTxs) { saveJSON(STOCK_TX_KEY, data.stockTxs); state.stockTxs = data.stockTxs; }
    if (data.fundTxs) { saveJSON(FUND_TX_KEY, data.fundTxs); state.fundTxs = data.fundTxs; }
    if (data.stockDividends) { saveJSON(STOCK_DIV_KEY, data.stockDividends); state.stockDividends = data.stockDividends; }
    if (data.fundDividends) { saveJSON(FUND_DIV_KEY, data.fundDividends); state.fundDividends = data.fundDividends; }
    if (Object.keys(state).length > 0) set(state as TxStore);
  },
}));
