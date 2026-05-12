import type { Stock, Fund } from '../types';

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function checkStockAlerts(
  stocks: Stock[],
  prices: Record<string, number>
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  for (const stock of stocks) {
    const cp = prices[stock.code];
    if (!cp || cp <= 0) continue;

    // Check target price (alert when price drops to target)
    if (stock.targetPrice > 0 && cp <= stock.targetPrice * 1.02 && cp > stock.targetPrice) {
      const pct = (((cp - stock.targetPrice) / stock.targetPrice) * 100).toFixed(1);
      new Notification(`${stock.name} 接近目标价`, {
        body: `现价 ${cp.toFixed(2)}，距目标 ${stock.targetPrice.toFixed(2)} 仅差 ${pct}%`,
        icon: '/favicon.svg',
      });
    }

    // Check take-profit prices
    for (let i = 0; i < stock.takeProfitPrices.length; i++) {
      const tp = stock.takeProfitPrices[i];
      if (tp > 0 && cp >= tp) {
        new Notification(`${stock.name} 达到止盈价`, {
          body: `现价 ${cp.toFixed(2)} 已达到第${i + 1}批止盈价 ${tp.toFixed(2)}`,
          icon: '/favicon.svg',
        });
      }
    }
  }
}

export function checkFundAlerts(
  funds: Fund[],
  navs: Record<string, number>
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  for (const fund of funds) {
    const nav = navs[fund.code];
    if (!nav || nav <= 0) continue;

    // Alert when NAV drops below cost (loss warning)
    if (fund.holdingCost > 0 && nav < fund.holdingCost * 0.95) {
      const pct = (((fund.holdingCost - nav) / fund.holdingCost) * 100).toFixed(1);
      new Notification(`${fund.name || fund.code} 净值下跌`, {
        body: `最新净值 ${nav.toFixed(4)}，低于成本 ${pct}%`,
        icon: '/favicon.svg',
      });
    }

    // Alert when NAV rises 10%+ above cost
    if (fund.holdingCost > 0 && nav > fund.holdingCost * 1.1) {
      const pct = (((nav - fund.holdingCost) / fund.holdingCost) * 100).toFixed(1);
      new Notification(`${fund.name || fund.code} 收益提醒`, {
        body: `最新净值 ${nav.toFixed(4)}，盈利 ${pct}%`,
        icon: '/favicon.svg',
      });
    }
  }
}
