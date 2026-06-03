const GIST_API = 'https://api.github.com/gists';
const SYNC_KEY = 'stockvault_sync_config';

interface SyncConfig {
  token: string;
  gistId: string;
}

interface GistFile {
  content: string;
}

interface GistData {
  stocks?: unknown;
  funds?: unknown;
  stockTxs?: unknown;
  fundTxs?: unknown;
  stockDivs?: unknown;
  fundDivs?: unknown;
  valueHistory?: Record<string, unknown>;
  watchlist?: unknown;
  notes?: unknown;
  pnlCalendar?: Record<string, unknown>;
  accounts?: unknown;
  updatedAt: string;
}

export function getSyncConfig(): SyncConfig | null {
  try {
    const d = localStorage.getItem(SYNC_KEY);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(config));
}

export function clearSyncConfig() {
  localStorage.removeItem(SYNC_KEY);
}

const LAST_SYNC_KEY = 'stockvault_last_sync';

function getLastSyncTime(): string {
  return localStorage.getItem(LAST_SYNC_KEY) || '2000-01-01T00:00:00.000Z';
}

function saveLastSyncTime() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

function collectNamespacedData(prefix: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key === prefix) {
      result['default'] = safeJSON(localStorage.getItem(key));
    } else if (key.startsWith(prefix + '_')) {
      const accountId = key.slice(prefix.length + 1);
      result[accountId] = safeJSON(localStorage.getItem(key));
    }
  }
  return result;
}

function getAllData(): GistData {
  return {
    stocks: safeJSON(localStorage.getItem('stockvault_stocks')),
    funds: safeJSON(localStorage.getItem('stockvault_funds')),
    stockTxs: safeJSON(localStorage.getItem('stockvault_stock_txs')),
    fundTxs: safeJSON(localStorage.getItem('stockvault_fund_txs')),
    stockDivs: safeJSON(localStorage.getItem('stockvault_stock_divs')),
    fundDivs: safeJSON(localStorage.getItem('stockvault_fund_divs')),
    valueHistory: collectNamespacedData('stockvault_value_history'),
    watchlist: safeJSON(localStorage.getItem('stockvault_watchlist')),
    notes: safeJSON(localStorage.getItem('stockvault_notes')),
    pnlCalendar: collectNamespacedData('stockvault_pnl_calendar'),
    accounts: safeJSON(localStorage.getItem('stockvault_accounts')),
    updatedAt: getLastSyncTime(),
  };
}

function safeJSON(v: string | null): unknown {
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

export async function pushToGist(): Promise<{ success: boolean; message: string }> {
  const config = getSyncConfig();
  if (!config) return { success: false, message: '未配置 GitHub 令牌' };

  const data = getAllData();
  const content = JSON.stringify(data, null, 2);

  try {
    const res = await fetch(`${GIST_API}/${config.gistId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        files: { 'stockvault_data.json': { content } },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: (err as { message?: string }).message || `HTTP ${res.status}` };
    }

    saveLastSyncTime();
    return { success: true, message: '同步成功' };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function pullFromGist(): Promise<{ success: boolean; message: string; data?: GistData }> {
  const config = getSyncConfig();
  if (!config) return { success: false, message: '未配置 GitHub 令牌' };

  try {
    const res = await fetch(`${GIST_API}/${config.gistId}`, {
      headers: {
        Authorization: config.token ? `token ${config.token}` : '',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return { success: false, message: `获取失败 HTTP ${res.status}` };
    }

    const gist = await res.json() as { files?: Record<string, GistFile> };
    const file = gist.files?.['stockvault_data.json'];
    if (!file?.content) {
      return { success: false, message: 'Gist 中暂无数据' };
    }

    const remote: GistData = JSON.parse(file.content);

    mergeData('stockvault_stocks', remote.stocks);
    mergeData('stockvault_funds', remote.funds);
    mergeData('stockvault_stock_txs', remote.stockTxs);
    mergeData('stockvault_fund_txs', remote.fundTxs);
    mergeData('stockvault_stock_divs', remote.stockDivs);
    mergeData('stockvault_fund_divs', remote.fundDivs);
    mergeNamespacedData('stockvault_value_history', remote.valueHistory);
    mergeData('stockvault_watchlist', remote.watchlist);
    mergeData('stockvault_notes', remote.notes);
    mergeNamespacedData('stockvault_pnl_calendar', remote.pnlCalendar);
    mergeData('stockvault_accounts', remote.accounts);

    saveLastSyncTime();
    return { success: true, message: '拉取成功，数据已更新', data: remote };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

function mergeData(key: string, remote: unknown) {
  if (remote === undefined || remote === null) return;
  localStorage.setItem(key, JSON.stringify(remote));
}

function mergeNamespacedData(prefix: string, remote: Record<string, unknown> | undefined) {
  if (!remote || typeof remote !== 'object') return;
  for (const [accountId, data] of Object.entries(remote)) {
    if (data === undefined || data === null) continue;
    const key = accountId === 'default' ? prefix : `${prefix}_${accountId}`;
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export async function createGist(token: string): Promise<{ success: boolean; gistId?: string; message: string }> {
  const data = getAllData();
  const content = JSON.stringify(data, null, 2);

  try {
    const res = await fetch(GIST_API, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        description: 'StockVault 持仓数据',
        public: false,
        files: { 'stockvault_data.json': { content } },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: (err as { message?: string }).message || `HTTP ${res.status}` };
    }

    const gist = await res.json() as { id: string };
    return { success: true, gistId: gist.id, message: 'Gist 创建成功' };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
