import { useMemo, useId } from 'react';
import { useFundStore } from '../store/useFundStore';
import { useStockStore } from '../store/useStockStore';
import { FORMATION_OPTIONS } from '../types';

interface CategoryDef {
  name: string;
  keywords: string[];
  color: string;
}

const CATEGORIES: CategoryDef[] = [
  { name: '中证A500', keywords: ['a500', 'A500', '优选300', '中证全指', '消费龙头', '主要消费', '消费50', '家用电器'], color: '#e83929' },
  { name: '沪深300', keywords: ['沪深300', '沪深300指', '300指', 'CSI300'], color: '#2563eb' },
  { name: '红利', keywords: ['红利', '股息', '自由现金流'], color: '#1ca051' },
  { name: '双创', keywords: ['科创', '创业', '双创', '医药', '医疗', '生物科技'], color: '#1a73e8' },
  { name: '恒科', keywords: ['恒生科技', '恒科', '港股通科技'], color: '#e87929' },
  { name: '中证500', keywords: ['中证500'], color: '#8b5cf6' },
  { name: '白酒', keywords: ['白酒'], color: '#ec4899' },
  { name: '黄金', keywords: ['黄金'], color: '#f59e0b' },
  { name: '港消费', keywords: ['港股消费', '恒生消费', '港消费', '沪港深消费'], color: '#14b8a6' },
];

interface FormationPosition {
  x: number;
  y: number;
}

/** 按持仓大小依次填入 3-3-2 阵型，最大持仓居中前锋 */
const FORMATION_SLOTS: FormationPosition[] = [
  { x: 150, y: 72 },
  { x: 75, y: 88 },
  { x: 225, y: 88 },
  { x: 150, y: 188 },
  { x: 75, y: 208 },
  { x: 225, y: 208 },
  { x: 110, y: 318 },
  { x: 190, y: 318 },
];

const DISPLAY_NAMES: Record<string, string> = {
  '中证A500': 'A500',
  '中证500': '500',
  '港消费': '港消费',
};

const FIELD_COLOR = '#2d8a4e';
const FIELD_STRIPE_DARK = '#267a43';
const LINE_COLOR = 'rgba(255,255,255,0.42)';

function classifyFund(name: string): number {
  for (let i = 0; i < CATEGORIES.length; i++) {
    for (const kw of CATEGORIES[i].keywords) {
      if (name.includes(kw)) return i;
    }
  }
  return -1;
}

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function displayName(name: string): string {
  if (DISPLAY_NAMES[name]) return DISPLAY_NAMES[name];
  return name.length <= 4 ? name : name.slice(0, 4);
}

const MIN_RADIUS = 22;
const MAX_RADIUS = 36;

