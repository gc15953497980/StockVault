import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney } from '../utils/api';
import { calcAveragingDown, generateAvgDownCurve } from '../utils/dca';
import styles from './DcaCalculator.module.css';

interface Props {
  type: 'stock' | 'fund';
  holdingCost: number;
  shares: number;
  currentPrice: number;
  onClose: () => void;
}

export default function AveragingDownCalc({ type, holdingCost, shares, currentPrice, onClose }: Props) {
  const [addAmount, setAddAmount] = useState('');
  const [addPrice, setAddPrice] = useState(currentPrice.toString());

  const result = useMemo(() => {
    const amt = parseFloat(addAmount);
    const price = parseFloat(addPrice) || currentPrice;
    if (!amt || amt <= 0 || price <= 0) return null;

    if (type === 'stock') {
      return calcAveragingDown(holdingCost, shares, price, amt);
    } else {
      // For funds, shares = amount / cost
      const fundShares = holdingCost > 0 ? shares / holdingCost : 0;
      const r = calcAveragingDown(holdingCost, fundShares, price, amt);
      return {
        ...r,
        newShares: r.newShares,
        newTotalInvested: r.newTotalInvested,
      };
    }
  }, [addAmount, addPrice, holdingCost, shares, currentPrice, type]);

  const curveData = useMemo(() => {
    const price = parseFloat(addPrice) || currentPrice;
    if (type === 'stock') {
      return generateAvgDownCurve(holdingCost, shares, price).map(d => ({
        ...d,
        cost: d.cost,
        label: d.label,
      }));
    } else {
      const fundShares = holdingCost > 0 ? shares / holdingCost : 0;
      return generateAvgDownCurve(holdingCost, fundShares, price).map(d => ({
        ...d,
        cost: d.cost,
        label: d.label,
      }));
    }
  }, [holdingCost, shares, currentPrice, addPrice, type]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>补仓计算器</h2>
        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>当前成本: {holdingCost.toFixed(type === 'stock' ? 2 : 4)}</label>
            </div>
            <div className={styles.field}>
              <label>当前价格</label>
              <input type="number" step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>补仓金额</label>
              <input type="number" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="输入补仓金额" />
            </div>
          </div>
        </div>

        {result && (
          <div className={styles.resultGrid}>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>新平均成本</div>
              <div className={styles.rValue}>{result.newHoldingCost.toFixed(type === 'stock' ? 2 : 4)}</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>新增{type === 'stock' ? '股数' : '份额'}</div>
              <div className={styles.rValue}>{result.newShares.toFixed(type === 'stock' ? 0 : 2)}</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>总投入</div>
              <div className={styles.rValue}>{formatMoney(result.newTotalInvested)}</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.rLabel}>成本降低</div>
              <div className={`${styles.rValue} ${styles.down}`}>{result.breakEvenDropPercent.toFixed(2)}%</div>
            </div>
          </div>
        )}

        {curveData.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={curveData}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => v.toFixed(type === 'stock' ? 2 : 4)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} />
              <Tooltip />
              <Line type="monotone" dataKey="cost" name="平均成本" stroke="#1a73e8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
