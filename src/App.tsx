import { useState, useEffect, useCallback } from 'react';
import StockView from './components/StockView';
import FundView from './components/FundView';
import SyncPanel from './components/SyncPanel';
import Dashboard from './components/Dashboard';
import WatchlistView from './components/WatchlistView';
import AccountSwitcher from './components/AccountSwitcher';
import ShortcutHelp from './components/ShortcutHelp';
import { useAutoBackup } from './utils/autoBackup';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import styles from './App.module.css';

type Tab = 'dashboard' | 'stocks' | 'funds' | 'watchlist';

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

  useKeyboardShortcuts({
    '1': () => setActiveTab('stocks'),
    '2': () => setActiveTab('funds'),
    '3': () => setActiveTab('watchlist'),
    '4': () => setActiveTab('dashboard'),
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
          className={`${styles.tab} ${activeTab === 'stocks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          股票
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'funds' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('funds')}
        >
          基金
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'watchlist' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('watchlist')}
        >
          关注
        </button>
      </nav>

      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'stocks' && <StockView key={`stocks-${syncKey}`} />}
      {activeTab === 'funds' && <FundView key={`funds-${syncKey}`} />}
      {activeTab === 'watchlist' && <WatchlistView />}

      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
