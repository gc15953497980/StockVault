import { useMemo, useState } from 'react';
import { usePnlCalendarStore } from '../store/usePnlCalendarStore';
import { formatMoney } from '../utils/api';
import styles from './PnlCalendar.module.css';

export default function PnlCalendar() {
  const { records } = usePnlCalendarStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { grid, maxAbsPnl, monthlyPnl } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const recordMap = new Map(records.map(r => [r.date, r]));

    const grid: { day: number; pnl: number; pnlPercent: number; date: string }[][] = [];
    let week: { day: number; pnl: number; pnlPercent: number; date: string }[] = [];

    for (let i = 0; i < firstDow; i++) {
      week.push({ day: 0, pnl: 0, pnlPercent: 0, date: '' });
    }

    let maxAbsPnl = 0;
    let totalMonthPnl = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = recordMap.get(dateStr);
      const pnl = rec?.pnl ?? 0;
      const pnlPercent = rec?.pnlPercent ?? 0;
      if (Math.abs(pnl) > maxAbsPnl) maxAbsPnl = Math.abs(pnl);
      totalMonthPnl += pnl;

      week.push({ day: d, pnl, pnlPercent, date: dateStr });
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push({ day: 0, pnl: 0, pnlPercent: 0, date: '' });
      grid.push(week);
    }

    return { grid, maxAbsPnl, monthlyPnl: totalMonthPnl };
  }, [records, year, month]);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const intensity = (pnl: number): string => {
    if (pnl === 0) return 'transparent';
    const ratio = Math.min(Math.abs(pnl) / (maxAbsPnl || 1), 1);
    if (pnl > 0) {
      return `rgba(232, 57, 41, ${0.2 + ratio * 0.6})`;
    } else {
      return `rgba(28, 160, 81, ${0.2 + ratio * 0.6})`;
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (records.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={prevMonth} className={styles.navBtn}>&lt;</button>
          <span className={styles.title}>{year}年{month}月</span>
          <button onClick={nextMonth} className={styles.navBtn}>&gt;</button>
          <span className={styles.monthPnl}>月盈亏 --</span>
        </div>
        <div className={styles.weekDays}>
          {weekDays.map(d => <div key={d} className={styles.weekDay}>{d}</div>)}
        </div>
        <div className={styles.grid}>
          {grid.map((week, wi) =>
            week.map((cell, ci) => (
              <div key={`${wi}-${ci}`} className={`${styles.cell} ${cell.day === 0 ? styles.empty : ''}`}>
                {cell.day > 0 ? <span className={styles.dayNum}>{cell.day}</span> : null}
              </div>
            ))
          )}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(28,160,81,0.6)' }} /> 盈利</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(232,57,41,0.6)' }} /> 亏损</span>
          <span className={styles.legendItem}>颜色越深幅度越大</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={prevMonth} className={styles.navBtn}>&lt;</button>
        <span className={styles.title}>{year}年{month}月</span>
        <button onClick={nextMonth} className={styles.navBtn}>&gt;</button>
        <span className={`${styles.monthPnl} ${monthlyPnl >= 0 ? styles.up : styles.down}`}>
          月盈亏 {monthlyPnl >= 0 ? '+' : ''}{formatMoney(monthlyPnl)}
        </span>
      </div>
      <div className={styles.weekDays}>
        {weekDays.map(d => <div key={d} className={styles.weekDay}>{d}</div>)}
      </div>
      <div className={styles.grid}>
        {grid.map((week, wi) =>
          week.map((cell, ci) => (
            <div
              key={`${wi}-${ci}`}
              className={`${styles.cell} ${cell.day === 0 ? styles.empty : ''}`}
              style={cell.day > 0 ? { background: intensity(cell.pnl) } : undefined}
              title={cell.date ? `${cell.date} 日盈亏: ${cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(2)} (${cell.pnlPercent >= 0 ? '+' : ''}${cell.pnlPercent.toFixed(2)}%)` : ''}
            >
              {cell.day > 0 ? <span className={styles.dayNum}>{cell.day}</span> : null}
            </div>
          ))
        )}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(28,160,81,0.6)' }} /> 盈利</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(232,57,41,0.6)' }} /> 亏损</span>
        <span className={styles.legendItem}>颜色越深幅度越大</span>
      </div>
    </div>
  );
}
