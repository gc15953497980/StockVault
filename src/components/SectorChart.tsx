import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFundStore } from '../store/useFundStore';

const COLORS = [
  '#1a73e8', '#e83929', '#1ca051', '#e87929', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16',
  '#ef4444', '#06b6d4',
];

export default function SectorChart() {
  const funds = useFundStore((s) => s.funds);
  const navs = useFundStore((s) => s.navs);

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of funds) {
      const nav = navs[f.code] ?? 0;
      const mv = nav > 0 && f.holdingCost > 0
        ? (f.holdingAmount / f.holdingCost) * nav
        : f.holdingAmount;
      const sector = f.sector || '未分类';
      map[sector] = (map[sector] || 0) + mv;
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [funds, navs]);

  if (funds.length === 0 || data.length === 0) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>行业分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            dataKey="value"
            label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
              const pct = ((percent ?? 0) * 100).toFixed(0);
              const rawName = String(name ?? '');
              const shortName = rawName.length > 6 ? rawName.slice(0, 6) + '…' : rawName;
              const RADIAN = Math.PI / 180;
              const sin = Math.sin(-RADIAN * (midAngle ?? 0));
              const cos = Math.cos(-RADIAN * (midAngle ?? 0));
              const sx = (cx ?? 0) + ((outerRadius ?? 100) + 0) * cos;
              const sy = (cy ?? 0) + ((outerRadius ?? 100) + 0) * sin;
              const tx = (cx ?? 0) + ((outerRadius ?? 100) + 30) * cos;
              const ty = (cy ?? 0) + ((outerRadius ?? 100) + 30) * sin;
              const textAnchor = cos >= 0 ? 'start' : 'end';
              return (
                <g>
                  <path d={`M${sx},${sy}L${tx},${ty}`} stroke="var(--text-muted)" fill="none" />
                  <text x={tx + (cos >= 0 ? 4 : -4)} y={ty - 6} textAnchor={textAnchor} fill="var(--text)" fontSize={11}>
                    {shortName}
                  </text>
                  <text x={tx + (cos >= 0 ? 4 : -4)} y={ty + 8} textAnchor={textAnchor} fill="var(--text-muted)" fontSize={10}>
                    {pct}%
                  </text>
                </g>
              );
            }}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => {
              const n = Number(v ?? 0);
              if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
              if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + '万';
              return n.toFixed(2);
            }}
          />
          <Legend
            formatter={(value) => {
              if (typeof value === 'string' && value.length > 10) {
                return <span title={value}>{value.slice(0, 10)}…</span>;
              }
              return value;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
