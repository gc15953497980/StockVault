import type { StockCalculations, FundCalculations, FundNavPoint } from '../types';

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
// 0=name, 1=current NAV, 2=accumulated NAV, 3=previous NAV,
// 4=previous accumulated NAV, 5=daily change, 6=daily change %,
// 7=subscribe status, 8=redeem status, 9=discount
export async function fetchFundPrices(
  codes: string[]
): Promise<Record<string, FundPriceResult>> {
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

export function toStockCode(input: string): string {
  let code = input.trim();
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
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

function getCachedHistory(code: string): FundNavPoint[] | null {
  try {
    const raw = localStorage.getItem(FUND_HISTORY_CACHE_PREFIX + code);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedHistory(code: string, data: FundNavPoint[]) {
  localStorage.setItem(
    FUND_HISTORY_CACHE_PREFIX + code,
    JSON.stringify({ data, ts: Date.now() })
  );
}

export async function fetchFundHistoryNAV(code: string): Promise<FundNavPoint[]> {
  const cached = getCachedHistory(code);
  if (cached) return cached;

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const url = `/api/fundnav/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=200&startDate=${startDate}&endDate=${endDate}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.ErrCode !== 0 || !json.Data?.LSJZList) {
      return [];
    }

    const result: FundNavPoint[] = json.Data.LSJZList
      .filter((item: Record<string, string>) => item.DWJZ && parseFloat(item.DWJZ) > 0)
      .map((item: Record<string, string>) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        growthRate: item.JZZZL ? parseFloat(item.JZZZL) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (result.length > 0) {
      setCachedHistory(code, result);
    }
    return result;
  } catch {
    return [];
  }
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
