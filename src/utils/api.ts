import type { StockCalculations, FundCalculations, FundNavPoint, BenchmarkPoint, Market } from '../types';
import { createLogger } from './logger';

const log = createLogger('api');

const SINA_API = '/api/sina/list=';

interface PriceResult {
  name: string;
  price: number;
  marketCap: number;
  changePercent: number;
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
    const price = parseFloat(fields[3]) || 0;
    const prevClose = parseFloat(fields[2]) || price;
    result[code] = {
      name: fields[0],
      price,
      marketCap: parseFloat(fields[44]) || 0,
      changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
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
  const costTotal = holdingCost * shares;
  const hasPrice = currentPrice > 0;
  const currentMarketValue = hasPrice ? currentPrice * shares : costTotal;
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
    hasPrice && effectiveTargetPrice > 0 && currentPrice > effectiveTargetPrice
      ? ((currentPrice - effectiveTargetPrice) / currentPrice) * 100
      : 0;
  const profitLoss = hasPrice ? (currentPrice - holdingCost) * shares : 0;
  const profitLossPercent =
    hasPrice && holdingCost > 0 ? ((currentPrice - holdingCost) / holdingCost) * 100 : 0;

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
      dailyChange: (parseFloat(fields[1]) || 0) - (parseFloat(fields[3]) || 0),
      dailyChangePercent: fields[3] && parseFloat(fields[3]) !== 0
        ? (((parseFloat(fields[1]) || 0) - parseFloat(fields[3])) / parseFloat(fields[3])) * 100
        : 0,
    };
  }
  return result;
}

export function calcFund(
  currentNAV: number,
  holdingCost: number,
  holdingAmount: number
): FundCalculations {
  const costTotal = holdingAmount;
  const hasNAV = currentNAV > 0 && holdingCost > 0;
  const shares = hasNAV ? holdingAmount / holdingCost : 0;
  const marketValue = hasNAV ? currentNAV * shares : costTotal;
  const profitLoss = hasNAV ? marketValue - costTotal : 0;
  const profitLossPercent =
    hasNAV && costTotal > 0 ? ((marketValue - costTotal) / costTotal) * 100 : 0;

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

// ─── Fund Redemption Fee (scrape from tiantian fund) ───

const FEE_CACHE_PREFIX = 'stockvault_feerate_';

export interface RedemptionFeeTier {
  period: string;
  rate: number;
}

/**
 * 从天天基金网爬取基金赎回费率
 * 返回 0 费率对应的持有期限，如 "≥7天"、"≥2年"
 * 若所有期限都有费率，则显示最低费率档位，如 "≥1年 0.25%"
 */
export async function fetchFundRedemptionFee(code: string): Promise<string> {
  const cacheKey = FEE_CACHE_PREFIX + code;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch { /* ignore cache errors */ }

  try {
    const res = await fetch(`/api/fundf10/jjfl_${code}.html`);
    if (!res.ok) {
      log.warn(`[fetchFundRedemptionFee] HTTP ${res.status} for code=${code}`);
      return getCachedFeeOrPlaceholder(cacheKey);
    }
    const html = await res.text();

    const tiers = parseRedemptionFeeHtml(html);
    if (tiers.length === 0) {
      log.warn(`[fetchFundRedemptionFee] no fee data parsed for code=${code}`);
      return getCachedFeeOrPlaceholder(cacheKey);
    }

    // Show only the zero-fee threshold: find the first tier with 0% rate
    const zeroTier = tiers.find(t => t.rate === 0);
    let formatted: string;
    if (zeroTier) {
      formatted = zeroTier === tiers[0] ? '免费' : shortenPeriod(zeroTier.period);
    } else {
      // No zero-fee tier — show the lowest available rate
      const best = tiers[tiers.length - 1];
      formatted = `${shortenPeriod(best.period)} ${best.rate.toFixed(2)}%`;
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: formatted, ts: Date.now() }));
    } catch { /* ignore */ }

    return formatted;
  } catch (err) {
    log.error(`[fetchFundRedemptionFee] fetch failed for ${code}`, err);
    return getCachedFeeOrPlaceholder(cacheKey);
  }
}

