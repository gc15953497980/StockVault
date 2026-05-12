export interface Stock {
  id: string;
  code: string;
  name: string;
  shares: number;
  holdingCost: number;
  targetPrice: number;
  targetMarketValue: number;
  marketCap: number;
  buyPrices: number[];
  buyShares: number[];
  takeProfitPrices: number[];
  takeProfitShares: number[];
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

export interface Fund {
  id: string;
  code: string;
  name: string;
  sector: string;
  holdingAmount: number;
  holdingCost: number;
}

export const SECTOR_OPTIONS = [
  '科技', '消费', '医药', '新能源', '金融',
  '军工', '制造', '周期', '债券', '混合',
  '指数', '其他',
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
  type: 'buy' | 'sell';
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
