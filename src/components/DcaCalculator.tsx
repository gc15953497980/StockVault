import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchFundHistoryNAV, formatMoney } from '../utils/api';
import { simulateDCA } from '../utils/dca';
import { createLogger } from '../utils/logger';
import styles from './DcaCalculator.module.css';

const log = createLogger('DcaCalculator');

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
  const [error, setError] = useState<string | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  const handleCalc = async () => {
    if (!code.trim() || !amount) return;

    setError(null);
    setResult(null);
    setRanOnce(false);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('请输入有效的每期金额');
      log.warn(`[handleCalc] 无效金额: ${amount}`);
      return;
    }

    if (startDate >= endDate) {
      setError('开始日期必须早于结束日期');
      log.warn(`[handleCalc] 日期非法: startDate=${startDate} >= endDate=${endDate}`);
      return;
    }

    log.info(`[handleCalc] 开始定投回测 code=${code} amount=${parsedAmount} freq=${frequency} start=${startDate} end=${endDate}`);
    setLoading(true);

    try {
      const history = await fetchFundHistoryNAV(code.trim(), 24, 500);
      log.info(`[handleCalc] 获取到 ${history.length} 条历史净值数据`);

      if (history.length === 0) {
        setError('未获取到该基金的历史净值数据，请检查基金代码是否正确');
        setLoading(false);
        setRanOnce(true);
        return;
      }

      const res = simulateDCA(history, parsedAmount, frequency, startDate, endDate);
      if (res === null) {
        setError('回测失败：数据不足或日期范围内无交易数据，请调整日期范围后重试');
        log.warn('[handleCalc] simulateDCA 返回 null');
      } else {
        log.info(`[handleCalc] 回测完成 收益率=${res.totalReturnPercent.toFixed(2)}% 年化IRR≈${res.irr.toFixed(2)}%`);
        setResult(res);
      }
    } catch (err) {
      log.error('[handleCalc] 回测异常', err);
      setError('回测过程发生异常，请稍后重试');
    } finally {
      setLoading(false);
      setRanOnce(true);
    }
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
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" />
            </div>
            <div className={styles.field}>
              <label>频率</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}>
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

        {error && (
          <div style={{ color: '#e83929', fontSize: 13, margin: '12px 0', padding: '8px 12px', background: 'rgba(232,57,41,0.08)', borderRadius: 6 }}>
            {error}
          </div>
        )}

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
                <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
formatter={(v: any) => [formatMoney(Number(v ?? 0)), '']} />
                <Legend />
                <Line type="monotone" dataKey="value" name="持仓市值" stroke="#e83929" dot={false} />
                <Line type="monotone" dataKey="invested" name="累计投入" stroke="#1a73e8" dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {ranOnce && !result && !error && !loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '12px 0', textAlign: 'center' }}>
            未能获取到回测结果
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