export default function FormationChart() {
  const funds = useFundStore(s => s.funds);
  const navs = useFundStore(s => s.navs);
  const stocks = useStockStore(s => s.stocks);
  const prices = useStockStore(s => s.prices);
  const patternId = useId().replace(/:/g, '');

  const data = useMemo(() => {
    const catIndex: Record<string, number> = {};
    CATEGORIES.forEach((c, i) => { catIndex[c.name] = i; });

    const map: Record<number, number> = {};

    // 基金市值
    for (const f of funds) {
      const nav = navs[f.code] ?? 0;
      const mv = nav > 0 && f.holdingCost > 0
        ? (f.holdingAmount / f.holdingCost) * nav
        : f.holdingAmount;
      const idx = f.formation && catIndex[f.formation] !== undefined
        ? catIndex[f.formation]
        : classifyFund(f.name);
      if (idx >= 0) {
        map[idx] = (map[idx] || 0) + mv;
      } else {
        map[-1] = (map[-1] || 0) + mv;
      }
    }

    // 股票市值
    for (const s of stocks) {
      const cp = prices[s.code] ?? 0;
      const mv = cp > 0 ? cp * s.shares : s.holdingCost * s.shares;
      if (mv <= 0) continue;
      const idx = s.formation && catIndex[s.formation] !== undefined
        ? catIndex[s.formation]
        : classifyFund(s.name);
      if (idx >= 0) {
        map[idx] = (map[idx] || 0) + mv;
      } else {
        map[-1] = (map[-1] || 0) + mv;
      }
    }

    const entries = Object.entries(map)
      .map(([k, v]) => ({ idx: Number(k), value: v }))
      .sort((a, b) => b.value - a.value);

    const maxVal = entries.length > 0 ? entries[0].value : 1;
    const categories = entries.map(e => ({
      name: e.idx === -1 ? '其他' : CATEGORIES[e.idx].name,
      value: e.value,
      color: e.idx === -1 ? '#6366f1' : CATEGORIES[e.idx].color,
      idx: e.idx,
    }));

    return { categories, maxVal, total: entries.reduce((s, e) => s + e.value, 0) };
  }, [funds, navs, stocks, prices]);

  if ((funds.length === 0 && stocks.length === 0) || data.categories.length === 0) return null;

  const onField = data.categories
    .filter(c => c.idx !== -1)
    .slice(0, FORMATION_SLOTS.length)
    .map((cat, i) => ({ ...cat, pos: FORMATION_SLOTS[i] }));

  const bench = data.categories.filter(c => c.idx === -1);
  const legendItems = [...onField, ...bench];

  function radius(value: number) {
    if (data.maxVal <= 0) return MIN_RADIUS;
    const r = MIN_RADIUS + (value / data.maxVal) * (MAX_RADIUS - MIN_RADIUS);
    return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>
        阵容图
      </h3>

      <svg viewBox="0 0 300 390" style={{ width: '100%', maxWidth: 360, display: 'block', margin: '0 auto' }}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="10" height="20" fill={FIELD_COLOR} />
            <rect x="10" width="10" height="20" fill={FIELD_STRIPE_DARK} />
          </pattern>
        </defs>

        <rect x="15" y="10" width="270" height="370" rx="8" fill={`url(#${patternId})`} />
        <rect x="15" y="10" width="270" height="370" rx="8" fill="none" stroke={LINE_COLOR} strokeWidth="2" />

        <line x1="15" y1="200" x2="285" y2="200" stroke={LINE_COLOR} strokeWidth="1.5" />
        <circle cx="150" cy="200" r="42" fill="none" stroke={LINE_COLOR} strokeWidth="1.5" />
        <circle cx="150" cy="200" r="3" fill={LINE_COLOR} />

        <rect x="80" y="330" width="140" height="45" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="3" />
        <rect x="95" y="352" width="110" height="23" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />
        <rect x="80" y="15" width="140" height="45" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="3" />
        <rect x="95" y="15" width="110" height="23" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />

        {onField.map((item) => {
          const r = radius(item.value);
          const pct = data.total > 0 ? (item.value / data.total) * 100 : 0;
          const label = displayName(item.name);
          const nameSize = label.length > 3 ? 10 : 11;
          return (
            <g key={item.name}>
              <title>{`${item.name} · ${fmtValue(item.value)} · ${pct.toFixed(1)}%`}</title>
              <circle
                cx={item.pos.x}
                cy={item.pos.y}
                r={r}
                fill={item.color}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
              />
              <text
                x={item.pos.x}
                y={item.pos.y - 5}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={nameSize}
                fontWeight="600"
              >
                {label}
              </text>
              <text
                x={item.pos.x}
                y={item.pos.y + 9}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.92)"
                fontSize="10"
                fontWeight="500"
              >
                {pct.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {legendItems.map((item) => {
          const pct = data.total > 0 ? (item.value / data.total) * 100 : 0;
          const isBench = item.idx === -1;
          return (
            <div
              key={item.name}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0 }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: item.color, flexShrink: 0,
                  opacity: isBench ? 0.7 : 1,
                }}
              />
              <span
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}
                title={item.name}
              >
                {isBench ? `${item.name}（替补）` : item.name}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                {fmtValue(item.value)} · {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
