export type Market = 'a' | 'hk' | 'us';

export type StockType = 'stock' | 'etf';

export interface Stock {
  id: string;
  code: string;
  name: string;
  type: StockType;
  shares: number;
  holdingCost: number;
  targetPrice: number;
  targetMarketValue: number;
  marketCap: number;
  buyPrices: number[];
  buyShares: number[];
  takeProfitPrices: number[];
  takeProfitShares: number[];
  tags: string[];
  market: Market;
  accountId?: string;
}

export interface StockWithPrice extends Stock {
  currentPrice: number;
  timestamp: number;
}

export interface StockCalculations {
  currentMarketValue: number;
  targetMarketValue: number;
  targetPrice: number;
  dropToTargetPercent: number;
  costTotal: number;
  profitLoss: number;
  profitLossPercent: number;
}

export const FORMATION_OPTIONS = [
  '中证A500', '沪深300', '红利', '双创', '恒科',
  '中证500', '白酒', '黄金', '港消费', '其他',
] as const;

export interface Fund {
  id: string;
  code: string;
  name: string;
  sector: string;
  formation: string;
  holdingAmount: number;
  holdingCost: number;
  tags: string[];
  accountId?: string;
}

export const SECTOR_OPTIONS = [
  '科技', '消费', '医药', '金融', '债券',
  '混合', '指数', '红利', '自由现金流', '家电',
] as const;

export const TAG_PRESETS = [
  '长线', '短线', '网格', '观察中', '高股息', '成长股',
  '价值投资', '定投', '重仓', '轻仓',
] as const;

export interface FundWithPrice extends Fund {
  currentNAV: number;
  accumulatedNAV: number;
  dailyChange: number;
  dailyChangePercent: number;
  timestamp: number;
}

export interface FundCalculations {
  shares: number;
  marketValue: number;
  costTotal: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface StockTx {
  id: string;
  date: string;
  type: 'buy' | 'sell' | 'grid_buy' | 'grid_sell';
  price: number;
  shares: number;
}

export interface StockDividend {
  id: string;
  date: string;
  amount: number;
}

export interface FundTx {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  nav: number;
  amount: number;
}

export interface FundDividend {
  id: string;
  date: string;
  type: 'cash' | 'reinvest';
  amount: number;
}

export interface FundNavPoint {
  date: string;
  nav: number;
  growthRate: number;
}

// Watchlist types
export interface WatchItem {
  id: string;
  code: string;
  name: string;
  type: 'stock' | 'fund';
  market: Market;
  note: string;
  addedAt: string;
}

export interface WatchItemWithPrice extends WatchItem {
  currentPrice: number;
  dailyChangePercent: number;
}

// Notes types
export interface Note {
  id: string;
  date: string;
  title: string;
  content: string;
}

// Benchmark types
export interface BenchmarkPoint {
  date: string;
  value: number;
}

// PnL Calendar types
export interface DailyPnl {
  date: string;
  pnl: number;
  pnlPercent: number;
}

// Account types
export interface Account {
  id: string;
  name: string;
  createdAt: string;
}

// Grid trading types
export interface GridConfig {
  id: string;
  stockId: string;
  lowPrice: number;
  highPrice: number;
  gridCount: number;
  amountPerGrid: number;
  createdAt: string;
}
