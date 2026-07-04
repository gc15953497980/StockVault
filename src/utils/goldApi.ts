import { createLogger } from './logger';
import type { GoldKlinePoint } from '../types';

const log = createLogger('goldApi');

const SINA_API = '/api/sina/list=';
const GOLD_CACHE_PREFIX = 'stockvault_goldkline_';
const CACHE_TTL = 24 * 60 * 60 * 1000;

// ── Types ──

export interface GoldSpotResult {
  name: string;
  price: number;         // USD/oz
  prevClose: number;
  changePercent: number;
  timestamp: number;
}

export interface ForexResult {
  name: string;
  rate: number;          // USD/CNY
  prevClose: number;
  changePercent: number;
  timestamp: number;
}

// ── Helpers ──

async function fetchGBK(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return new TextDecoder('gbk').decode(buffer);
}

function getCache(code: string): GoldKlinePoint[] | null {
  try {
    const raw = localStorage.getItem(GOLD_CACHE_PREFIX + code);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(code: string, data: GoldKlinePoint[]) {
  try {
    localStorage.setItem(GOLD_CACHE_PREFIX + code, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

// ── Gold spot price (hf_XAU — London Gold, USD/oz) ──

export async function fetchGoldSpot(): Promise<GoldSpotResult | null> {
  try {
    const url = SINA_API + 'hf_XAU';
    const text = await fetchGBK(url);
    const regex = /var hq_str_(\w+)="([^"]*)"/g;
    const match = regex.exec(text);
    if (!match) return null;

    const fields = match[2].split(',');
    const price = parseFloat(fields[3]) || 0;
    const prevClose = parseFloat(fields[2]) || price;

    return {
      name: fields[0] || '伦敦金',
      price,
      prevClose,
      changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      timestamp: Date.now(),
    };
  } catch {
    log.warn('[fetchGoldSpot] failed');
    return null;
  }
}

// ── USD/CNY exchange rate ──
// Sina uses 'USDCNY' (no hf_ prefix) for forex spot rates

const USDCNY_FALLBACK = 7.25; // approximate fallback rate

export async function fetchUsdCny(): Promise<ForexResult | null> {
  // Try primary symbol: USDCNY (forex spot)
  const symbols = ['USDCNY', 'hf_USDCNY'];
  for (const sym of symbols) {
    try {
      const url = SINA_API + sym;
      const text = await fetchGBK(url);
      const regex = /var hq_str_(\w+)="([^"]*)"/g;
      const match = regex.exec(text);
      if (!match) continue;

      const fields = match[2].split(',');
      const rate = parseFloat(fields[3]) || 0;
      if (rate <= 0) continue;

      const prevClose = parseFloat(fields[2]) || rate;

      log.debug(`[fetchUsdCny] ${sym} = ${rate}`);
      return {
        name: fields[0] || 'USD/CNY',
        rate,
        prevClose,
        changePercent: prevClose > 0 ? ((rate - prevClose) / prevClose) * 100 : 0,
        timestamp: Date.now(),
      };
    } catch {
      continue;
    }
  }

  // Fallback: use cached or approximate rate so CNY price still shows
  log.warn('[fetchUsdCny] all symbols failed, using fallback rate');
  return {
    name: 'USD/CNY (估算)',
    rate: USDCNY_FALLBACK,
    prevClose: USDCNY_FALLBACK,
    changePercent: 0,
    timestamp: Date.now(),
  };
}

// ── Gold historical K-line (Eastmoney) ──
// Primary: 113.GC00Y = COMEX Gold Futures Continuous (USD/oz)
// Fallback: 116.AU0 = Shanghai Gold Futures Continuous (CNY/gram)

const GOLD_SECID_COMEX = '113.GC00Y';
const GOLD_SECID_SHFE = '116.AU0';

async function tryFetchKline(secid: string, limit: number): Promise<GoldKlinePoint[]> {
  const url = `/api/gold/api/qt/stock/kline/get?secid=${secid}&lmt=${limit}`;
  log.debug(`[fetchGoldKline] trying ${url}`);

  const res = await fetch(url);
  const json = await res.json() as { rc?: number; data?: { klines?: string[] } };
  log.debug(`[fetchGoldKline] ${secid} rc=${json?.rc}, hasData=${!!json?.data?.klines}`);

  if (json?.data?.klines) {
    return json.data.klines
      .map((line: string) => {
        const parts = line.split(',');
        return {
          date: parts[0],
          open: parseFloat(parts[1]) || 0,
          close: parseFloat(parts[2]) || 0,
          high: parseFloat(parts[3]) || 0,
          low: parseFloat(parts[4]) || 0,
        };
      })
      .filter(p => p.close > 0);
  }
  return [];
}

export async function fetchGoldKline(limit = 200): Promise<GoldKlinePoint[]> {
  // Check cache for COMEX first
  const cached = getCache(GOLD_SECID_COMEX);
  if (cached) return cached;

  try {
    // Try COMEX gold futures (USD/oz)
    let result = await tryFetchKline(GOLD_SECID_COMEX, limit);
    if (result.length > 0) {
      setCache(GOLD_SECID_COMEX, result);
      return result;
    }

    // Fallback: Shanghai gold futures (CNY/gram)
    const shfeCache = getCache(GOLD_SECID_SHFE);
    if (shfeCache) return shfeCache;

    result = await tryFetchKline(GOLD_SECID_SHFE, limit);
    if (result.length > 0) {
      setCache(GOLD_SECID_SHFE, result);
    }
    return result;
  } catch {
    log.warn('[fetchGoldKline] failed');
    return cached ?? [];
  }
}

// ── Conversion: USD/oz → CNY/gram ──
// 1 troy ounce = 31.1035 grams

const OZ_TO_GRAM = 31.1035;

export function goldUsdToCny(goldPriceUsd: number, usdCnyRate: number): number {
  return (goldPriceUsd * usdCnyRate) / OZ_TO_GRAM;
}