function getCachedFeeOrPlaceholder(cacheKey: string): string {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw).data;
  } catch { /* ignore */ }
  return '-';
}

/** 从费率页面 HTML 中解析赎回费率表 */
function parseRedemptionFeeHtml(html: string): RedemptionFeeTier[] {
  const tiers: RedemptionFeeTier[] = [];

  // The redemption fee table is uniquely identified by <th class="last fl">赎回费率</th>
  // Find this marker, then locate the enclosing <table> element
  const marker = '<th class="last fl">赎回费率</th>';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return tiers;

  // Search backward for <table and forward for </table>
  const beforeHtml = html.slice(0, markerIdx);
  const tableStartIdx = beforeHtml.lastIndexOf('<table');
  if (tableStartIdx === -1) return tiers;

  const afterHtml = html.slice(markerIdx);
  const tableEndIdx = afterHtml.indexOf('</table>');
  if (tableEndIdx === -1) return tiers;

  const tableHtml = html.slice(tableStartIdx, markerIdx + tableEndIdx + '</table>'.length);

  // Find <tbody> and parse its <tr> rows
  const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return tiers;

  const tbodyHtml = tbodyMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[1];
    // Extract text from <td> cells
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const text = stripHtml(tdMatch[1]).trim();
      if (text) cells.push(text);
    }

    if (cells.length >= 2) {
      const rateMatch = cells[1].match(/^([\d.]+)%$/);
      if (rateMatch) {
        tiers.push({ period: cells[0], rate: parseFloat(rateMatch[1]) });
      }
    }
  }

  return tiers;
}

/** Strip HTML tags and decode common entities */
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shorten holding period descriptions for compact display */
function shortenPeriod(period: string): string {
  // Common patterns: "小于7天" → "<7天", "大于等于7天，小于1年" → "7天-1年"
  return period
    .replace(/小于/g, '<')
    .replace(/大于等于/g, '≥')
    .replace(/大于/g, '>')
    .replace(/，/g, ',')
    .replace(/、/g, '/')
    .replace(/天以上/g, '天+')
    .replace(/年以上/g, '年+');
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

function setCachedHistory(code: string, data: FundNavPoint[], requestStart: string, requestEnd: string) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(
    FUND_HISTORY_CACHE_PREFIX + code,
    JSON.stringify({
      data: sorted,
      ts: Date.now(),
      startDate: sorted[0]?.date ?? requestStart,
      endDate: sorted[sorted.length - 1]?.date ?? requestEnd,
    })
  );
}

const FUND_NAV_PAGE_SIZE = 20; // eastmoney API caps at 20 records per page

function parseFundNavList(items: Record<string, string>[]): FundNavPoint[] {
  return items
    .filter((item) => item.DWJZ && parseFloat(item.DWJZ) > 0)
    .map((item) => ({
      date: item.FSRQ,
      nav: parseFloat(item.DWJZ),
      growthRate: item.JZZZL ? parseFloat(item.JZZZL) : 0,
    }));
}

async function fetchFundHistoryPages(
  code: string,
  reqStartDate: string,
  reqEndDate: string,
  maxPages: number,
): Promise<FundNavPoint[]> {
  const all: FundNavPoint[] = [];

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const url = `/api/fundnav/f10/lsjz?fundCode=${code}&pageIndex=${pageIndex}&pageSize=${FUND_NAV_PAGE_SIZE}&startDate=${reqStartDate}&endDate=${reqEndDate}`;
    log.debug(`[fetchFundHistoryNAV] requesting page ${pageIndex}: ${url}`);

    const res = await fetch(url);
    const json = await res.json();
    if (json.ErrCode !== 0 || !json.Data?.LSJZList?.length) break;

    const page = parseFundNavList(json.Data.LSJZList);
    if (page.length === 0) break;

    all.push(...page);

    const oldest = page.reduce((min, p) => (p.date < min ? p.date : min), page[0].date);
    if (oldest <= reqStartDate || page.length < FUND_NAV_PAGE_SIZE) break;
  }

  return mergeNavData([], all);
}

