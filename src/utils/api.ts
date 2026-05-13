import type { StockCalculations, FundCalculations, FundNavPoint, BenchmarkPoint, Market } from '../types';
import { createLogger } from './logger';

const log = createLogger('api');

const SINA_API = '/api/sina/list=';

interface PriceResult {
  name: string;
  price: number;
  marketCap: number;
}

interface FundPriceResult {
  name: string;
  currentNAV: number;
  accumulatedNAV: number;
  dailyChange: number;
  dailyChangePercent: number;
}

async function fetchGBK(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return new TextDecoder('gbk').decode(buffer);
}

// Fields: 0=名称, 1=今开, 2=昨收, 3=现价, 4=最高, 5=最低, ...
// 44=流通市值, 45=总市值
export async function fetchStockPrices(
  codes: string[]
): Promise<Record<string, PriceResult>> {
  if (codes.length === 0) return {};
  const url = SINA_API + codes.join(',');
  const text = await fetchGBK(url);

  const result: Record<string, PriceResult> = {};
  const regex = /var hq_str_(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1];
    const fields = match[2].split(',');
    result[code] = {
      name: fields[0],
      price: parseFloat(fields[3]) || 0,
      marketCap: parseFloat(fields[44]) || 0,
    };
  }
  return result;
}

// HK stock: rt_hkXXXXX (e.g. rt_hk00700), US stock: gb_baba
export async function fetchForeignPrices(
  codes: { code: string; market: Market }[]
): Promise<Record<string, { price: number; changePercent: number }>> {
  const result: Record<string, { price: number; changePercent: number }> = {};
  const sinaCodes = codes.map(c => {
    if (c.market === 'hk') return 'rt_hk' + c.code.replace('hk', '');
    if (c.market === 'us') return 'gb_' + c.code.replace('us_', '');
    return c.code;
  });
  if (sinaCodes.length === 0) return result;

  try {
    const url = SINA_API + sinaCodes.join(',');
    const text = await fetchGBK(url);
    const regex = /var hq_str_(\w+)="([^"]*)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const rawCode = match[1];
      const fields = match[2].split(',');
      const price = parseFloat(fields[3]) || 0;
      const prevClose = parseFloat(fields[2]) || price;
      const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      // Map back to our code
      for (const c of codes) {
        const mapped = c.market === 'hk' ? 'rt_hk' + c.code.replace('hk', '')
          : c.market === 'us' ? 'gb_' + c.code.replace('us_', '')
          : c.code;
        if (mapped === rawCode) {
          result[c.code] = { price, changePercent };
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

export function calcStock(
  currentPrice: number,
  holdingCost: number,
  shares: number,
  targetPrice: number,
  targetMarketValue: number
): StockCalculations {
  const currentMarketValue = currentPrice * shares;
  const effectiveTargetPrice =
    targetPrice > 0
      ? targetPrice
      : targetMarketValue > 0 && shares > 0
        ? targetMarketValue / shares
        : 0;
  const effectiveTargetMarketValue =
    targetMarketValue > 0
      ? targetMarketValue
      : targetPrice > 0
        ? targetPrice * shares
        : 0;
  const dropToTargetPercent =
    currentPrice > 0 && effectiveTargetPrice > 0 && currentPrice > effectiveTargetPrice
      ? ((currentPrice - effectiveTargetPrice) / currentPrice) * 100
      : 0;
  const costTotal = holdingCost * shares;
  const profitLoss = (currentPrice - holdingCost) * shares;
  const profitLossPercent =
    holdingCost > 0 ? ((currentPrice - holdingCost) / holdingCost) * 100 : 0;

  return {
    currentMarketValue,
    targetMarketValue: effectiveTargetMarketValue,
    targetPrice: effectiveTargetPrice,
    dropToTargetPercent,
    costTotal,
    profitLoss,
    profitLossPercent,
  };
}

// Fund API: Sina fund response fields
export async function fetchFundPrices(
  codes: string[]
): Promise<Record<string, FundPriceResult>> {
  if (codes.length === 0) return {};
  const fundCodes = codes.map((c) => 'f_' + c).join(',');
  const url = SINA_API + fundCodes;
  const text = await fetchGBK(url);

  const result: Record<string, FundPriceResult> = {};
  const regex = /var hq_str_f_(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1];
    const fields = match[2].split(',');
    result[code] = {
      name: fields[0],
      currentNAV: parseFloat(fields[1]) || 0,
      accumulatedNAV: parseFloat(fields[2]) || 0,
      dailyChange: parseFloat(fields[5]) || 0,
      dailyChangePercent: parseFloat(fields[6]) || 0,
    };
  }
  return result;
}

export function calcFund(
  currentNAV: number,
  holdingCost: number,
  holdingAmount: number
): FundCalculations {
  const shares = holdingCost > 0 ? holdingAmount / holdingCost : 0;
  const marketValue = currentNAV * shares;
  const costTotal = holdingAmount;
  const profitLoss = marketValue - costTotal;
  const profitLossPercent =
    costTotal > 0 ? ((marketValue - costTotal) / costTotal) * 100 : 0;

  return { shares, marketValue, costTotal, profitLoss, profitLossPercent };
}

export function toStockCode(input: string, market: Market = 'a'): string {
  let code = input.trim();
  if (market === 'hk') return code.startsWith('hk') ? code : 'hk' + code;
  if (market === 'us') return code.startsWith('us_') ? code : 'us_' + code;
  if (/^\d{6}$/.test(code)) {
    const first = code[0];
    if (first === '6' || first === '5') {
      code = 'sh' + code;
    } else {
      code = 'sz' + code;
    }
  }
  return code;
}

export function toFundCode(input: string): string {
  return input.trim();
}

export function formatMoney(v: number): string {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(2);
}

export function formatPercent(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

const FUND_HISTORY_CACHE_PREFIX = 'stockvault_fundnav_';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: FundNavPoint[];
  ts: number;
  startDate: string;
  endDate: string;
}

function getCachedHistory(code: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(FUND_HISTORY_CACHE_PREFIX + code);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry;
  } catch {
    return null;
  }
}

