import { useState, useEffect, useCallback } from 'react';
import HoldingsView from './components/HoldingsView';
import SyncPanel from './components/SyncPanel';
import Dashboard from './components/Dashboard';
import WatchlistView from './components/WatchlistView';
import AccountSwitcher from './components/AccountSwitcher';
import ShortcutHelp from './components/ShortcutHelp';
import { useAutoBackup } from './utils/autoBackup';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePnlCalendarStore } from './store/usePnlCalendarStore';
import { useValueHistoryStore } from './store/useValueHistoryStore';
import { useStockStore } from './store/useStockStore';
import { useFundStore } from './store/useFundStore';
import styles from './App.module.css';

type Tab = 'dashboard' | 'holdings' | 'watchlist';

function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('stockvault_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(getTheme);
  const [syncKey, setSyncKey] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stockvault_theme', theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (!localStorage.getItem('stockvault_theme')) {
        setTheme(mq.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const handleSyncDataChanged = useCallback(() => {
    setSyncKey((k) => k + 1);
  }, []);

  useAutoBackup();

  // Periodic auto-refresh + daily PnL snapshot (runs regardless of active tab)
  useEffect(() => {
    const INTERVAL = 30 * 60 * 1000; // 30 minutes

    async function refreshAndRecord() {
      if (document.hidden) return;
      try {
        await Promise.all([
          useStockStore.getState().refreshPrices(),
          useFundStore.getState().refreshPrices(),
        ]);
      } catch { /* ignore */ }
      useValueHistoryStore.getState().recordSnapshot();
      usePnlCalendarStore.getState().recordToday();
    }

    // Record initial snapshot after prices load
    let attempts = 0;
    const initTimer = setInterval(() => {
      attempts++;
      const { stocks, prices } = useStockStore.getState();
      const hasPrices = stocks.length === 0 || Object.keys(prices).length > 0;
      if (hasPrices || attempts >= 30) {
        clearInterval(initTimer);
        usePnlCalendarStore.getState().recordToday();
      }
    }, 2000);

    // Periodic refresh
    const periodicTimer = setInterval(refreshAndRecord, INTERVAL);

    return () => {
      clearInterval(initTimer);
      clearInterval(periodicTimer);
    };
  }, []);

  useKeyboardShortcuts({
    '1': () => setActiveTab('holdings'),
    '2': () => setActiveTab('watchlist'),
    '3': () => setActiveTab('dashboard'),
    '?': () => setShowShortcuts(v => !v),
  });

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>StockVault</h1>
        <span className={styles.subtitle}>持仓管理</span>
        <AccountSwitcher />
        <SyncPanel onDataChanged={handleSyncDataChanged} />
        <button className={styles.themeToggle} onClick={toggleTheme}>
          {theme === 'light' ? '🌙 暗色' : '☀️ 亮色'}
        </button>
        <button className={styles.shortcutHelp} onClick={() => setShowShortcuts(true)} title="快捷键">
          ?
        </button>
      </header>

      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dashboard' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          概览
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'holdings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('holdings')}
        >
          持仓
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'watchlist' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('watchlist')}
        >
          关注
        </button>
      </nav>

      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'holdings' && <HoldingsView key={`holdings-${syncKey}`} />}
      {activeTab === 'watchlist' && <WatchlistView />}

      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