export async function fetchFundHistoryNAV(
  code: string,
  monthsBack: number = 6,
  maxRecords: number = 200
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
    const filtered = cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
    const minExpected = Math.min(30, Math.max(1, Math.floor(monthsBack * 15)));
    if (cached.startDate <= reqStartDate && cached.endDate >= reqEndDate && filtered.length >= minExpected) {
      log.info(`[fetchFundHistoryNAV] cache covers request, returning ${filtered.length} points`);
      return filtered;
    }
    log.debug(`[fetchFundHistoryNAV] cache doesn't cover requested range, fetching fresh`);
  }

  const effectiveMaxRecords = Math.max(maxRecords, Math.ceil(monthsBack * 22));
  const maxPages = Math.ceil(effectiveMaxRecords / FUND_NAV_PAGE_SIZE) + 1;

  try {
    const result = await fetchFundHistoryPages(code, reqStartDate, reqEndDate, maxPages);

    if (result.length === 0) {
      log.warn(`[fetchFundHistoryNAV] API returned no data for code=${code}`);
      if (cached) {
        const filtered = cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
        log.info(`[fetchFundHistoryNAV] fallback to cache, returning ${filtered.length} points`);
        return filtered;
      }
      return [];
    }

    log.info(`[fetchFundHistoryNAV] fetched ${result.length} points, range ${result[0]?.date} ~ ${result[result.length - 1]?.date}`);

    if (cached) {
      const merged = mergeNavData(cached.data, result);
      log.debug(`[fetchFundHistoryNAV] merged with cache, total ${merged.length} points`);
      setCachedHistory(code, merged, reqStartDate, reqEndDate);
      return merged.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
    }

    setCachedHistory(code, result, reqStartDate, reqEndDate);
    return result.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
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

// ─── ETF / Stock NAV-like history (for position signal analysis) ───

const ETF_HISTORY_CACHE_PREFIX = 'stockvault_etfnav_';

interface CachedKline {
  data: FundNavPoint[];
  startDate: string;
  endDate: string;
  ts: number;
}

function getCachedKline(code: string): CachedKline | null {
  try {
    const raw = localStorage.getItem(ETF_HISTORY_CACHE_PREFIX + code);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCachedKline(code: string, data: FundNavPoint[], startDate: string, endDate: string) {
  localStorage.setItem(ETF_HISTORY_CACHE_PREFIX + code, JSON.stringify({ data, startDate, endDate, ts: Date.now() }));
}

/**
 * Fetch stock/ETF daily kline and convert to FundNavPoint-compatible format.
 * Computes daily change % from consecutive close prices.
 */
export async function fetchETFNavHistory(
  code: string,
  monthsBack: number = 6,
): Promise<FundNavPoint[]> {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsBack);
  const reqStartDate = start.toISOString().split('T')[0];
  const reqEndDate = now.toISOString().split('T')[0];

  const cached = getCachedKline(code);
  if (cached) {
    const cacheAge = Date.now() - cached.ts;
    if (cacheAge < 3600_000 && cached.startDate <= reqStartDate && cached.endDate >= reqEndDate) {
      return cached.data.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
    }
  }

  const secid = code.startsWith('6') || code.startsWith('5') ? `1.${code}` : `0.${code}`;
  try {
    const res = await fetch(`/api/benchmark/kline?secid=${secid}&lmt=300`);
    const json = await res.json();
    if (!json?.data?.klines) return [];

    const prices: { date: string; close: number }[] = json.data.klines
      .map((line: string) => {
        const parts = line.split(',');
        return { date: parts[0], close: parseFloat(parts[2]) };
      })
      .filter((p: { close: number }) => p.close > 0)
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));

    const result: FundNavPoint[] = [];
    for (let i = 0; i < prices.length; i++) {
      const growthRate = i > 0 && prices[i-1].close > 0
        ? ((prices[i].close - prices[i-1].close) / prices[i-1].close) * 100
        : 0;
      result.push({ date: prices[i].date, nav: prices[i].close, growthRate: Math.round(growthRate * 100) / 100 });
    }

    // Drop the first day (no prior close to compute change)
    const usable = result.slice(1);
    if (usable.length > 0) {
      setCachedKline(code, usable, reqStartDate, reqEndDate);
    }
    return usable.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
  } catch {
    return [];
  }
}

