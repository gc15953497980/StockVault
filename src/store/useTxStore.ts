import { create } from 'zustand';
import type { StockTx, FundTx, StockDividend, FundDividend } from '../types';

interface TxStore {
  stockTxs: Record<string, StockTx[]>;
  fundTxs: Record<string, FundTx[]>;
  stockDividends: Record<string, StockDividend[]>;
  fundDividends: Record<string, FundDividend[]>;

  addStockTx: (stockId: string, tx: StockTx) => void;
  deleteStockTx: (stockId: string, txId: string) => void;
  updateStockHoldings: (stockId: string) => {
    totalShares: number;
    totalCost: number;
  } | null;
  addFundTx: (fundId: string, tx: FundTx) => void;
  deleteFundTx: (fundId: string, txId: string) => void;
  addStockDividend: (stockId: string, d: StockDividend) => void;
  deleteStockDividend: (stockId: string, dId: string) => void;
  addFundDividend: (fundId: string, d: FundDividend) => void;
  deleteFundDividend: (fundId: string, dId: string) => void;
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
  localStorage.setItem(key, JSON.stringify(data));
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

  updateStockHoldings: (stockId) => {
    const txs = get().stockTxs[stockId] || [];
    if (txs.length === 0) return null;
    let totalShares = 0;
    let totalCost = 0;
    for (const tx of [...txs].reverse()) {
      if (tx.type === 'buy') {
        totalCost += tx.price * tx.shares;
        totalShares += tx.shares;
      } else {
        if (totalShares > 0) {
          const avgCost = totalCost / totalShares;
          const sellShares = Math.min(tx.shares, totalShares);
          totalShares -= sellShares;
          totalCost = totalShares * avgCost;
        }
      }
    }
    if (totalShares <= 0) return null;
    return { totalShares, totalCost };
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
}));
