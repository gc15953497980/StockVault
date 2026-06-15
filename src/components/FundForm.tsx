import { useState, useEffect, useRef, useCallback } from 'react';
import type { Fund } from '../types';
import { SECTOR_OPTIONS, TAG_PRESETS, FORMATION_OPTIONS } from '../types';
import { toFundCode } from '../utils/api';
import { recognizeFundFromImage, getGeminiKey, setGeminiKey, getGeminiModel, setGeminiModel, DEFAULT_KEY, DEFAULT_MODEL } from '../utils/gemini';
import type { FundRecognitionResult } from '../utils/gemini';
import styles from './FundForm.module.css';

interface Props {
  fund: Fund | null;
  onSave: (fund: Fund) => void;
  onClose: () => void;
  onBatchSave?: (funds: Fund[]) => void;
}

function emptyFund(): Fund {
  return { id: '', code: '', name: '', sector: '', formation: '', holdingAmount: 0, holdingCost: 0, tags: [] };
}

export default function FundForm({ fund, onSave, onClose, onBatchSave }: Props) {
  const [form, setForm] = useState<Fund>(fund ?? emptyFund());
  const [codeInput, setCodeInput] = useState(fund?.code ?? '');
  const [tagInput, setTagInput] = useState('');
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgBase64, setImgBase64] = useState<string | null>(null);
  const [imgMime, setImgMime] = useState<string>('');
  const [recognizing, setRecognizing] = useState(false);
  const [recogError, setRecogError] = useState<string | null>(null);
  const [recogResults, setRecogResults] = useState<FundRecognitionResult[] | null>(null);
  const [selectedResultIdx, setSelectedResultIdx] = useState<number | null>(null);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiKey());
  const [modelInput, setModelInput] = useState(getGeminiModel());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = toFundCode(codeInput);
    onSave({ ...form, id: fund?.id || Date.now().toString(36), code });
  };

  const set = (key: keyof Fund, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const readFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImgMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImgPreview(dataUrl);
      setImgBase64(dataUrl.split(',')[1]);
      setRecogError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        readFile(item.getAsFile()!);
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const applyResult = (r: FundRecognitionResult, idx: number) => {
    if (r.code) setCodeInput(r.code);
    if (r.name) setForm(prev => ({ ...prev, name: r.name! }));
    if (r.holdingAmount && r.holdingAmount > 0) setForm(prev => ({ ...prev, holdingAmount: r.holdingAmount! }));
    if (r.holdingCost && r.holdingCost > 0) setForm(prev => ({ ...prev, holdingCost: r.holdingCost! }));
    if (r.sector && SECTOR_OPTIONS.includes(r.sector)) setForm(prev => ({ ...prev, sector: r.sector! }));
    setSelectedResultIdx(idx);
  };

  const handleBatchSave = () => {
    if (!recogResults || !onBatchSave) return;
    const funds: Fund[] = recogResults.map(r => ({
      ...emptyFund(),
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: toFundCode(r.code || ''),
      name: r.name || '',
      holdingAmount: r.holdingAmount || 0,
      holdingCost: r.holdingCost || 0,
      sector: r.sector && SECTOR_OPTIONS.includes(r.sector) ? r.sector : '',
    }));
    onBatchSave(funds);
    onClose();
  };

  const handleRecognize = async () => {
    if (!imgBase64 || !imgMime) return;
    setRecognizing(true);
    setRecogError(null);
    setRecogResults(null);
    try {
      const results = await recognizeFundFromImage(imgBase64, imgMime);
      if (results.length === 1) {
        applyResult(results[0], 0);
      } else {
        setRecogResults(results);
      }
    } catch (err: any) {
      setRecogError(err.message || '识别失败');
    } finally {
      setRecognizing(false);
    }
  };

  const clearImage = () => {
    setImgPreview(null);
    setImgBase64(null);
    setImgMime('');
    setRecogError(null);
    setRecogResults(null);
    setSelectedResultIdx(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveApiSettings = () => {
    setGeminiKey(apiKeyInput.trim() || DEFAULT_KEY);
    setGeminiModel(modelInput.trim() || DEFAULT_MODEL);
    setShowApiSettings(false);
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {imgPreview ? (
            <div className={styles.imgPreviewArea}>
              <img src={imgPreview} alt="预览" className={styles.imgPreview} />
              <div className={styles.imgActions}>
                <button type="button" className={styles.btnRecognize} onClick={handleRecognize} disabled={recognizing}>
                  {recognizing ? '识别中...' : '🔍 识别图片'}
                </button>
                <button type="button" className={styles.btnClearImg} onClick={clearImage} disabled={recognizing}>清除</button>
              </div>
              {recogError && <div className={styles.recogError}>{recogError}</div>}
            </div>
          ) : (
            <div
              className={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className={styles.dropIcon}>📷</span>
              <span className={styles.dropText}>粘贴截图或点击上传</span>
              <span className={styles.dropHint}>支持 Ctrl+V 粘贴 / 拖拽 / 点击选择</span>
            </div>
          )}

          {recogResults && recogResults.length > 1 && (
            <div className={styles.pickerOverlay}>
              <div className={styles.pickerTitle}>
                识别到 {recogResults.length} 只基金，点击填入表单
              </div>
              {recogResults.some(r => !r.code) && (
                <div className={styles.pickerWarning}>
                  {recogResults.filter(r => !r.code).length} 只基金未识别到代码，导入后需手动补充代码才能刷新行情
                </div>
              )}
              <div className={styles.pickerList}>
                {recogResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.pickerItem} ${selectedResultIdx === i ? styles.pickerItemActive : ''}`}
                    onClick={() => applyResult(r, i)}
                  >
                    <span className={styles.pickerName}>{r.name || `基金${i + 1}`}</span>
                    {r.code ? <span className={styles.pickerCode}>{r.code}</span> : <span className={styles.pickerCodeMissing}>缺少代码</span>}
                    {r.holdingAmount ? <span className={styles.pickerAmount}>¥{r.holdingAmount.toLocaleString()}</span> : null}
                    {r.sector && <span className={styles.pickerSector}>{r.sector}</span>}
                  </button>
                ))}
              </div>
              <div className={styles.pickerActions}>
                {onBatchSave && (
                  <button type="button" className={styles.btnBatchImport} onClick={handleBatchSave}>
                    全部导入 ({recogResults.length}只)
                  </button>
                )}
                <button type="button" className={styles.pickerCancel} onClick={() => { setRecogResults(null); setSelectedResultIdx(null); }}>取消</button>
              </div>
            </div>
          )}

          <div className={styles.apiSettings}>
            <button type="button" className={styles.apiSettingsToggle} onClick={() => setShowApiSettings(!showApiSettings)}>
              ⚙ API 设置 {showApiSettings ? '▲' : '▼'}
            </button>
            {showApiSettings && (
              <div className={styles.apiSettingsBody}>
                <label className={styles.apiLabel}>
                  API Key
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="输入 Google AI Studio API Key"
                    className={styles.apiInput}
                  />
                </label>
                <label className={styles.apiLabel}>
                  模型
                  <input
                    value={modelInput}
                    onChange={e => setModelInput(e.target.value)}
                    placeholder="gemini-2.5-flash-lite"
                    className={styles.apiInput}
                  />
                </label>
                <button type="button" className={styles.apiSaveBtn} onClick={saveApiSettings}>保存设置</button>
              </div>
            )}
          </div>

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
            <label>阵容分类</label>
            <select value={form.formation} onChange={(e) => setForm((prev) => ({ ...prev, formation: e.target.value }))}>
              <option value="">-- 选择阵容 --</option>
              {FORMATION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
