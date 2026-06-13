import React, { useState, useMemo } from 'react';
import { useFundStore } from '../store/useFundStore';
import { calcFund, formatMoney, formatPercent } from '../utils/api';
import { FundTxPanel, FundDividendPanel } from './TxPanel';
import NotesPanel from './NotesPanel';
import DividendCompare from './DividendCompare';
import styles from './FundTable.module.css';

interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  hideNames?: boolean;
  filterTag?: string;
}

type SortField = 'code' | 'sector' | 'nav' | 'accumulatedNAV' | 'holdingCost' | 'holdingAmount' | 'shares' | 'marketValue' | 'profitLoss' | 'profitLossPercent' | 'dailyChange' | 'avgDownside' | 'time';
type SortDir = 'asc' | 'desc';

export default function FundTable({ onEdit, onDelete, hideNames, filterTag }: Props) {
  const funds = useFundStore((s) => s.funds);
  const navs = useFundStore((s) => s.navs);
  const accumulatedNAVs = useFundStore((s) => s.accumulatedNAVs);
  const dailyChangePercents = useFundStore((s) => s.dailyChangePercents);
  const avgDownsides = useFundStore((s) => s.avgDownsides);
  const timestamps = useFundStore((s) => s.timestamps);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDivCompare, setShowDivCompare] = useState<string | null>(null);

  const filtered = useMemo(() =>
    filterTag ? funds.filter(f => f.tags.includes(filterTag)) : funds,
    [funds, filterTag]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const sortArrow = <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>;

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const navA = navs[a.code] ?? 0;
      const navB = navs[b.code] ?? 0;
      const accA = accumulatedNAVs[a.code] ?? 0;
      const accB = accumulatedNAVs[b.code] ?? 0;
      const dcA = dailyChangePercents[a.code] ?? 0;
      const dcB = dailyChangePercents[b.code] ?? 0;
      const calcA = calcFund(navA, a.holdingCost, a.holdingAmount);
      const calcB = calcFund(navB, b.holdingCost, b.holdingAmount);
      const tsA = timestamps[a.code] ?? 0;
      const tsB = timestamps[b.code] ?? 0;
      let va: number, vb: number;
      switch (sortField) {
        case 'nav': va = navA; vb = navB; break;
        case 'accumulatedNAV': va = accA; vb = accB; break;
        case 'dailyChange': va = dcA; vb = dcB; break;
        case 'holdingCost': va = a.holdingCost; vb = b.holdingCost; break;
        case 'holdingAmount': va = a.holdingAmount; vb = b.holdingAmount; break;
        case 'shares': va = calcA.shares; vb = calcB.shares; break;
        case 'marketValue': va = calcA.marketValue; vb = calcB.marketValue; break;
        case 'profitLoss': va = calcA.profitLoss; vb = calcB.profitLoss; break;
        case 'profitLossPercent': va = calcA.profitLossPercent; vb = calcB.profitLossPercent; break;
        case 'avgDownside': va = avgDownsides[a.code] ?? 0; vb = avgDownsides[b.code] ?? 0; break;
        case 'sector': va = a.sector.localeCompare(b.sector); vb = 0; break;
        case 'time': va = tsA; vb = tsB; break;
        default: va = a.code.localeCompare(b.code); vb = 0; break;
      }
      if (sortField === 'code' || sortField === 'sector') return sortDir === 'asc' ? (va as unknown as number) : (vb as unknown as number);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, navs, accumulatedNAVs, dailyChangePercents, avgDownsides, timestamps, sortField, sortDir]);

  if (funds.length === 0) {
    return <div className={styles.empty}>暂无基金数据，点击上方"添加基金"开始</div>;
  }

  return (
    <>
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('code')}>基金 {sortField === 'code' && sortArrow}</th>
              <th onClick={() => handleSort('sector')}>行业 {sortField === 'sector' && sortArrow}</th>
              <th>标签</th>
              <th onClick={() => handleSort('nav')}>最新净值 {sortField === 'nav' && sortArrow}</th>
              <th onClick={() => handleSort('accumulatedNAV')}>累计净值 {sortField === 'accumulatedNAV' && sortArrow}</th>
              <th onClick={() => handleSort('dailyChange')}>日涨跌幅 {sortField === 'dailyChange' && sortArrow}</th>
              <th onClick={() => handleSort('avgDownside')}>近6月日均跌幅 {sortField === 'avgDownside' && sortArrow}</th>
              <th onClick={() => handleSort('holdingCost')}>持仓成本 {sortField === 'holdingCost' && sortArrow}</th>
              <th onClick={() => handleSort('holdingAmount')}>持有金额 {sortField === 'holdingAmount' && sortArrow}</th>
              <th onClick={() => handleSort('shares')}>持有份额 {sortField === 'shares' && sortArrow}</th>
              <th onClick={() => handleSort('marketValue')}>持有市值 {sortField === 'marketValue' && sortArrow}</th>
              <th onClick={() => handleSort('profitLoss')}>浮动盈亏 {sortField === 'profitLoss' && sortArrow}</th>
              <th onClick={() => handleSort('profitLossPercent')}>盈亏比例 {sortField === 'profitLossPercent' && sortArrow}</th>
              <th onClick={() => handleSort('time')}>更新时间 {sortField === 'time' && sortArrow}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((fund) => {
              const nav = navs[fund.code] ?? 0;
              const accNAV = accumulatedNAVs[fund.code] ?? 0;
              const dcp = dailyChangePercents[fund.code];
              const calc = calcFund(nav, fund.holdingCost, fund.holdingAmount);
              const ts = timestamps[fund.code];
              const timeStr = ts ? new Date(ts).toLocaleTimeString('zh-CN') : '-';

              return (
                <React.Fragment key={fund.id}>
                  <tr>
                    <td className={styles.fundCell} onClick={() => toggleExpand(fund.id)}>
                      <span className={styles.fundName}>{hideNames ? '***' : (fund.name || fund.code)}</span>
                      <span className={styles.fundCode}>{hideNames ? '***' : fund.code}</span>
                    </td>
                    <td>{fund.sector || '-'}</td>
                    <td className={styles.tagsCell}>
                      {fund.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                    </td>
                    <td className={nav > 0 ? styles.priceUp : ''}>{nav > 0 ? nav.toFixed(4) : '-'}</td>
                    <td>{accNAV > 0 ? accNAV.toFixed(4) : '-'}</td>
                    <td className={dcp !== undefined ? (dcp >= 0 ? styles.up : styles.down) : ''}>
                      {dcp !== undefined ? (dcp >= 0 ? '+' : '') + dcp.toFixed(2) + '%' : '-'}
                    </td>
                    <td className={avgDownsides[fund.code] !== undefined ? styles.down : ''}>
                      {avgDownsides[fund.code] !== undefined ? '-' + avgDownsides[fund.code].toFixed(2) + '%' : '-'}
                    </td>
                    <td>{fund.holdingCost > 0 ? fund.holdingCost.toFixed(4) : '-'}</td>
                    <td>{fund.holdingAmount > 0 ? formatMoney(fund.holdingAmount) : '-'}</td>
                    <td>{calc.shares > 0 ? calc.shares.toFixed(2) : '-'}</td>
                    <td>{formatMoney(calc.marketValue)}</td>
                    <td className={calc.profitLoss >= 0 ? styles.up : styles.down}>{formatMoney(calc.profitLoss)}</td>
                    <td className={calc.profitLossPercent >= 0 ? styles.up : styles.down}>{formatPercent(calc.profitLossPercent)}</td>
                    <td className={styles.time}>{timeStr}</td>
                    <td>
                      <button className={styles.btnEdit} onClick={() => onEdit(fund.id)}>编辑</button>
                      <button className={styles.btnDel} onClick={() => onDelete(fund.id)}>删除</button>
                    </td>
                  </tr>
                  {expandedId === fund.id && (
                    <tr className={styles.detailRow}>
                      <td colSpan={15}>
                        <div className={styles.detailPanel}>
                          <div className={styles.detailSection}>
                            <span className={styles.detailLabel}>持有金额:</span>
                            <span className={styles.detailValue}>{fund.holdingAmount > 0 ? formatMoney(fund.holdingAmount) : '-'}</span>
                            <span className={styles.detailLabel}>成本净值:</span>
                            <span className={styles.detailValue}>{fund.holdingCost > 0 ? fund.holdingCost.toFixed(4) : '-'}</span>
                          </div>
                          <div className={styles.detailSection}>
                            <span className={styles.detailLabel}>持有份额:</span>
                            <span className={styles.detailValue}>{calc.shares > 0 ? calc.shares.toFixed(2) : '-'}</span>
                            <span className={styles.detailLabel}>累计净值:</span>
                            <span className={styles.detailValue}>{accNAV > 0 ? accNAV.toFixed(4) : '-'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={{ border: '1px solid var(--primary)', background: 'none', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                              onClick={() => setShowDivCompare(fund.id)}>
                              分红方式对比
                            </button>
                          </div>
                          <FundTxPanel fundId={fund.id} />
                          <FundDividendPanel fundId={fund.id} />
                          <NotesPanel targetId={fund.id} label={fund.name || fund.code} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {showDivCompare && <DividendCompare fundId={showDivCompare} onClose={() => setShowDivCompare(null)} />}
    </>
  );
}