// ─── K-line chart data (candlestick OHLCV) ───

export interface KlineBar {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type KlinePeriod = 'day' | 'week' | 'month';

const KLT_MAP: Record<KlinePeriod, number> = { day: 101, week: 102, month: 103 };
const KL_COUNT_DEFAULTS: Record<KlinePeriod, number> = { day: 200, week: 100, month: 60 };
const KL_CACHE_PREFIX = 'stockvault_kline_';

interface CachedStockKline {
  data: KlineBar[];
  period: KlinePeriod;
  ts: number;
}

function getKlineCacheKey(code: string, period: KlinePeriod): string {
  // Strip sh/sz prefix if present to normalize
  let raw = code;
  if (raw.startsWith('sh') || raw.startsWith('sz')) raw = raw.slice(2);
  return KL_CACHE_PREFIX + raw + '_' + period;
}

function klineCacheTTL(period: KlinePeriod): number {
  switch (period) {
    case 'day': return 3600_000;      // 1 hour
    case 'week': return 4 * 3600_000; // 4 hours
    case 'month': return 24 * 3600_000; // 24 hours
  }
}

function getCachedStockKline(code: string, period: KlinePeriod): CachedStockKline | null {
  try {
    const raw = localStorage.getItem(getKlineCacheKey(code, period));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCachedStockKline(code: string, period: KlinePeriod, data: KlineBar[]) {
  localStorage.setItem(getKlineCacheKey(code, period), JSON.stringify({
    data, period, ts: Date.now(),
  }));
}

function normalizeCode(code: string): { raw: string; market: '1' | '0' } {
  let raw = code.trim();
  // Strip sh/sz prefix if present
  if (raw.startsWith('sh') || raw.startsWith('sz')) raw = raw.slice(2);
  const market = (raw.startsWith('6') || raw.startsWith('5')) ? '1' : '0';
  return { raw, market };
}

/**
 * Fetch stock/ETF K-line data (OHLCV) for candlestick charts.
 * Supports daily, weekly, and monthly periods.
 * Data source: Eastmoney push2his API via /api/benchmark/kline proxy.
 */
export async function fetchStockKline(
  code: string,
  period: KlinePeriod = 'day',
  count?: number,
): Promise<KlineBar[]> {
  const { raw, market } = normalizeCode(code);
  const secid = `${market}.${raw}`;
  const lmt = count ?? KL_COUNT_DEFAULTS[period];
  const klt = KLT_MAP[period];

  // Check cache
  const cached = getCachedStockKline(code, period);
  if (cached) {
    const cacheAge = Date.now() - cached.ts;
    if (cacheAge < klineCacheTTL(period) && cached.data.length >= lmt - 10) {
      return cached.data;
    }
  }

  try {
    const url = `/api/benchmark/kline?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=1&end=20500101&lmt=${lmt}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json?.data?.klines) {
      const result: KlineBar[] = json.data.klines
        .map((line: string) => {
          const parts = line.split(',');
          return {
            date: parts[0],
            open: parseFloat(parts[1]) || 0,
            close: parseFloat(parts[2]) || 0,
            high: parseFloat(parts[3]) || 0,
            low: parseFloat(parts[4]) || 0,
            volume: parseFloat(parts[5]) || 0,
          };
        })
        .filter((p: KlineBar) => p.close > 0 && p.open > 0)
        .sort((a: KlineBar, b: KlineBar) => a.date.localeCompare(b.date));

      if (result.length > 0) {
        setCachedStockKline(code, period, result);
      }
      return result;
    }
    return cached?.data ?? [];
  } catch {
    // Return expired cache as fallback
    return cached?.data ?? [];
  }
}
