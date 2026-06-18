import { create } from 'zustand';
import type { Account } from '../types';
import { autoSyncPush } from '../utils/gistSync';

interface AccountStore {
  accounts: Account[];
  activeAccountId: string;
  addAccount: (name: string) => void;
  deleteAccount: (id: string) => void;
  setActiveAccount: (id: string) => void;
  setAccounts: (accounts: Account[]) => void;
}

const STORAGE_KEY = 'stockvault_accounts';
const ACTIVE_KEY = 'stockvault_active_account';

function load(): Account[] {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function save(accounts: Account[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)); } catch { /* ignore */ }
  autoSyncPush();
}

function getActive(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || 'default'; } catch { return 'default'; }
}

function setActive(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: load(),
  activeAccountId: getActive(),

  addAccount: (name) => {
    const id = Date.now().toString(36);
    const accounts = [...get().accounts, { id, name, createdAt: new Date().toISOString() }];
    save(accounts);
    set({ accounts });
  },

  deleteAccount: (id) => {
    // Remove account from list
    const accounts = get().accounts.filter(a => a.id !== id);
    save(accounts);

    // Clean up orphaned data for this account
    // Stocks
    const stocksKey = id === 'default' ? 'stockvault_stocks' : `stockvault_stocks_${id}`;
    localStorage.removeItem(stocksKey);
    const allStocksKey = 'stockvault_stocks';
    try {
      const allStocks = JSON.parse(localStorage.getItem(allStocksKey) || '[]') as { accountId?: string }[];
      localStorage.setItem(allStocksKey, JSON.stringify(allStocks.filter(s => s.accountId !== id)));
    } catch { /* ignore */ }

    // Funds
    const fundsKey = id === 'default' ? 'stockvault_funds' : `stockvault_funds_${id}`;
    localStorage.removeItem(fundsKey);
    const allFundsKey = 'stockvault_funds';
    try {
      const allFunds = JSON.parse(localStorage.getItem(allFundsKey) || '[]') as { accountId?: string }[];
      localStorage.setItem(allFundsKey, JSON.stringify(allFunds.filter(f => f.accountId !== id)));
    } catch { /* ignore */ }

    // Transactions
    const txPrefixes = ['stockvault_stock_txs', 'stockvault_fund_txs', 'stockvault_stock_divs', 'stockvault_fund_divs'];
    for (const prefix of txPrefixes) {
      if (id === 'default') {
        localStorage.removeItem(prefix);
      } else {
        localStorage.removeItem(`${prefix}_${id}`);
      }
    }

    // Value history & PnL calendar
    const vhKey = id === 'default' ? 'stockvault_value_history' : `stockvault_value_history_${id}`;
    localStorage.removeItem(vhKey);
    const pnlKey = id === 'default' ? 'stockvault_pnl_calendar' : `stockvault_pnl_calendar_${id}`;
    localStorage.removeItem(pnlKey);

    const activeId = get().activeAccountId;
    if (activeId === id) {
      const newActive = accounts.length > 0 ? accounts[0].id : 'default';
      setActive(newActive);
      set({ accounts, activeAccountId: newActive });
    } else {
      set({ accounts });
    }
  },

  setActiveAccount: (id) => {
    setActive(id);
    set({ activeAccountId: id });
  },

  setAccounts: (accounts) => {
    save(accounts);
    set({ accounts });
  },
}));
