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
const STOCK_PRICE_CHUNK = 400; // split large requests to avoid 431

export async function fetchStockPrices(
  codes: string[]
): Promise<Record<string, PriceResult>> {
  if (codes.length === 0) return {};
  const result: Record<string, PriceResult> = {};

  for (let i = 0; i < codes.length; i += STOCK_PRICE_CHUNK) {
    const chunk = codes.slice(i, i + STOCK_PRICE_CHUNK);
    const url = SINA_API + chunk.join(',');
    const text = await fetchGBK(url);

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
  }
  return result;
}

// HK stock: rt_hkXXXXX (e.g. rt_hk00700), US stock: gb_baba
export async function fetchForeignPrices(
  codes: { code: string; market: Market }[]
): Promise<Record<string, { price: number; changePercent: number }>> {
  const result: Record<string, { price: number; changePercent: number }> = {};
  if (codes.length === 0) return result;

  const toSinaCode = (c: { code: string; market: Market }) => {
    if (c.market === 'hk') return 'rt_hk' + c.code.replace('hk', '');
    if (c.market === 'us') return 'gb_' + c.code.replace('us_', '');
    return c.code;
  };
  const revMap = new Map<string, string>(); // sinaCode -> ourCode
  for (const c of codes) revMap.set(toSinaCode(c), c.code);

  for (let i = 0; i < codes.length; i += STOCK_PRICE_CHUNK) {
    const chunk = codes.slice(i, i + STOCK_PRICE_CHUNK);
    const url = SINA_API + chunk.map(toSinaCode).join(',');
    try {
      const text = await fetchGBK(url);
      const regex = /var hq_str_(\w+)="([^"]*)"/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const rawCode = match[1];
        const ourCode = revMap.get(rawCode);
        if (!ourCode) continue;
        const fields = match[2].split(',');
        const price = parseFloat(fields[3]) || 0;
        const prevClose = parseFloat(fields[2]) || price;
        result[ourCode] = {
          price,
          changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
        };
      }
    } catch { /* ignore */ }
  }
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
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return sign + (abs / 1e4).toFixed(2) + '万';
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
      try { setCachedHistory(code, merged, reqStartDate, reqEndDate); } catch { /* quota */ }
      return merged.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
    }

    try { setCachedHistory(code, result, reqStartDate, reqEndDate); } catch { /* quota */ }
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

  const secid = toEastMoneySecid(code);
  try {
    const res = await fetch(`/api/benchmark/api/qt/stock/kline/get?secid=${secid}&lmt=200`);
    const json = await res.json();
    if (json?.data?.klines) {
      const result: BenchmarkPoint[] = json.data.klines
        .map((line: string) => {
          const parts = line.split(',');
          return { date: parts[0], value: parseFloat(parts[2]) };
        })
        .filter((p: BenchmarkPoint) => p.value > 0);
      if (result.length > 0) try { setBenchmarkCache(code, result); } catch { /* quota */ }
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
 * Fetch stock/ETF daily kline from Sina and convert to FundNavPoint-compatible format.
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

  try {
    // Use Sina K-line, same source as candlestick charts (fetchStockKline)
    // Request enough bars to cover the lookback: ~22 trading days per month
    const bars = await fetchSinaDailyKline(code, Math.max(monthsBack * 30, 100));

    if (bars.length < 2) return [];

    const result: FundNavPoint[] = [];
    for (let i = 1; i < bars.length; i++) {
      const growthRate = bars[i - 1].close > 0
        ? ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100
        : 0;
      result.push({
        date: bars[i].date,
        nav: bars[i].close,
        growthRate: Math.round(growthRate * 100) / 100,
      });
    }

    if (result.length > 0) {
      try { setCachedKline(code, result, reqStartDate, reqEndDate); } catch { /* quota exceeded */ }
    }
    return result.filter(p => p.date >= reqStartDate && p.date <= reqEndDate);
  } catch (err) {
    log.warn(`[fetchETFNavHistory] error for ${code}`, err);
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

const KL_COUNT_DEFAULTS: Record<KlinePeriod, number> = { day: 200, week: 100, month: 60 };
const KL_CACHE_PREFIX = 'stockvault_kline_v2_';

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

/** Result item from fetchStockList */
export interface StockListItem {
  code: string;
  name: string;
  market: 'sh' | 'sz';
}

/**
 * Fetch all A-share stocks, excluding 创业板(300/301), 科创板(688),
 * 北交所(8/4), and ST stocks. Returns raw 6-digit codes.
 */
export async function fetchStockList(): Promise<StockListItem[]> {
  const errors: string[] = [];

  // Try 1: local static file
  try {
    const staticRes = await fetch('/stock-list.json');
    if (staticRes.ok) {
      const data = await staticRes.json() as StockListItem[];
      if (data.length > 0) return data;
    } else {
      errors.push(`静态文件: HTTP ${staticRes.status}`);
    }
  } catch (e: unknown) {
    errors.push(`静态文件: ${e instanceof Error ? e.message : 'fetch failed'}`);
  }

  // Try 2: Sina API — try both vip.stock and money.finance hosts
  const sinaHosts = ['/api/sina-stocklist', '/api/sina-stocklist2'];
  for (const host of sinaHosts) {
    for (const node of ['sh_a', 'sz_a']) {
      try {
        const url = `${host}/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=5000&sort=symbol&asc=1&node=${node}`;
        const text = await fetchGBK(url);
        if (!text || text.length < 100) {
          errors.push(`Sina ${node}: response too short (${text.length} chars)`);
          continue;
        }

        let items: Array<Record<string, string>>;
        try {
          items = JSON.parse(text);
        } catch {
          const match = text.match(/\[[\s\S]*\]/);
          if (!match) {
            errors.push(`Sina ${node}: not JSON, first 200 chars: ${text.slice(0, 200)}`);
            continue;
          }
          items = JSON.parse(match[0]);
        }

        if (!Array.isArray(items) || items.length === 0) {
          errors.push(`Sina ${node}: empty items array`);
          continue;
        }

        const result = parseStockItems(items);
        if (result.length > 0) return result;
        errors.push(`Sina ${node}: parsed ${items.length} items but all filtered out`);
      } catch (e: unknown) {
        errors.push(`Sina ${node} (${host}): ${e instanceof Error ? e.message : 'fetch failed'}`);
      }
    }
  }

  // Try 3: Eastmoney via existing benchmark proxy with the clist endpoint
  try {
    const params = new URLSearchParams({
      fid: 'f3', po: '1', pz: '5000', pn: '1', np: '1',
      fltt: '2', invt: '2', fs: 'm:0+t:6,m:0+t:80', fields: 'f12,f14',
    });
    const url = `/api/benchmark/api/qt/clist/get?${params.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.diff) {
        const items = (json.data.diff as Array<{ f12: string; f14: string }>).map(d => ({
          code: d.f12,
          name: d.f14,
          symbol: d.f12,
        }));
        const result = parseStockItems(items);
        if (result.length > 0) return result;
        errors.push(`Eastmoney: parsed ${items.length} items but all filtered out`);
      } else {
        errors.push(`Eastmoney: API returned no data.diff, total=${json?.data?.total}`);
      }
    } else {
      errors.push(`Eastmoney: HTTP ${res.status}`);
    }
  } catch (e: unknown) {
    errors.push(`Eastmoney: ${e instanceof Error ? e.message : 'fetch failed'}`);
  }

  if (errors.length > 0) {
    throw new Error(`所有数据源均失败：\n${errors.join('\n')}`);
  }
  return [];
}

function parseStockItems(items: Array<Record<string, string>>): StockListItem[] {
  const all: StockListItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const rawCode: string = item.code || item.symbol || '';
    if (!rawCode || rawCode.length < 6) continue;
    const code = rawCode.slice(-6);
    if (seen.has(code)) continue;

    const name = (item.name || '').replace(/%/g, '');

    if (code.startsWith('300') || code.startsWith('301')) continue;
    if (code.startsWith('688')) continue;
    if (code.startsWith('8') || code.startsWith('4')) continue;
    if (name.includes('ST')) continue;

    seen.add(code);
    all.push({
      code,
      name,
      market: (code.startsWith('6') || code.startsWith('5')) ? 'sh' : 'sz',
    });
  }

  return all;
}

function normalizeCode(code: string): { raw: string; market: '1' | '0' } {
  let raw = code.trim();
  // Strip sh/sz prefix if present
  if (raw.startsWith('sh') || raw.startsWith('sz')) raw = raw.slice(2);
  const market = (raw.startsWith('6') || raw.startsWith('5')) ? '1' : '0';
  return { raw, market };
}

function toEastMoneySecid(code: string): string {
  const { raw, market } = normalizeCode(code);
  return `${market}.${raw}`;
}

/**
 * Fetch stock/ETF daily K-line from Sina.
 * Volume is returned in 手 (Sina gives 股, we convert).
 */
async function fetchSinaDailyKline(code: string, count: number): Promise<KlineBar[]> {
  const { raw, market } = normalizeCode(code);
  const url = `/api/sina-kline/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=${count}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn(`[fetchSinaDailyKline] HTTP ${res.status} for ${symbol}`);
      return [];
    }
    // Read as buffer first so we can try both UTF-8 and GBK
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 10) {
      log.warn(`[fetchSinaDailyKline] empty/short response for ${symbol}: ${buffer.byteLength} bytes`);
      return [];
    }
    const text = new TextDecoder('utf-8').decode(buffer);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // Sina may return GBK-encoded JSON
      const gbkText = new TextDecoder('gbk').decode(buffer);
      json = JSON.parse(gbkText);
    }

    if (!Array.isArray(json)) {
      log.warn(`[fetchSinaDailyKline] non-array response for ${symbol}: ${typeof json}, first 100 chars: ${text.slice(0, 100)}`);
      return [];
    }

    const bars = (json as Array<Record<string, string>>)
      .map(item => ({
        date: item.day || '',
        open: parseFloat(item.open) || 0,
        close: parseFloat(item.close) || 0,
        high: parseFloat(item.high) || 0,
        low: parseFloat(item.low) || 0,
        volume: (parseFloat(item.volume) || 0) / 100, // 股 → 手
      }))
      .filter(p => p.date && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    log.info(`[fetchSinaDailyKline] ${symbol}: ${bars.length} bars (${bars[0]?.date} ~ ${bars[bars.length - 1]?.date})`);
    return bars;
  } catch (err) {
    log.error(`[fetchSinaDailyKline] fetch error for ${symbol}:`, err);
    return [];
  }
}

function aggregateBars(daily: KlineBar[], period: 'week' | 'month'): KlineBar[] {
  const groups = new Map<string, KlineBar[]>();
  for (const bar of daily) {
    const d = new Date(bar.date);
    const key = period === 'week'
      ? `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + (d.getDay() || 7) - d.getDay()) / 7)).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bar);
  }
  const result: KlineBar[] = [];
  for (const [, bars] of groups) {
    if (bars.length === 0) continue;
    result.push({
      date: bars[0].date,
      open: bars[0].open,
      close: bars[bars.length - 1].close,
      high: Math.max(...bars.map(b => b.high)),
      low: Math.min(...bars.map(b => b.low)),
      volume: bars.reduce((s, b) => s + b.volume, 0),
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch stock/ETF K-line data (OHLCV) for candlestick charts.
 * Supports daily, weekly, and monthly periods.
 * Data source: Sina finance API for daily; week/month aggregated from daily.
 */
export async function fetchStockKline(
  code: string,
  period: KlinePeriod = 'day',
  count?: number,
): Promise<KlineBar[]> {
  const lmt = count ?? KL_COUNT_DEFAULTS[period];

  const cached = getCachedStockKline(code, period);
  if (cached) {
    const cacheAge = Date.now() - cached.ts;
    if (cacheAge < klineCacheTTL(period) && cached.data.length >= lmt - 10) {
      return cached.data;
    }
  }

  try {
    let result: KlineBar[];

    if (period === 'day') {
      result = await fetchSinaDailyKline(code, lmt);
    } else {
      // Fetch enough daily bars to cover week/month aggregation
      const dailyCount = period === 'week' ? lmt * 10 : lmt * 30;
      const daily = await fetchSinaDailyKline(code, dailyCount);
      result = aggregateBars(daily, period).slice(-lmt);
    }

    if (result.length > 0) {
      try { setCachedStockKline(code, period, result); } catch { /* quota exceeded, ignore */ }
    }
    return result;
  } catch (err) {
    log.warn(`[fetchStockKline] error for ${code}, using cache fallback`, err);
    return cached?.data ?? [];
  }
}
