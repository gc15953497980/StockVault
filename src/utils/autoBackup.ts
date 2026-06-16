import { useEffect } from 'react';
import { idb } from './storage';

const BACKUP_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

/** 收集所有 localStorage + IndexedDB 数据，供手动/自动备份共用 */
export async function collectAllData(): Promise<Record<string, unknown>> {
  const allData: Record<string, unknown> = {};

  // localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('stockvault_')) {
      try {
        allData[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        allData[key] = localStorage.getItem(key);
      }
    }
  }

  // IndexedDB
  try {
    const keys = await idb.keys();
    for (const key of keys) {
      if (key.startsWith('stockvault_')) {
        const val = await idb.get(key);
        if (val !== null) allData[`__idb__${key}`] = val;
      }
    }
  } catch { /* IndexedDB unavailable, skip */ }

  return allData;
}

async function doBackup() {
  try {
    const obj = await collectAllData();
    if (Object.keys(obj).length === 0) return;
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
    const autoBackupEnabled = localStorage.getItem('stockvault_backup_auto') !== '0';

    if (!autoBackupEnabled) return;

    const lastBackup = localStorage.getItem('stockvault_last_backup');
    const now = Date.now();

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
