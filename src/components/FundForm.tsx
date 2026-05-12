import { useState, useEffect } from 'react';
import type { Fund } from '../types';
import { SECTOR_OPTIONS, TAG_PRESETS } from '../types';
import { toFundCode } from '../utils/api';
import styles from './FundForm.module.css';

interface Props {
  fund: Fund | null;
  onSave: (fund: Fund) => void;
  onClose: () => void;
}

function emptyFund(): Fund {
  return { id: '', code: '', name: '', sector: '', holdingAmount: 0, holdingCost: 0, tags: [] };
}

export default function FundForm({ fund, onSave, onClose }: Props) {
  const [form, setForm] = useState<Fund>(fund ?? emptyFund());
  const [codeInput, setCodeInput] = useState(fund?.code ?? '');
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = toFundCode(codeInput);
    onSave({ ...form, id: fund?.id || Date.now().toString(36), code });
  };

  const set = (key: keyof Fund, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
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
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="000001" required />
          </div>

          <div className={styles.field}>
            <label>行业</label>
            <select value={form.sector} onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}>
              <option value="">-- 选择行业 --</option>
              {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label>标签</label>
            <div className={styles.tagRow}>
              {form.tags.map(tag => (
                <span key={tag} className={styles.tag}>
                  {tag}
                  <button type="button" className={styles.tagDel} onClick={() => removeTag(tag)}>×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="输入标签后回车"
                className={styles.tagInput}
              />
              <button type="button" className={styles.tagAddBtn} onClick={addTag}>添加</button>
            </div>
            <div className={styles.tagPresets}>
              {TAG_PRESETS.filter(t => !form.tags.includes(t)).map(t => (
                <button key={t} type="button" className={styles.tagPreset} onClick={() => setForm(prev => ({ ...prev, tags: [...prev.tags, t] }))}>{t}</button>
              ))}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>持仓金额</label>
              <input type="number" step="0.01" value={form.holdingAmount || ''} onChange={(e) => set('holdingAmount', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
            <div className={styles.field}>
              <label>持仓成本净值</label>
              <input type="number" step="0.0001" value={form.holdingCost || ''} onChange={(e) => set('holdingCost', parseFloat(e.target.value) || 0)} placeholder="0.0000" />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>取消</button>
            <button type="submit" className={styles.btnSave}>保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
