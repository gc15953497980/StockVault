import type { Stock, Fund } from '../types';

const NOTIFIED_KEY = 'stockvault_notified_alerts';

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch { return new Set(); }
}

function saveNotifiedSet(set: Set<string>) {
  try {
    // Prune by date: keep only entries from the last 30 days to avoid unbounded growth
    // while still preventing same-day duplicates. Entry format: `${type}_${id}_${date}`
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const arr = [...set].filter(entry => {
      const parts = entry.split('_');
      const datePart = parts[parts.length - 1];
      return datePart >= cutoffStr;
    });
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

function shouldNotify(id: string): boolean {
  const set = getNotifiedSet();
  if (set.has(id)) return false;
  set.add(id);
  saveNotifiedSet(set);
  return true;
}

export function clearNotificationHistory() {
  localStorage.removeItem(NOTIFIED_KEY);
}

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

  const today = new Date().toISOString().slice(0, 10);

  for (const stock of stocks) {
    const cp = prices[stock.code];
    if (!cp || cp <= 0) continue;

    // Check target price (alert when price drops to target)
    if (stock.targetPrice > 0 && cp <= stock.targetPrice * 1.02 && cp > stock.targetPrice) {
      const alertId = `stock_target_${stock.id}_${today}`;
      if (!shouldNotify(alertId)) continue;
      const pct = (((cp - stock.targetPrice) / stock.targetPrice) * 100).toFixed(1);
      new Notification(`${stock.name} 接近目标价`, {
        body: `现价 ${cp.toFixed(2)}，距目标 ${stock.targetPrice.toFixed(2)} 仅差 ${pct}%`,
      });
    }

    // Check take-profit prices
    for (let i = 0; i < stock.takeProfitPrices.length; i++) {
      const tp = stock.takeProfitPrices[i];
      if (tp > 0 && cp >= tp) {
        const alertId = `stock_tp_${stock.id}_${i}_${today}`;
        if (!shouldNotify(alertId)) continue;
        new Notification(`${stock.name} 达到止盈价`, {
          body: `现价 ${cp.toFixed(2)} 已达到第${i + 1}批止盈价 ${tp.toFixed(2)}`,
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

  const today = new Date().toISOString().slice(0, 10);

  for (const fund of funds) {
    const nav = navs[fund.code];
    if (!nav || nav <= 0) continue;

    // Alert when NAV drops below cost (loss warning)
    if (fund.holdingCost > 0 && nav < fund.holdingCost * 0.95) {
      const alertId = `fund_loss_${fund.id}_${today}`;
      if (!shouldNotify(alertId)) continue;
      const pct = (((fund.holdingCost - nav) / fund.holdingCost) * 100).toFixed(1);
      new Notification(`${fund.name || fund.code} 净值下跌`, {
        body: `最新净值 ${nav.toFixed(4)}，低于成本 ${pct}%`,
      });
    }

    // Alert when NAV rises 10%+ above cost
    if (fund.holdingCost > 0 && nav > fund.holdingCost * 1.1) {
      const alertId = `fund_gain_${fund.id}_${today}`;
      if (!shouldNotify(alertId)) continue;
      const pct = (((nav - fund.holdingCost) / fund.holdingCost) * 100).toFixed(1);
      new Notification(`${fund.name || fund.code} 收益提醒`, {
        body: `最新净值 ${nav.toFixed(4)}，盈利 ${pct}%`,
      });
    }
  }
}