function setCachedHistory(code: string, data: FundNavPoint[], startDate: string, endDate: string) {
  localStorage.setItem(
    FUND_HISTORY_CACHE_PREFIX + code,
    JSON.stringify({ data, ts: Date.now(), startDate, endDate })
  );
}

export async function fetchFundHistoryNAV(
  code: string,
  monthsBack: number = 6,
  pageSize: number = 200
): Promise<FundNavPoint[]> {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsBack);
  const reqStartDate = start.toISOString().split('T')[0];
  const reqEndDate = now.toISOString().split('T')[0];

  log.info(`[fetchFundHistoryNAV] code=${code} monthsBack=${monthsBack} start=${reqStartDate} end=${reqEndDate}`);

  // Check cache
  const cached = getCachedHistory(code);
  if (cached) {
    log.debug(`[fetchFundHistoryNAV] cache hit, cached range ${cached.startDate} ~ ${cached.endDate}, ${cached.data.length} points`);
    // Use cache if it fully covers the requested range
    if (cached.startDate <= reqStartDate && cached.endDate >= reqEndDate) {
      const filtered = cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
      log.info(`[fetchFundHistoryNAV] cache covers request, returning ${filtered.length} points`);
      return filtered;
    }
    log.debug(`[fetchFundHistoryNAV] cache doesn't cover requested range, fetching fresh`);
  }

  const url = `/api/fundnav/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=${pageSize}&startDate=${reqStartDate}&endDate=${reqEndDate}`;
  log.debug(`[fetchFundHistoryNAV] requesting ${url}`);

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.ErrCode !== 0 || !json.Data?.LSJZList) {
      log.warn(`[fetchFundHistoryNAV] API error or empty data, ErrCode=${json.ErrCode}`);
      // Return cached data as fallback even if it doesn't fully cover the range
      if (cached) {
        const filtered = cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
        log.info(`[fetchFundHistoryNAV] fallback to cache, returning ${filtered.length} points`);
        return filtered;
      }
      return [];
    }

    const result: FundNavPoint[] = json.Data.LSJZList
      .filter((item: Record<string, string>) => item.DWJZ && parseFloat(item.DWJZ) > 0)
      .map((item: Record<string, string>) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        growthRate: item.JZZZL ? parseFloat(item.JZZZL) : 0,
      }))
      .sort((a: FundNavPoint, b: FundNavPoint) => a.date.localeCompare(b.date));

    log.info(`[fetchFundHistoryNAV] fetched ${result.length} points, range ${result[0]?.date} ~ ${result[result.length-1]?.date}`);

    // Merge with cached data to extend coverage
    if (cached) {
      const merged = mergeNavData(cached.data, result);
      log.debug(`[fetchFundHistoryNAV] merged with cache, total ${merged.length} points`);
      setCachedHistory(code, merged, reqStartDate, reqEndDate);
      const filtered = merged.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
      return filtered;
    }

    if (result.length > 0) {
      setCachedHistory(code, result, reqStartDate, reqEndDate);
    }
    return result;
  } catch (err) {
    log.error(`[fetchFundHistoryNAV] fetch failed`, err);
    if (cached) {
      const filtered = cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
      log.info(`[fetchFundHistoryNAV] fallback to cache, returning ${filtered.length} points`);
      return filtered;
    }
    return [];
  }
}

