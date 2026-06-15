import { useState, useEffect, useCallback, useRef } from 'react';
import HoldingsView from './components/HoldingsView';
import SyncPanel from './components/SyncPanel';
import Dashboard from './components/Dashboard';
import WatchlistView from './components/WatchlistView';
import GoldCostView from './components/GoldCostView';
import AccountSwitcher from './components/AccountSwitcher';
import ShortcutHelp from './components/ShortcutHelp';
import { useAutoBackup } from './utils/autoBackup';
import { storage } from './utils/storage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePnlCalendarStore } from './store/usePnlCalendarStore';
import { useValueHistoryStore } from './store/useValueHistoryStore';
import { useStockStore } from './store/useStockStore';
import { useFundStore } from './store/useFundStore';
import { useAccountStore } from './store/useAccountStore';
import styles from './App.module.css';

type Tab = 'dashboard' | 'holdings' | 'watchlist' | 'goldcost';

const TAB_INFO: { key: Tab; label: string; shortcut: string }[] = [
  { key: 'dashboard', label: '概览', shortcut: '1' },
  { key: 'holdings', label: '持仓', shortcut: '2' },
  { key: 'watchlist', label: '关注', shortcut: '3' },
  { key: 'goldcost', label: '金矿', shortcut: '4' },
];

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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const activeAccountId = useAccountStore(s => s.activeAccountId);
  const accounts = useAccountStore(s => s.accounts);
  const currentAccountName = activeAccountId === 'default' ? '总计' : accounts.find(a => a.id === activeAccountId)?.name ?? '总计';

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

  // Migrate localStorage to IndexedDB on startup (one-time)
  useEffect(() => {
    storage.migrateFromLS().catch(() => {});
  }, []);

  // Market-close snapshot + initial PnL recording
  // (Periodic price refresh is handled by useAutoRefresh in Toolbar)
  useEffect(() => {
    async function refreshAndRecord() {
      try {
        await Promise.all([
          useStockStore.getState().refreshPrices(),
          useFundStore.getState().refreshPrices(),
        ]);
      } catch { /* ignore */ }
      useValueHistoryStore.getState().recordSnapshot();
      usePnlCalendarStore.getState().recordToday();
    }

    // Check if within market-close window (15:00-15:10 Beijing time)
    function isMarketCloseWindow(): boolean {
      const now = new Date();
      const hour = parseInt(new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        hour12: false,
      }).format(now), 10);
      const minute = parseInt(new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Shanghai',
        minute: '2-digit',
      }).format(now), 10);
      return hour === 15 && minute >= 0 && minute < 10;
    }

    let marketCloseRecorded = false;

    // Market close watcher: check every minute for 15:00-15:10 Beijing time
    const closeTimer = setInterval(() => {
      if (isMarketCloseWindow() && !marketCloseRecorded) {
        marketCloseRecorded = true;
        refreshAndRecord();
      }
      if (!isMarketCloseWindow()) {
        marketCloseRecorded = false;
      }
    }, 60_000);

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

    return () => {
      clearInterval(closeTimer);
      clearInterval(initTimer);
    };
  }, []);

  useKeyboardShortcuts({
    '1': () => setActiveTab('dashboard'),
    '2': () => setActiveTab('holdings'),
    '3': () => setActiveTab('watchlist'),
    '4': () => setActiveTab('goldcost'),
    '?': () => setShowShortcuts(v => !v),
  });

  // Close more menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  // Esc to close shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>StockVault</h1>
        <span className={styles.subtitle}>持仓管理{currentAccountName !== '总计' ? ` · ${currentAccountName}` : ''}</span>
        <AccountSwitcher />
        <SyncPanel onDataChanged={handleSyncDataChanged} />
        <div className={styles.moreWrap} ref={moreRef}>
          <button
            className={styles.moreBtn}
            onClick={() => setShowMoreMenu(v => !v)}
            aria-label="更多操作"
            aria-expanded={showMoreMenu}
          >
            ···
          </button>
          {showMoreMenu && (
            <div className={styles.moreDropdown}>
              <button
                className={styles.moreItem}
                onClick={() => { toggleTheme(); setShowMoreMenu(false); }}
                aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
              >
                {theme === 'light' ? '🌙 暗色模式' : '☀️ 亮色模式'}
              </button>
              <button
                className={styles.moreItem}
                onClick={() => { setShowShortcuts(true); setShowMoreMenu(false); }}
              >
                ⌨ 快捷键 (?)
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="主导航">
        {TAB_INFO.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
            title={`${t.label} (快捷键 ${t.shortcut})`}
          >
            {t.label}
            <span className={styles.shortcutHint}>{t.shortcut}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'holdings' && <HoldingsView key={`holdings-${syncKey}`} />}
      {activeTab === 'watchlist' && <WatchlistView />}
      {activeTab === 'goldcost' && <GoldCostView />}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
