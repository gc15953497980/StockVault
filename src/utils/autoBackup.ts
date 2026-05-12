import { useEffect } from 'react';

const BACKUP_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

function doBackup() {
  try {
    const keys = [
      'stockvault_stocks', 'stockvault_funds',
      'stockvault_stock_txs', 'stockvault_fund_txs',
      'stockvault_stock_divs', 'stockvault_fund_divs',
      'stockvault_value_history',
    ];
    const obj: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) obj[key] = JSON.parse(raw);
    }
    if (Object.keys(obj).length === 0) return;
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch { /* silent */ }
}

export function useAutoBackup() {
  useEffect(() => {
    const lastBackup = localStorage.getItem('stockvault_last_backup');
    const now = Date.now();

    // Set initial timestamp so we don't backup immediately on first load
    if (!lastBackup) {
      localStorage.setItem('stockvault_last_backup', String(now));
    } else if (now - parseInt(lastBackup) >= BACKUP_INTERVAL) {
      doBackup();
      localStorage.setItem('stockvault_last_backup', String(now));
    }

    const timer = setInterval(() => {
      doBackup();
      localStorage.setItem('stockvault_last_backup', String(Date.now()));
    }, BACKUP_INTERVAL);

    return () => clearInterval(timer);
  }, []);
}