function mergeNavData(cached: FundNavPoint[], fresh: FundNavPoint[]): FundNavPoint[] {
  const map = new Map<string, FundNavPoint>();
  for (const p of cached) map.set(p.date, p);
  for (const p of fresh) map.set(p.date, p);
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function calcAvgDownside(history: FundNavPoint[]): number {
  if (history.length < 2) return 0;

  let totalDownside = 0;
  let downDays = 0;

  for (const point of history) {
    if (point.growthRate < 0) {
      totalDownside += Math.abs(point.growthRate);
      downDays++;
    }
  }

  return downDays > 0 ? totalDownside / downDays : 0;
}

// Benchmark API: fetch index K-line data from eastmoney
const BENCHMARK_CACHE_PREFIX = 'stockvault_benchmark_';

function getBenchmarkCache(code: string): BenchmarkPoint[] | null {
  try {
    const raw = localStorage.getItem(BENCHMARK_CACHE_PREFIX + code);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setBenchmarkCache(code: string, data: BenchmarkPoint[]) {
  localStorage.setItem(BENCHMARK_CACHE_PREFIX + code, JSON.stringify({ data, ts: Date.now() }));
}

export async function fetchBenchmarkData(code: string): Promise<BenchmarkPoint[]> {
  const cached = getBenchmarkCache(code);
  if (cached) return cached;

  // Determine market: 1=SH, 0=SZ
  const secid = code.startsWith('6') || code.startsWith('5') ? `1.${code}` : `0.${code}`;
  try {
    const res = await fetch(`/api/benchmark/kline?secid=${secid}&lmt=200`);
    const json = await res.json();
    if (json?.data?.klines) {
      const result: BenchmarkPoint[] = json.data.klines
        .map((line: string) => {
          const parts = line.split(',');
          return { date: parts[0], value: parseFloat(parts[2]) };
        })
        .filter((p: BenchmarkPoint) => p.value > 0);
      if (result.length > 0) setBenchmarkCache(code, result);
      return result;
    }
    return [];
  } catch {
    return [];
  }
}

// Market label helper
export function marketLabel(market: Market): string {
  switch (market) {
    case 'hk': return '港股';
    case 'us': return '美股';
    default: return 'A股';
  }
}
