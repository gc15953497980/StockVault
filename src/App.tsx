import { useState } from 'react';
import StockView from './components/StockView';
import FundView from './components/FundView';
import styles from './App.module.css';

type Tab = 'stocks' | 'funds';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('stocks');

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>StockVault</h1>
        <span className={styles.subtitle}>持仓管理</span>
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
