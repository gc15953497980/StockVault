import { useState, useEffect, useCallback } from 'react';
import StockView from './components/StockView';
import FundView from './components/FundView';
import { useAutoBackup } from './utils/autoBackup';
import styles from './App.module.css';

type Tab = 'stocks' | 'funds';

function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('stockvault_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('stocks');
  const [theme, setTheme] = useState<'light' | 'dark'>(getTheme);

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

  useAutoBackup();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>StockVault</h1>
        <span className={styles.subtitle}>持仓管理</span>
        <button className={styles.themeToggle} onClick={toggleTheme}>
          {theme === 'light' ? '🌙 暗色' : '☀️ 亮色'}
        </button>
      </header>

      <nav className={styles.tabs}>
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
      </nav>

      {activeTab === 'stocks' ? <StockView /> : <FundView />}
    </div>
  );
}
