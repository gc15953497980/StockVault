import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTxStore } from '../store/useTxStore';
import { useFundStore } from '../store/useFundStore';
import { formatMoney } from '../utils/api';
import styles from './DcaCalculator.module.css';

interface Props { fundId: string; onClose: () => void }

export default function DividendCompare({ fundId, onClose }: Props) {
  const dividends = useTxStore(s => s.fundDividends[fundId] || []);
  const fund = useFundStore(s => s.funds.find(f => f.id === fundId));
  const nav = useFundStore(s => s.navs[fund?.code ?? '']);

  const { cashTotal, reinvestTotal, chartData } = useMemo(() => {
    let cashTotal = 0;
    let totalReinvestShares = 0;
    const chartData: { label: string; cash: number; reinvest: number }[] = [];

    const sorted = [...dividends].sort((a, b) => a.date.localeCompare(b.date));
    const currentNav = nav > 0 ? nav : (fund?.holdingCost || 1);

    for (const d of sorted) {
      if (d.type === 'cash') {
        cashTotal += d.amount;
      } else {
        // Estimate shares purchased using current NAV (approximation)
        totalReinvestShares += d.amount / currentNav;
      }
      chartData.push({
        label: d.date.slice(0, 7),
        cash: cashTotal,
        reinvest: totalReinvestShares * currentNav,
      });
    }

    const reinvestTotal = totalReinvestShares * currentNav;

    return {
      cashTotal,
      reinvestTotal,
      chartData,
    };
  }, [dividends, fund, nav]);

  if (dividends.length === 0) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <h2 className={styles.title}>分红再投对比</h2>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>暂无分红记录</p>
          <div className={styles.actions}>
            <button className={styles.btnClose} onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>分红方式对比</h2>
        <div className={styles.resultGrid}>
          <div className={styles.resultCard}>
            <div className={styles.rLabel}>现金分红累计</div>
            <div className={styles.rValue}>{formatMoney(cashTotal)}</div>
          </div>
          <div className={styles.resultCard}>
            <div className={styles.rLabel}>红利再投估算</div>
            <div className={styles.rValue}>{formatMoney(reinvestTotal)}</div>
          </div>
          <div className={styles.resultCard}>
            <div className={styles.rLabel}>差额</div>
            <div className={`${styles.rValue} ${reinvestTotal - cashTotal >= 0 ? styles.up : styles.down}`}>
              {formatMoney(reinvestTotal - cashTotal)}
            </div>
          </div>
        </div>

        {chartData.length > 1 && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => formatMoney(v as number)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
formatter={(v: any) => [formatMoney(Number(v ?? 0)), '']} />
              <Legend />
              <Bar dataKey="cash" name="现金分红" fill="#1a73e8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reinvest" name="红利再投" fill="#e83929" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
