import { useFundStore } from '../store/useFundStore';
import { calcFund, formatMoney, formatPercent } from '../utils/api';
import styles from './FundTable.module.css';

interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function FundTable({ onEdit, onDelete }: Props) {
  const funds = useFundStore((s) => s.funds);
  const navs = useFundStore((s) => s.navs);
  const accumulatedNAVs = useFundStore((s) => s.accumulatedNAVs);
  const timestamps = useFundStore((s) => s.timestamps);

  if (funds.length === 0) {
    return (
      <div className={styles.empty}>
        暂无基金数据，点击上方"添加基金"开始
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>基金</th>
            <th>最新净值</th>
            <th>累计净值</th>
            <th>持仓成本</th>
            <th>持有金额</th>
            <th>持有份额</th>
            <th>持有市值</th>
            <th>浮动盈亏</th>
            <th>盈亏比例</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => {
            const nav = navs[fund.code] ?? 0;
            const accNAV = accumulatedNAVs[fund.code] ?? 0;
            const calc = calcFund(nav, fund.holdingCost, fund.holdingAmount);
            const ts = timestamps[fund.code];
            const timeStr = ts
              ? new Date(ts).toLocaleTimeString('zh-CN')
              : '-';

            return (
              <tr key={fund.id}>
                <td>
                  <span className={styles.fundName}>{fund.name || fund.code}</span>
                  <span className={styles.fundCode}>{fund.code}</span>
                </td>
                <td className={nav > 0 ? styles.priceUp : ''}>
                  {nav > 0 ? nav.toFixed(4) : '-'}
                </td>
                <td>{accNAV > 0 ? accNAV.toFixed(4) : '-'}</td>
                <td>{fund.holdingCost > 0 ? fund.holdingCost.toFixed(4) : '-'}</td>
                <td>{fund.holdingAmount > 0 ? formatMoney(fund.holdingAmount) : '-'}</td>
                <td>{calc.shares > 0 ? calc.shares.toFixed(2) : '-'}</td>
                <td>{formatMoney(calc.marketValue)}</td>
                <td className={calc.profitLoss >= 0 ? styles.up : styles.down}>
                  {formatMoney(calc.profitLoss)}
                </td>
                <td
                  className={
                    calc.profitLossPercent >= 0 ? styles.up : styles.down
                  }
                >
                  {formatPercent(calc.profitLossPercent)}
                </td>
                <td className={styles.time}>{timeStr}</td>
                <td>
                  <button
                    className={styles.btnEdit}
                    onClick={() => onEdit(fund.id)}
                  >
                    编辑
                  </button>
                  <button
                    className={styles.btnDel}
                    onClick={() => onDelete(fund.id)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
