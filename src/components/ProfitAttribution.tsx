import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { calcStock, calcFund, formatMoney } from '../utils/api';

interface Props { type: 'stocks' | 'funds' | 'all' }

const POS_COLOR = '#e83929';
const NEG_COLOR = '#1ca051';

function BarValueLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x, y, width, height, value } = props;
  if (value == null || x == null || y == null || width == null || height == null) return null;
  const num = Number(value);
  const isPositive = num >= 0;
  const labelX = isPositive ? x + width + 4 : x + width - 4;
  return (
    <text
      x={labelX}
      y={y + height / 2}
      dy={4}
      textAnchor={isPositive ? 'start' : 'end'}
      fill="var(--text)"
      fontSize={10}
    >
      {formatMoney(num)}
    </text>
  );
}

export default function ProfitAttribution({ type }: Props) {
  const stocks = useStockStore(s => s.stocks);
  const stockPrices = useStockStore(s => s.prices);
  const funds = useFundStore(s => s.funds);
  const fundNavs = useFundStore(s => s.navs);

  const data = useMemo(() => {
    const result: { name: string; pl: number }[] = [];
    if (type === 'stocks' || type === 'all') {
      result.push(...stocks
        .map(s => {
          const cp = stockPrices[s.code] ?? 0;
          const calc = calcStock(cp, s.holdingCost, s.shares, s.targetPrice, s.targetMarketValue);
          return { name: s.name + (s.type === 'etf' ? ' (ETF)' : ''), pl: calc.profitLoss };
        }));
    }
    if (type === 'funds' || type === 'all') {
      result.push(...funds
        .map(f => {
          const nav = fundNavs[f.code] ?? 0;
          const calc = calcFund(nav, f.holdingCost, f.holdingAmount);
          return { name: (f.name || f.code) + ' (基金)', pl: calc.profitLoss };
        }));
    }
    return result.filter(d => Math.abs(d.pl) > 0.01).sort((a, b) => a.pl - b.pl);
  }, [type, stocks, stockPrices, funds, fundNavs]);

  if (data.length === 0) return null;

  const yAxisWidth = Math.min(Math.max(...data.map(d => d.name.length)) * 7 + 8, 140);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>收益归因</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={{ fontSize: 11, fill: 'var(--text)' }}
            tickFormatter={(name) => (name.length > 14 ? name.slice(0, 14) + '…' : name)}
          />
          <ReferenceLine x={0} stroke="var(--border-heavy)" />
          <Tooltip formatter={(v) => [formatMoney(Number(v ?? 0)), '浮动盈亏']} />
          <Bar dataKey="pl" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.pl >= 0 ? POS_COLOR : NEG_COLOR} />
            ))}
            <LabelList dataKey="pl" content={<BarValueLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
