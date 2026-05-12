import { useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useBenchmarkStore } from '../store/useBenchmarkStore';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { BENCHMARK_INDICES } from '../utils/benchmark';

export default function BenchmarkChart() {
  const { data, selectedIndex, fetchData, setSelectedIndex } = useBenchmarkStore();
  const history = useValueHistoryStore(s => s.history);

  useEffect(() => { fetchData(selectedIndex); }, [selectedIndex, fetchData]);

  const chartData = useMemo(() => {
    const benchmarkPoints = data[selectedIndex];
    if (!benchmarkPoints?.length || history.length < 2) return [];

    // Build portfolio daily value (approximate)
    const portfolioByDate = new Map<string, number>();
    for (let i = 0; i < history.length; i++) {
      const d = new Date(history[i].time).toISOString().slice(0, 10);
      portfolioByDate.set(d, history[i].totalValue);
    }

    // Find earliest common date and normalize
    const bmMap = new Map(benchmarkPoints.map(b => [b.date, b.value]));
    const result: { date: string; portfolio: number; benchmark: number }[] = [];

    let pBase = 0;
    let bBase = 0;
    const sortedDates = [...bmMap.keys()].sort();

    for (const date of sortedDates) {
      const pVal = portfolioByDate.get(date);
      if (pVal === undefined && result.length === 0) continue;
      const bVal = bmMap.get(date)!;
      if (result.length === 0 && pVal !== undefined) {
        pBase = pVal;
        bBase = bVal;
      }
      result.push({
        date: date.slice(5),
        portfolio: pBase > 0 && pVal !== undefined ? (pVal / pBase) * 100 : (result[result.length - 1]?.portfolio ?? 100),
        benchmark: bBase > 0 ? (bVal / bBase) * 100 : 100,
      });
    }

    return result.slice(-120); // Last 120 data points
  }, [data, selectedIndex, history]);

  const bmName = BENCHMARK_INDICES[selectedIndex]?.name || selectedIndex;

  if (chartData.length < 2) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>基准对比</h3>
        <select
          value={selectedIndex}
          onChange={e => setSelectedIndex(e.target.value as keyof typeof BENCHMARK_INDICES)}
          style={{
            padding: '4px 8px', border: '1px solid var(--border-heavy)', borderRadius: 4,
            background: 'var(--surface)', color: 'var(--text)', fontSize: 12,
          }}
        >
          {Object.entries(BENCHMARK_INDICES).map(([code, info]) => (
            <option key={code} value={code}>{info.name}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={45} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="portfolio" name="我的持仓" stroke="#e83929" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="benchmark" name={bmName} stroke="#1a73e8" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
