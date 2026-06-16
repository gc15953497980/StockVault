import { useEffect } from 'react';
import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { useValueHistoryStore } from '../store/useValueHistoryStore';
import { usePnlCalendarStore } from '../store/usePnlCalendarStore';

/** 检查当前是否在 A 股收盘窗口（15:00-15:10 北京时间） */
function isMarketCloseWindow(): boolean {
  const now = new Date();
  const hour = parseInt(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hour12: false,
  }).format(now), 10);
  const minute = parseInt(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    minute: '2-digit',
  }).format(now), 10);
  return hour === 15 && minute >= 0 && minute < 10;
}

async function refreshAndRecord() {
  try {
    await Promise.all([
      useStockStore.getState().refreshPrices(),
      useFundStore.getState().refreshPrices(),
    ]);
  } catch { /* ignore */ }
  useValueHistoryStore.getState().recordSnapshot();
  usePnlCalendarStore.getState().recordToday();
}

/**
 * 收盘快照 hook：
 * - 每分钟检测是否在 15:00-15:10，若是则刷新行情并记录快照
 * - 启动后轮询 2s 等价格加载后记录初始盈亏
 */
export function useMarketCloseSnapshot() {
  useEffect(() => {
    let marketCloseRecorded = false;

    const closeTimer = setInterval(() => {
      if (isMarketCloseWindow() && !marketCloseRecorded) {
        marketCloseRecorded = true;
        refreshAndRecord();
      }
      if (!isMarketCloseWindow()) {
        marketCloseRecorded = false;
      }
    }, 60_000);

    // Record initial PnL after prices load
    let attempts = 0;
    const initTimer = setInterval(() => {
      attempts++;
      const { stocks, prices } = useStockStore.getState();
      const hasPrices = stocks.length === 0 || Object.keys(prices).length > 0;
      if (hasPrices || attempts >= 30) {
        clearInterval(initTimer);
        usePnlCalendarStore.getState().recordToday();
      }
    }, 2000);

    return () => {
      clearInterval(closeTimer);
      clearInterval(initTimer);
    };
  }, []);
}
