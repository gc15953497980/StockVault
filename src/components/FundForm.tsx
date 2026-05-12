import { useState, useEffect } from 'react';
import type { Fund } from '../types';
import { SECTOR_OPTIONS } from '../types';
import { toFundCode } from '../utils/api';
import styles from './FundForm.module.css';

interface Props {
  fund: Fund | null;
  onSave: (fund: Fund) => void;
  onClose: () => void;
}

function emptyFund(): Fund {
  return {
    id: '',
    code: '',
    name: '',
    sector: '',
    holdingAmount: 0,
    holdingCost: 0,
  };
}

export default function FundForm({ fund, onSave, onClose }: Props) {
  const [form, setForm] = useState<Fund>(fund ?? emptyFund());
  const [codeInput, setCodeInput] = useState(fund?.code ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = toFundCode(codeInput);
    onSave({ ...form, id: fund?.id || Date.now().toString(36), code });
  };

  const set = (key: keyof Fund, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{fund ? '编辑基金' : '添加基金'}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>基金代码</label>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="000001"
              required
            />
          </div>

          <div className={styles.field}>
            <label>行业</label>
            <select
              value={form.sector}
              onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
            >
              <option value="">-- 选择行业 --</option>
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>持仓金额</label>
              <input
                type="number"
                step="0.01"
                value={form.holdingAmount || ''}
                onChange={(e) => set('holdingAmount', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label>持仓成本净值</label>
              <input
                type="number"
                step="0.0001"
                value={form.holdingCost || ''}
                onChange={(e) => set('holdingCost', parseFloat(e.target.value) || 0)}
                placeholder="0.0000"
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.btnSave}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
