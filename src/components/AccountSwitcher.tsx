import { useState } from 'react';
import { useAccountStore } from '../store/useAccountStore';
import styles from './AccountSwitcher.module.css';

export default function AccountSwitcher() {
  const { accounts, activeAccountId, addAccount, deleteAccount, setActiveAccount } = useAccountStore();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addAccount(newName.trim());
    setNewName('');
    setShowForm(false);
  };

  // Ensure 'default' account exists
  const allAccounts = [
    { id: 'default', name: '总计', createdAt: '' },
    ...accounts,
  ];

  return (
    <div className={styles.container}>
      <select
        value={activeAccountId}
        onChange={e => setActiveAccount(e.target.value)}
        className={styles.select}
        title="切换账户"
      >
        {allAccounts.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <button className={styles.manageBtn} onClick={() => setShowForm(!showForm)} title="管理账户">
        +
      </button>

      {showForm && (
        <div className={styles.dropdown}>
          <div className={styles.addRow}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="新账户名"
              className={styles.input}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className={styles.addBtn} onClick={handleAdd}>创建</button>
          </div>
          {accounts.length > 0 && (
            <div className={styles.list}>
              {accounts.map(a => (
                <div key={a.id} className={styles.item}>
                  <span>{a.name}</span>
                  <button
                    className={styles.delBtn}
                    onClick={() => { if (window.confirm(`删除账户"${a.name}"？该账户数据将无法恢复。`)) deleteAccount(a.id); }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className={styles.closeBtn} onClick={() => setShowForm(false)}>关闭</button>
        </div>
      )}
    </div>
  );
}
