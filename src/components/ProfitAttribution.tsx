import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { calcStock, calcFund, formatMoney } from '../utils/api';

interface Props { type: 'stocks' | 'funds' }

const POS_COLOR = '#e83929';
const NEG_COLOR = '#1ca051';

export default function ProfitAttribution({ type }: Props) {
  const stocks = useStockStore(s => s.stocks);
  const stockPrices = useStockStore(s => s.prices);
  const funds = useFundStore(s => s.funds);
  const fundNavs = useFundStore(s => s.navs);

  const data = useMemo(() => {
    if (type === 'stocks') {
      return stocks
        .map(s => {
          const cp = stockPrices[s.code] ?? 0;
          const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
          return { name: s.name, pl: calc.profitLoss };
        })
        .filter(d => Math.abs(d.pl) > 0.01)
        .sort((a, b) => a.pl - b.pl);
    } else {
      return funds
        .map(f => {
          const nav = fundNavs[f.code] ?? 0;
          const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
          return { name: f.name || f.code, pl: calc.profitLoss };
        })
        .filter(d => Math.abs(d.pl) > 0.01)
        .sort((a, b) => a.pl - b.pl);
    }
  }, [type, stocks, stockPrices, funds, fundNavs]);

  if (data.length === 0) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>收益归因</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: 'var(--text)' }} />
          <Tooltip formatter={(v: any) => [formatMoney(Number(v ?? 0)), '浮动盈亏']} />
          <Bar dataKey="pl" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.pl >= 0 ? POS_COLOR : NEG_COLOR} />
            ))}
            <LabelList dataKey="pl" position="right" formatter={(v: any) => formatMoney(Number(v ?? 0))} style={{ fontSize: 10, fill: 'var(--text)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
