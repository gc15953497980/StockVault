import React, { useState, useMemo } from 'react';
import { useFundStore } from '../store/useFundStore';
import { calcFund, formatMoney, formatPercent } from '../utils/api';
import { calcAvgDownGrid, getNextAvgDownTrigger } from '../utils/dca';
import { FundTxPanel, FundDividendPanel } from './TxPanel';
import AveragingDownCalc from './AveragingDownCalc';
import NotesPanel from './NotesPanel';
import DividendCompare from './DividendCompare';
import styles from './FundTable.module.css';

interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  hideNames?: boolean;
  filterTag?: string;
  loading?: boolean;
}

type SortField = 'code' | 'sector' | 'nav' | 'accumulatedNAV' | 'holdingCost' | 'holdingAmount' | 'shares' | 'marketValue' | 'profitLoss' | 'profitLossPercent' | 'dailyChange' | 'avgDownside' | 'time';
type SortDir = 'asc' | 'desc';

export default function FundTable({ onEdit, onDelete, hideNames, filterTag, loading }: Props) {
  const funds = useFundStore((s) => s.funds);
  const navs = useFundStore((s) => s.navs);
  const accumulatedNAVs = useFundStore((s) => s.accumulatedNAVs);
  const dailyChangePercents = useFundStore((s) => s.dailyChangePercents);
  const avgDownsides = useFundStore((s) => s.avgDownsides);
  const timestamps = useFundStore((s) => s.timestamps);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [avgDownId, setAvgDownId] = useState<string | null>(null);
  const [showDivCompare, setShowDivCompare] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState<{ fundId: string; price: string; amount: string } | null>(null);

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

  if (funds.length === 0 && !loading) {
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
              <th>补仓</th>
              <th onClick={() => handleSort('time')}>更新时间 {sortField === 'time' && sortArrow}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && funds.length === 0 && Array.from({ length: 5 }, (_, i) => (
              <tr key={`skel-${i}`} className={styles.skeletonRow}>
                <td colSpan={15}>
                  <div className={styles.skeletonLine} style={{ width: `${90 - i * 10}%` }} />
                </td>
              </tr>
            ))}
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
                    <td className={styles.avgDownCell}>
                      {fund.holdingCost > 0 ? (() => {
                        const grid = calcAvgDownGrid(fund.holdingCost, 4, fund.avgDownPrices ?? [], 10);
                        const next = getNextAvgDownTrigger(grid, nav);
                        const count = fund.avgDownPrices?.length ?? 0;
                        if (!next && count === 0) return <span className={styles.avgDownNone}>-</span>;
                        return (
                          <div className={styles.avgDownCompact}>
                            {count > 0 && <span className={styles.avgDownCount}>已补{count}</span>}
                            {next && (
                              <span className={next.dropFromCurrent > 0 ? styles.avgDownNext : styles.avgDownHit}>
                                {next.triggerPrice.toFixed(4)}
                              </span>
                            )}
                          </div>
                        );
                      })() : <span className={styles.avgDownNone}>-</span>}
                    </td>
                    <td className={styles.time}>{timeStr}</td>
                    <td>
                      <button className={styles.btnEdit} onClick={() => onEdit(fund.id)}>编辑</button>
                      <button className={styles.btnDel} onClick={() => onDelete(fund.id)}>删除</button>
                    </td>
                  </tr>
                  {expandedId === fund.id && (
                    <tr className={styles.detailRow}>
                      <td colSpan={16}>
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
                          {/* 补仓网格 */}
                          {fund.holdingCost > 0 && (() => {
                            const grid = calcAvgDownGrid(fund.holdingCost, 4, fund.avgDownPrices ?? [], 8);
                            const next = getNextAvgDownTrigger(grid, nav);
                            if (grid.length === 0) return null;
                            return (
                              <div className={styles.avgDownSection}>
                                <div className={styles.avgDownHeader}>
                                  <span>📊 补仓网格（每跌4%）</span>
                                  <span className={styles.avgDownMeta}>
                                    基准净值 {fund.holdingCost.toFixed(4)}
                                    <span className={styles.avgDownSep}>|</span>
                                    已补 {fund.avgDownPrices?.length ?? 0} 次
                                    {next && (
                                      <>
                                        <span className={styles.avgDownSep}>|</span>
                                        下次触发{' '}
                                        <span className={next.dropFromCurrent > 0 ? styles.down : styles.avgDownHit}>
                                          {next.triggerPrice.toFixed(4)}
                                        </span>
                                        {next.dropFromCurrent > 0 && (
                                          <span className={styles.down}>（距现净值 -{next.dropFromCurrent.toFixed(1)}%）</span>
                                        )}
                                        {next.dropFromCurrent <= 0 && (
                                          <span className={styles.avgDownHit}>（已触发！）</span>
                                        )}
                                      </>
                                    )}
                                  </span>
                                </div>
                                <div className={styles.avgDownGridRow}>
                                  {grid.map(l => (
                                    <div
                                      key={l.level}
                                      className={`${styles.avgDownCard} ${l.completed ? styles.avgDownDone : (l === grid.find(g => !g.completed) ? styles.avgDownPending : '')}`}
                                      title={l.completed ? `点击删除此补仓记录（实际补仓净值：${l.actualPrice?.toFixed(4)}）` : undefined}
                                      onClick={l.completed ? () => {
                                        const { updateFund } = useFundStore.getState();
                                        const prices = [...(fund.avgDownPrices ?? [])];
                                        // 找到匹配的已补价格并移除（从大到小找第一个匹配的）
                                        const idx = prices.findLastIndex(p => p <= l.triggerPrice && p >= (fund.holdingCost * Math.pow(0.96, l.level + 1)));
                                        if (idx !== -1) {
                                          prices.splice(idx, 1);
                                          updateFund({ ...fund, avgDownPrices: prices });
                                        }
                                      } : undefined}
                                    >
                                      <div className={styles.avgDownCardLevel}>第{l.level}次</div>
                                      <div className={styles.avgDownCardPrice}>{l.triggerPrice.toFixed(4)}</div>
                                      <div className={styles.avgDownCardDrop}>-{l.dropFromRef.toFixed(1)}%</div>
                                      <div className={styles.avgDownCardStatus}>
                                        {l.completed ? (
                                          <span className={styles.avgDownDoneIcon}>✅</span>
                                        ) : l === grid.find(g => !g.completed) ? (
                                          <span className={styles.avgDownNextIcon}>🔴</span>
                                        ) : (
                                          <span className={styles.avgDownWaitIcon}>⬜</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className={styles.detailSection}>
                                  {recordForm?.fundId === fund.id ? (
                                    <>
                                      <input
                                        type="number"
                                        step="0.0001"
                                        className={styles.avgDownInput}
                                        placeholder="补仓净值"
                                        value={recordForm.price}
                                        onChange={e => setRecordForm({ ...recordForm, price: e.target.value })}
                                      />
                                      <input
                                        type="number"
                                        step="0.01"
                                        className={styles.avgDownInput}
                                        placeholder="补仓金额"
                                        value={recordForm.amount}
                                        onChange={e => setRecordForm({ ...recordForm, amount: e.target.value })}
                                      />
                                      <button
                                        className={styles.btnEdit}
                                        onClick={() => {
                                          const p = parseFloat(recordForm.price);
                                          const a = parseFloat(recordForm.amount);
                                          if (!p || !a || p <= 0 || a <= 0) return;
                                          const { updateFund } = useFundStore.getState();
                                          const oldShares = fund.holdingAmount / fund.holdingCost;
                                          const newShares = a / p;
                                          const totalShares = oldShares + newShares;
                                          const totalAmount = fund.holdingAmount + a;
                                          updateFund({
                                            ...fund,
                                            holdingAmount: Math.round(totalAmount * 100) / 100,
                                            holdingCost: Math.round((totalAmount / totalShares) * 10000) / 10000,
                                            avgDownPrices: [...(fund.avgDownPrices ?? []), p],
                                          });
                                          setRecordForm(null);
                                        }}
                                      >
                                        保存补仓
                                      </button>
                                      <button className={styles.btnDefault} onClick={() => setRecordForm(null)}>取消</button>
                                    </>
                                  ) : (
                                    <button
                                      className={styles.btnDefault}
                                      onClick={() => setRecordForm({
                                        fundId: fund.id,
                                        price: (next?.triggerPrice ?? nav).toFixed(4),
                                        amount: '',
                                      })}
                                    >
                                      记录补仓
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          <div className={styles.detailSection}>
                            <button className={styles.btnDefault} onClick={() => setAvgDownId(avgDownId === fund.id ? null : fund.id)}>
                              补仓计算器
                            </button>
                          </div>
                          {avgDownId === fund.id && (
                            <AveragingDownCalc
                              type="fund"
                              holdingCost={fund.holdingCost}
                              shares={calc.shares}
                              currentPrice={nav ?? 0}
                              onClose={() => setAvgDownId(null)}
                            />
                          )}
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
