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
import styles from './SyncPanel.module.css';

interface Props {
  onDataChanged: () => void;
}

export default function SyncPanel({ onDataChanged }: Props) {
  const config = getSyncConfig();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(config?.token ?? '');
  const [gistId, setGistId] = useState(config?.gistId ?? '');
  const [autoSync, setAutoSync] = useState(localStorage.getItem('stockvault_sync_auto') === '1');
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      setToken(config.token);
      setGistId(config.gistId);
    }
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
        useStockStore.getState().setStocks(d.stocks as any);
      }
      if (Array.isArray(d.funds)) {
        useFundStore.getState().setFunds(d.funds as any);
      }
      useTxStore.getState().setAllData({
        stockTxs: d.stockTxs as any,
        fundTxs: d.fundTxs as any,
        stockDividends: d.stockDivs as any,
        fundDividends: d.fundDivs as any,
      });
      if (Array.isArray(d.valueHistory)) {
        useValueHistoryStore.getState().setHistory(d.valueHistory as any);
      }
      if (Array.isArray(d.watchlist)) {
        useWatchlistStore.getState().setItems(d.watchlist as any);
      }
      if (d.notes && typeof d.notes === 'object') {
        useNotesStore.getState().setNotes(d.notes as any);
      }
      if (Array.isArray(d.pnlCalendar)) {
        usePnlCalendarStore.getState().setRecords(d.pnlCalendar as any);
      }
      if (Array.isArray(d.accounts)) {
        useAccountStore.getState().setAccounts(d.accounts as any);
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

  const handleAutoToggle = (v: boolean) => {
    setAutoSync(v);
    localStorage.setItem('stockvault_sync_auto', v ? '1' : '0');
  };

  const isConfigured = !!(config?.token && config?.gistId);

  return (
    <>
      <button className={styles.syncBtn} onClick={() => setOpen(true)} title="云同步">
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
