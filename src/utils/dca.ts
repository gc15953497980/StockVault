import type { FundNavPoint } from '../types';

interface DcaResult {
  totalInvested: number;
  totalShares: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  irr: number; // approximate annualized IRR
  lumpSumValue: number;
  lumpSumReturnPercent: number;
  navPoints: { date: string; nav: number; shares: number; cumulativeShares: number; invested: number; value: number }[];
}

export function simulateDCA(
  history: FundNavPoint[],
  amount: number,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  startDate: string,
  endDate: string
): DcaResult | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Filter relevant data points
  const relevant = sorted.filter(p => {
    const d = new Date(p.date);
    return d >= start && d <= end;
  });

  if (relevant.length === 0) return null;

  let totalInvested = 0;
  let totalShares = 0;
  const navPoints: DcaResult['navPoints'] = [];

  // Determine investment dates
  const investDates: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    investDates.push(new Date(current));
    switch (frequency) {
      case 'weekly': current.setDate(current.getDate() + 7); break;
      case 'biweekly': current.setDate(current.getDate() + 14); break;
      case 'monthly': current.setMonth(current.getMonth() + 1); break;
    }
  }

  // Simulate DCA
  for (const investDate of investDates) {
    const dateStr = investDate.toISOString().split('T')[0];
    // Find closest NAV
    let closestNav = 0;
    let closestDate = dateStr;
    for (const p of relevant) {
      if (p.date <= dateStr) {
        closestNav = p.nav;
        closestDate = p.date;
      }
    }
    if (closestNav > 0) {
      const shares = amount / closestNav;
      totalInvested += amount;
      totalShares += shares;
      navPoints.push({
        date: closestDate,
        nav: closestNav,
        shares,
        cumulativeShares: totalShares,
        invested: totalInvested,
        value: totalShares * closestNav,
      });
    }
  }

  if (totalInvested === 0) return null;

  const lastNav = relevant[relevant.length - 1].nav;
  const finalValue = totalShares * lastNav;
  const totalReturn = finalValue - totalInvested;
  const totalReturnPercent = (totalReturn / totalInvested) * 100;

  // Lump sum comparison
  const firstNav = relevant[0].nav;
  const lumpSumShares = totalInvested / firstNav;
  const lumpSumValue = lumpSumShares * lastNav;
  const lumpSumReturnPercent = ((lumpSumValue - totalInvested) / totalInvested) * 100;

  // Simple IRR approximation
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const irr = years > 0 ? (Math.pow(finalValue / totalInvested, 1 / years) - 1) * 100 : totalReturnPercent;

  return {
    totalInvested,
    totalShares,
    finalValue,
    totalReturn,
    totalReturnPercent,
    irr,
    lumpSumValue,
    lumpSumReturnPercent,
    navPoints,
  };
}

// Calculate new average cost after averaging down
export interface AvgDownResult {
  newHoldingCost: number;
  newShares: number;
  newTotalInvested: number;
  breakEvenPrice: number;
  breakEvenDropPercent: number;
}

export function calcAveragingDown(
  currentCost: number,
  currentShares: number,
  currentPrice: number,
  addAmount: number
): AvgDownResult {
  const newShares = addAmount / currentPrice;
  const newTotalInvested = currentCost * currentShares + addAmount;
  const totalShares = currentShares + newShares;
  const newHoldingCost = newTotalInvested / totalShares;
  const breakEvenDropPercent = currentPrice > 0
    ? ((currentCost - newHoldingCost) / currentCost) * 100
    : 0;

  return {
    newHoldingCost,
    newShares,
    newTotalInvested,
    breakEvenPrice: newHoldingCost,
    breakEvenDropPercent,
  };
}

export function generateAvgDownCurve(
  currentCost: number,
  currentShares: number,
  currentPrice: number,
  maxMultiple: number = 5
): { amount: number; cost: number; label: string }[] {
  const baseAmount = currentCost * currentShares;
  const results: { amount: number; cost: number; label: string }[] = [];

  for (let i = 0; i <= 20; i++) {
    const amount = (baseAmount * maxMultiple * i) / 20;
    const result = calcAveragingDown(currentCost, currentShares, currentPrice, amount);
    results.push({
      amount,
      cost: result.newHoldingCost,
      label: amount >= 1e4 ? (amount / 1e4).toFixed(1) + '万' : amount.toFixed(0),
    });
  }

  return results;
}
