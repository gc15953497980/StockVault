import { useState, useEffect } from 'react';
import { getSyncConfig, saveSyncConfig, clearSyncConfig, pushToGist, pullFromGist, createGist } from '../utils/gistSync';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { useTxStore } from '../store/useTxStore';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { useWatchlistStore } from '../store/useWatchlistStore';
import { useNotesStore } from '../store/useNotesStore';
import { usePnlCalendarStore } from '../store/usePnlCalendarStore';
import { useAccountStore } from '../store/useAccountStore';
import type { Stock, Fund, Account, WatchItem, StockTx, FundTx, StockDividend, FundDividend, Note } from '../types';
import styles from './SyncPanel.module.css';

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
      // valueHistory is now Record<string, HistoryPoint[]> — reload current account
      const activeId = useAccountStore.getState().activeAccountId;
      const vhKey = activeId === 'default' ? 'stockvault_value_history' : `stockvault_value_history_${activeId}`;
      const vhData = localStorage.getItem(vhKey);
      if (vhData) {
        try { useValueHistoryStore.getState().setHistory(JSON.parse(vhData)); } catch { /* ignore */ }
      }
      if (Array.isArray(d.watchlist)) {
        useWatchlistStore.getState().setItems(d.watchlist as WatchItem[]);
      }
      if (d.notes && typeof d.notes === 'object') {
        useNotesStore.getState().setNotes(d.notes as Record<string, Note[]>);
      }
      // pnlCalendar is now Record<string, DailyPnl[]> — reload current account
      const pnlKey = activeId === 'default' ? 'stockvault_pnl_calendar' : `stockvault_pnl_calendar_${activeId}`;
      const pnlData = localStorage.getItem(pnlKey);
      if (pnlData) {
        try { usePnlCalendarStore.getState().setRecords(JSON.parse(pnlData)); } catch { /* ignore */ }
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

  // Full backup: export all localStorage data as JSON
  const handleFullBackup = () => {
    const allData: Record<string, unknown> = {};
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

  // Full restore: import JSON and merge into localStorage
  const handleFullRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (typeof data !== 'object' || data === null) throw new Error('invalid');
          let count = 0;
          for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('stockvault_')) {
              localStorage.setItem(key, JSON.stringify(value));
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

  // Clear all cache
  const handleClearCache = () => {
    if (!window.confirm('确定要清除所有本地缓存数据吗？此操作不可恢复！建议先执行全量备份。')) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('stockvault_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    showStatus('info', '缓存已清除，请刷新页面');
    onDataChanged();
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
