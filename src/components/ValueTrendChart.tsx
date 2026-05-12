import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useValueHistoryStore } from '../store/useValueHistoryStore';

interface Props {
  type: 'stocks' | 'funds';
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

export default function ValueTrendChart({ type }: Props) {
  const history = useValueHistoryStore((s) => s.history);

  const data = history.map((p) => ({
    time: new Date(p.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    value: type === 'stocks' ? p.stockValue : p.fundValue,
  }));

  if (data.length < 2) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>
        {type === 'stocks' ? '股票' : '基金'}市值走势
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis tickFormatter={formatValue} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={70} />
          <Tooltip formatter={(v) => [formatValue(v as number), type === 'stocks' ? '股票市值' : '基金市值']} />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            name={type === 'stocks' ? '股票市值' : '基金市值'}
            stroke={type === 'stocks' ? '#e83929' : '#1a73e8'}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
