import { useState, useEffect } from 'react';
import { getSyncConfig, saveSyncConfig, clearSyncConfig, pushToGist, pullFromGist, createGist } from '../utils/gistSync';
import { collectAllData } from '../utils/autoBackup';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { useTxStore } from '../store/useTxStore';
import { useWatchlistStore } from '../store/useWatchlistStore';
import { useNotesStore } from '../store/useNotesStore';
import { useAccountStore } from '../store/useAccountStore';
import { storage, idb } from '../utils/storage';
import type { Stock, Fund, Account, WatchItem, StockTx, FundTx, StockDividend, FundDividend, Note } from '../types';
import styles from './SyncPanel.module.css';

function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface Props {
  onDataChanged: () => void;
}

export default function SyncPanel({ onDataChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(localStorage.getItem('stockvault_sync_auto') === '1');
  const [autoBackup, setAutoBackup] = useState(localStorage.getItem('stockvault_backup_auto') !== '0');
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const config = getSyncConfig();
  const [token, setToken] = useState(config?.token ?? '');
  const [gistId, setGistId] = useState(config?.gistId ?? '');
  const [storageUsage, setStorageUsage] = useState<{ ls: number; idb: number; quota: number }>({ ls: 0, idb: 0, quota: 0 });

  // Calculate storage usage
  useEffect(() => {
    if (!open) return;
    void (async () => {
      // localStorage size
      let lsSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('stockvault_')) {
          lsSize += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2; // UTF-16
        }
      }
      // IndexedDB + total quota
      let idbSize = 0;
      let quota = 0;
      try {
        const est = await navigator.storage?.estimate();
        if (est) {
          quota = est.quota ?? 0;
          idbSize = (est.usage ?? 0) - lsSize;
          if (idbSize < 0) idbSize = 0;
        }
      } catch { /* ignore */ }
      setStorageUsage({ ls: lsSize, idb: idbSize, quota });
    })();
  }, [open]);

  const handleOpen = () => {
    const cfg = getSyncConfig();
    setToken(cfg?.token ?? '');
    setGistId(cfg?.gistId ?? '');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const showStatus = (type: 'info' | 'success' | 'error', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleSaveConfig = () => {
    if (!token.trim() || !gistId.trim()) {
      showStatus('error', '请填写令牌和 Gist ID');
      return;
    }
    saveSyncConfig({ token: token.trim(), gistId: gistId.trim() });
    showStatus('success', '配置已保存');
  };

  const handleCreateGist = async () => {
    if (!token.trim()) {
      showStatus('error', '请先输入 GitHub 令牌');
      return;
    }
    setLoading(true);
    const result = await createGist(token.trim());
    setLoading(false);
    if (result.success && result.gistId) {
      setGistId(result.gistId);
      saveSyncConfig({ token: token.trim(), gistId: result.gistId });
      showStatus('success', `Gist 已创建: ${result.gistId}`);
    } else {
      showStatus('error', result.message);
    }
  };

  const handlePush = async () => {
    setLoading(true);
    const result = await pushToGist();
    setLoading(false);
    showStatus(result.success ? 'success' : 'error', result.message);
  };

  const handlePull = async () => {
    setLoading(true);
    const result = await pullFromGist();
    setLoading(false);
    showStatus(result.success ? 'success' : 'error', result.message);
    if (result.success && result.data) {
      const d = result.data;
      if (Array.isArray(d.stocks)) {
        useStockStore.getState().setStocks(d.stocks as Stock[]);
      }
      if (Array.isArray(d.funds)) {
        useFundStore.getState().setFunds(d.funds as Fund[]);
      }
      useTxStore.getState().setAllData({
        stockTxs: d.stockTxs as Record<string, StockTx[]> | undefined,
        fundTxs: d.fundTxs as Record<string, FundTx[]> | undefined,
        stockDividends: d.stockDivs as Record<string, StockDividend[]> | undefined,
        fundDividends: d.fundDivs as Record<string, FundDividend[]> | undefined,
      });
      // valueHistory & pnlCalendar already written by mergeNamespacedData → store subscription picks up changes
      if (Array.isArray(d.watchlist)) {
        useWatchlistStore.getState().setItems(d.watchlist as WatchItem[]);
      }
      if (d.notes && typeof d.notes === 'object') {
        useNotesStore.getState().setNotes(d.notes as Record<string, Note[]>);
      }
      if (Array.isArray(d.accounts)) {
        useAccountStore.getState().setAccounts(d.accounts as Account[]);
      }
      onDataChanged();
    }
  };

  const handleDisconnect = () => {
    clearSyncConfig();
    setToken('');
    setGistId('');
    setAutoSync(false);
    localStorage.removeItem('stockvault_sync_auto');
    showStatus('info', '已断开同步');
  };

  // Full backup: export localStorage + IndexedDB as JSON
  const handleFullBackup = async () => {
    const allData = await collectAllData();
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockvault_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showStatus('success', '全量备份已下载');
  };

  // Full restore: import JSON and merge into localStorage + IndexedDB
  const handleFullRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (typeof data !== 'object' || data === null) throw new Error('invalid');
          let count = 0;
          for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('__idb__')) {
              // IndexedDB key (prefixed with __idb__ during backup)
              await idb.set(key.slice(7), value);
              count++;
            } else if (key.startsWith('stockvault_')) {
              // Also write to IndexedDB for dual-write consistency
              await storage.set(key, value);
              count++;
            }
          }
          showStatus('success', `已恢复 ${count} 项数据，请刷新页面`);
          onDataChanged();
        } catch {
          showStatus('error', '恢复失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
      input.remove();
    };
    input.click();
  };

  // Clear all cache (localStorage + IndexedDB)
  const handleClearCache = () => {
    if (!window.confirm('确定要清除所有本地缓存数据吗？此操作不可恢复！建议先执行全量备份。')) return;
    storage.clearAll().then(() => {
      showStatus('info', '缓存已清除，请刷新页面');
      onDataChanged();
    }).catch(() => {
      showStatus('error', '清除失败');
    });
  };

  const handleAutoToggle = (v: boolean) => {
    setAutoSync(v);
    localStorage.setItem('stockvault_sync_auto', v ? '1' : '0');
  };

  const isConfigured = !!(config?.token && config?.gistId);

  return (
    <>
      <button className={styles.syncBtn} onClick={handleOpen} title="云同步">
        ↩ 同步
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.title}>云同步设置</h2>

            <div className={styles.field}>
              <label>GitHub 个人访问令牌</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <span className={styles.hint}>
                需要 <code>gist</code> 权限。
                <a href="https://github.com/settings/tokens/new?scopes=gist&description=StockVault" target="_blank" rel="noopener">
                  点此创建
                </a>
              </span>
            </div>

            <div className={styles.field}>
              <label>Gist ID</label>
              <div className={styles.row}>
                <input
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  placeholder="创建后自动填入"
                  style={{ flex: 1 }}
                />
                <button className={styles.btnSecondary} onClick={handleCreateGist} disabled={loading}>
                  自动创建
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={handleSaveConfig} disabled={loading}>
                保存配置
              </button>
              {isConfigured && (
                <>
                  <button className={styles.btnPrimary} onClick={handlePush} disabled={loading}>
                    📤 上传
                  </button>
                  <button className={styles.btnPrimary} onClick={handlePull} disabled={loading}>
                    📥 拉取
                  </button>
                  <button className={styles.btnDanger} onClick={handleDisconnect} disabled={loading}>
                    断开
                  </button>
                </>
              )}
              <button className={styles.btnCancel} onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>

            <div className={styles.autoSync}>
              <label>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => handleAutoToggle(e.target.checked)}
                />
                修改数据后自动上传
              </label>
            </div>

            <div className={styles.autoSync}>
              <label>
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={(e) => {
                    setAutoBackup(e.target.checked);
                    localStorage.setItem('stockvault_backup_auto', e.target.checked ? '1' : '0');
                  }}
                />
                每12小时自动备份下载
              </label>
            </div>

            <hr className={styles.divider} />
            <h3 className={styles.sectionTitle}>数据备份与恢复</h3>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={handleFullBackup} disabled={loading}>
                📦 全量备份
              </button>
              <button className={styles.btnPrimary} onClick={handleFullRestore} disabled={loading}>
                📥 全量恢复
              </button>
              <button className={styles.btnDanger} onClick={handleClearCache} disabled={loading}>
                🗑 清除缓存
              </button>
            </div>
            <span className={styles.hint}>
              全量备份导出所有本地数据（含多账户）；恢复后需刷新页面以加载数据
            </span>

            {(storageUsage.ls > 0 || storageUsage.idb > 0) && (
              <div className={styles.storageInfo}>
                <div className={styles.storageRow}>
                  <span>本地存储</span>
                  <span>{fmtBytes(storageUsage.ls)}</span>
                </div>
                <div className={styles.storageRow}>
                  <span>IndexedDB</span>
                  <span>{fmtBytes(storageUsage.idb)}</span>
                </div>
                {storageUsage.quota > 0 && (
                  <div className={styles.storageRow}>
                    <span>浏览器配额</span>
                    <span>{fmtBytes(storageUsage.quota)}</span>
                  </div>
                )}
                <div className={styles.storageBar}>
                  <div
                    className={styles.storageBarFill}
                    style={{
                      width: storageUsage.quota > 0
                        ? `${Math.min(100, ((storageUsage.ls + storageUsage.idb) / storageUsage.quota) * 100)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            )}

            {status && (
              <div className={`${styles.status} ${styles[`status${status.type === 'success' ? 'Success' : status.type === 'error' ? 'Error' : 'Info'}`]}`}>
                {status.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
