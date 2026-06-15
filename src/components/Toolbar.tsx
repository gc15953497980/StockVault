import { useAutoRefresh } from '../hooks/useAutoRefresh';
import ReportGenerator from './ReportGenerator';
import styles from './Toolbar.module.css';

interface Props {
  addLabel: string;
  onAdd: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (file: File) => void;
  loading: boolean;
  error: string | null;
  count: number;
  onRefresh: () => Promise<void>;
  showDca?: () => void;
  showSim?: () => void;
  privacyMode?: boolean;
  onTogglePrivacy?: () => void;
  filterTag?: string;
  availableTags?: string[];
  onFilterTagChange?: (tag: string) => void;
}

export default function Toolbar({
  addLabel,
  onAdd,
  onExportJSON,
  onExportCSV,
  onImport,
  loading,
  error,
  count,
  onRefresh,
  showDca,
  showSim,
  privacyMode,
  onTogglePrivacy,
  filterTag,
  availableTags,
  onFilterTagChange,
}: Props) {
  const { autoRefresh, toggleAutoRefresh, intervalMinutes, setIntervalMinutes, nextRefresh } = useAutoRefresh({ onRefresh });

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onImport(file);
      input.remove();
    };
    input.click();
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button className={styles.btnPrimary} onClick={onAdd}>
          + {addLabel}
        </button>
        <button
          className={styles.btnRefresh}
          onClick={onRefresh}
          disabled={loading || count === 0}
        >
          {loading ? '刷新中...' : '刷新行情'}
        </button>
        {availableTags && availableTags.length > 0 && onFilterTagChange && (
          <select
            value={filterTag ?? ''}
            onChange={e => onFilterTagChange(e.target.value)}
            className={styles.intervalSelect}
            title="按标签筛选"
          >
            <option value="">全部标签</option>
            {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}
      </div>
      <div className={styles.center}>
        <div className={styles.autoRefresh}>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => toggleAutoRefresh(e.target.checked)}
            />
            自动刷新
          </label>
          {autoRefresh && (
            <select
              value={intervalMinutes}
              onChange={e => setIntervalMinutes(parseInt(e.target.value))}
              className={styles.intervalSelect}
            >
              <option value={1}>1分钟</option>
              <option value={5}>5分钟</option>
              <option value={15}>15分钟</option>
              <option value={30}>30分钟</option>
            </select>
          )}
          {autoRefresh && nextRefresh && (
            <span className={styles.nextRefresh}>
              下次: {nextRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <div className={styles.right}>
        {onTogglePrivacy && (
          <button
            className={styles.btnDefault}
            onClick={onTogglePrivacy}
            title={privacyMode ? '退出隐私模式' : '隐私模式'}
          >
            {privacyMode ? '👁 显示' : '🙈 隐藏'}
          </button>
        )}
        <ReportGenerator />
        {showDca && (
          <button className={styles.btnDefault} onClick={showDca} title="定投回测计算器">
            定投回测
          </button>
        )}
        {showSim && (
          <button className={styles.btnDefault} onClick={showSim} title="止盈止损策略回测">
            策略回测
          </button>
        )}
        <button className={styles.btnDefault} onClick={handleImport}>
          导入
        </button>
        <button className={styles.btnDefault} onClick={onExportJSON} disabled={count === 0}>
          导出JSON
        </button>
        <button className={styles.btnDefault} onClick={onExportCSV} disabled={count === 0}>
          导出CSV
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
