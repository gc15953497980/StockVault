import type { BenchmarkPoint } from '../types';

const CACHE_PREFIX = 'stockvault_benchmark_';
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Major indices
export const BENCHMARK_INDICES = {
  '000300': { name: '沪深300', market: 1 },
  '000905': { name: '中证500', market: 0 },
  '000001': { name: '上证指数', market: 1 },
  '399001': { name: '深证成指', market: 0 },
  '399006': { name: '创业板指', market: 0 },
} as const;

export type BenchmarkCode = keyof typeof BENCHMARK_INDICES;

function getCache(code: string): BenchmarkPoint[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + code);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(code: string, data: BenchmarkPoint[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + code, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

export async function fetchBenchmark(code: BenchmarkCode | string): Promise<BenchmarkPoint[]> {
  const cached = getCache(code);
  if (cached) return cached;

  const idx = BENCHMARK_INDICES[code as BenchmarkCode];
  if (!idx) return [];

  const secid = `${idx.market}.${code}`;
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=200`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json?.data?.klines) {
      const result: BenchmarkPoint[] = json.data.klines
        .map((line: string) => {
          const parts = line.split(',');
          return { date: parts[0], value: parseFloat(parts[2]) };
        })
        .filter((p: BenchmarkPoint) => p.value > 0);
      if (result.length > 0) setCache(code, result);
      return result;
    }
    return [];
  } catch {
    return [];
  }
}

// Normalize: rebase both portfolio and benchmark to start at 100
export function normalizeSeries(portfolio: { date: string; value: number }[], benchmark: BenchmarkPoint[]) {
  if (portfolio.length === 0 || benchmark.length === 0) return [];

  // Find earliest common date
  const bmMap = new Map(benchmark.map(b => [b.date, b.value]));
  const result: { date: string; portfolio: number; benchmark: number }[] = [];

  let portfolioBase = 0;
  let benchmarkBase = 0;

  for (const p of portfolio) {
    const bmVal = bmMap.get(p.date);
    if (bmVal === undefined) continue;
    if (portfolioBase === 0) {
      portfolioBase = p.value;
      benchmarkBase = bmVal;
    }
    result.push({
      date: p.date,
      portfolio: portfolioBase > 0 ? (p.value / portfolioBase) * 100 : 100,
      benchmark: benchmarkBase > 0 ? (bmVal / benchmarkBase) * 100 : 100,
    });
  }

  return result;
}
