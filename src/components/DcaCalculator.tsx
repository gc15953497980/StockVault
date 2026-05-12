import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchFundHistoryNAV, formatMoney } from '../utils/api';
import { simulateDCA } from '../utils/dca';
import styles from './DcaCalculator.module.css';

interface Props { onClose: () => void }

export default function DcaCalculator({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('1000');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof simulateDCA> extends infer R ? R : never>(null);

  const handleCalc = async () => {
    if (!code.trim() || !amount) return;
    setLoading(true);
    const history = await fetchFundHistoryNAV(code.trim(), 24, 500);
    const res = simulateDCA(history, parseFloat(amount), frequency, startDate, endDate);
    setResult(res);
    setLoading(false);
  };

  const chartData = result?.navPoints.map((p) => ({
    label: p.date.slice(5),
    value: p.value,
    invested: p.invested,
  })) || [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>定投回测计算器</h2>
        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>基金代码</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="000001" />
            </div>
            <div className={styles.field}>
              <label>每期金额</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>频率</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                <option value="weekly">每周</option>
                <option value="biweekly">双周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>开始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>结束日期</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button className={styles.btnCalc} onClick={handleCalc} disabled={loading}>
              {loading ? '计算中...' : '开始回测'}
            </button>
          </div>
        </div>

        {result && (
          <>
            <div className={styles.resultGrid}>
              <div className={styles.resultCard}>
                <div className={styles.rLabel}>定投总投入</div>
                <div className={styles.rValue}>{formatMoney(result.totalInvested)}</div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.rLabel}>定投最终市值</div>
                <div className={styles.rValue}>{formatMoney(result.finalValue)}</div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.rLabel}>定投收益率</div>
                <div className={`${styles.rValue} ${result.totalReturnPercent >= 0 ? styles.up : styles.down}`}>
                  {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
                </div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.rLabel}>年化IRR(约)</div>
                <div className={`${styles.rValue} ${result.irr >= 0 ? styles.up : styles.down}`}>
                  {result.irr >= 0 ? '+' : ''}{result.irr.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className={styles.compare}>
              <span>一次性投入: <span className={result.lumpSumReturnPercent >= 0 ? styles.up : styles.down}>
                {result.lumpSumReturnPercent >= 0 ? '+' : ''}{result.lumpSumReturnPercent.toFixed(2)}%
              </span></span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tickFormatter={v => formatMoney(v as number)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} />
                <Tooltip formatter={(v: any) => [formatMoney(Number(v ?? 0)), '']} />
                <Legend />
                <Line type="monotone" dataKey="value" name="持仓市值" stroke="#e83929" dot={false} />
                <Line type="monotone" dataKey="invested" name="累计投入" stroke="#1a73e8" dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
