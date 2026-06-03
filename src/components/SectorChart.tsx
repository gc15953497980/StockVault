import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
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

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>行业分布</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={40}
            dataKey="value"
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
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {data.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0 }}>
              <span
                style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: COLORS[i % COLORS.length], flexShrink: 0,
                }}
              />
              <span
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}
                title={item.name}
              >
                {item.name}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
