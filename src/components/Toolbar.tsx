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
}: Props) {
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onImport(file);
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
      </div>
      <div className={styles.right}>
        <button className={styles.btnDefault} onClick={handleImport}>
          导入
        </button>
        <button
          className={styles.btnDefault}
          onClick={onExportJSON}
          disabled={count === 0}
        >
          导出JSON
        </button>
        <button
          className={styles.btnDefault}
          onClick={onExportCSV}
          disabled={count === 0}
        >
          导出CSV
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
