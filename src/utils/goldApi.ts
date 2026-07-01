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
// secid: 113.GC00Y = COMEX Gold Continuous Futures

const GOLD_SECID = '113.GC00Y';

export async function fetchGoldKline(limit = 200): Promise<GoldKlinePoint[]> {
  const cached = getCache(GOLD_SECID);
  if (cached) return cached;

  try {
    const url = `/api/gold/api/qt/stock/kline/get?secid=${GOLD_SECID}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=${limit}`;
    log.debug(`[fetchGoldKline] requesting ${url}`);

    const res = await fetch(url);
    const json = await res.json() as { data?: { klines?: string[] } };

    if (json?.data?.klines) {
      const result: GoldKlinePoint[] = json.data.klines
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

      if (result.length > 0) {
        setCache(GOLD_SECID, result);
      }
      return result;
    }
    return [];
  } catch {
    log.warn('[fetchGoldKline] failed');
    // Return cached data as fallback even if expired
    return cached ?? [];
  }
}

// ── Conversion: USD/oz → CNY/gram ──
// 1 troy ounce = 31.1035 grams

const OZ_TO_GRAM = 31.1035;

export function goldUsdToCny(goldPriceUsd: number, usdCnyRate: number): number {
  return (goldPriceUsd * usdCnyRate) / OZ_TO_GRAM;
}
