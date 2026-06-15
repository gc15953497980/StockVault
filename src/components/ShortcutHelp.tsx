import styles from './ShortcutHelp.module.css';

interface Props { onClose: () => void }

const SHORTCUTS = [
  { key: '1', desc: '切换到概览' },
  { key: '2', desc: '切换到持仓' },
  { key: '3', desc: '切换到关注' },
  { key: '?', desc: '显示/隐藏快捷键' },
];

export default function ShortcutHelp({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>键盘快捷键</h3>
        <div className={styles.list}>
          {SHORTCUTS.map(s => (
            <div key={s.key} className={styles.row}>
              <kbd className={styles.kbd}>{s.key}</kbd>
              <span>{s.desc}</span>
            </div>
          ))}
        </div>
        <button className={styles.close} onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
