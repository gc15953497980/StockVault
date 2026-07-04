#!/usr/bin/env node
/**
 * 统计当前股价同时低于 2025-04-07 和 2024-09-23 收盘价的A股
 *
 * 排除规则：
 *   - 创业板 (300xxx / 301xxx)
 *   - 科创板 (688xxx)
 *   - 北交所 (8xxxxx / 92xxxx / 4xxxxx)
 *   - ST / *ST / 退市
 *   - 股价 > 100
 *
 * 用法：node scripts/belowHistory.mjs
 */

const SINA_KLINE_BASE = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData';
const TARGET_DATES = ['2025-04-07', '2024-09-23'];

// ── 1. 获取股票列表（从本地静态文件） ────────────────────────────

async function fetchStockList() {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const filePath = path.resolve(import.meta.dirname, '../public/stock-list.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const stocks = [];
  const seen = new Set();

  for (const item of data) {
    const code = item.code;
    if (!code || code.length < 6) continue;
    if (seen.has(code)) continue;

    const name = item.name || '';

    if (code.startsWith('300') || code.startsWith('301')) continue;
    if (code.startsWith('688')) continue;
    if (code.startsWith('8') || code.startsWith('4') || code.startsWith('9')) continue;
    if (name.includes('ST') || name.includes('退')) continue;

    seen.add(code);
    stocks.push({ code, name });
  }

  return stocks;
}

// ── 2. 获取日K线 ────────────────────────────────────────────────

async function fetchDailyKline(code, count = 500) {
  const prefix = code.startsWith('6') || code.startsWith('5') ? 'sh' : 'sz';
  const symbol = `${prefix}${code}`;

  const params = new URLSearchParams({ symbol, scale: '240', ma: 'no', datalen: String(count) });
  const url = `${SINA_KLINE_BASE}?${params}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/' },
    });
    if (!res.ok) return [];

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 10) return [];

    let text = new TextDecoder('utf-8').decode(buffer);
    let json;
    try { json = JSON.parse(text); } catch {
      text = new TextDecoder('gbk').decode(buffer);
      json = JSON.parse(text);
    }

    if (!Array.isArray(json)) return [];

    return json
      .map((item) => ({ date: item.day || '', close: parseFloat(item.close) || 0 }))
      .filter((p) => p.date && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ── 3. 取指定日期的收盘价（若无当日数据，取最近一个交易日） ──────

function getCloseOnDate(kline, targetDate) {
  let closest = null;
  for (const bar of kline) {
    if (bar.date <= targetDate) {
      closest = bar;
    } else {
      break;
    }
  }
  return closest ? { date: closest.date, close: closest.close } : null;
}

// ── 4. 主流程 ───────────────────────────────────────────────────

async function main() {
  console.log('获取股票列表...');
  const stocks = await fetchStockList();
  console.log(`共 ${stocks.length} 只 (已排除创业板/科创板/北交所/ST/退市)\n`);

  console.log('对比日期: 2025-04-07 / 2024-09-23');
  console.log('条件: 当前收盘 < 两个历史收盘，且股价 ≤ 100\n');

  /** @type {Array<{code:string, name:string, now:number, d1:{date:string,close:number}, d2:{date:string,close:number}, dropPct:number}>} */
  const results = [];
  let done = 0;
  const BATCH = 6;

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    const klines = await Promise.all(batch.map((s) => fetchDailyKline(s.code)));

    for (let j = 0; j < batch.length; j++) {
      const stock = batch[j];
      const kline = klines[j];

      if (kline.length < 10) continue;

      const nowClose = kline[kline.length - 1].close;
      if (nowClose <= 0 || nowClose > 100) continue;

      const d1 = getCloseOnDate(kline, TARGET_DATES[0]);
      const d2 = getCloseOnDate(kline, TARGET_DATES[1]);

      if (d1 && d2 && nowClose < d1.close && nowClose < d2.close) {
        // 平均跌幅 (相对于两个历史价的平均跌幅)
        const avgHist = (d1.close + d2.close) / 2;
        const dropPct = Math.round((1 - nowClose / avgHist) * 10000) / 100;
        results.push({ code: stock.code, name: stock.name, now: nowClose, d1, d2, dropPct });
      }
    }

    done += batch.length;
    const pct = ((done / stocks.length) * 100).toFixed(1);
    process.stdout.write(`\r进度: ${done}/${stocks.length} (${pct}%) | 符合: ${results.length}`);

    if (i + BATCH < stocks.length) {
      await sleep(300 + Math.random() * 400);
    }
  }

  // 按平均跌幅降序排列
  results.sort((a, b) => b.dropPct - a.dropPct);

  // ── 输出 ───────────────────────────────────────────────────────

  console.log('\n');
  console.log('═'.repeat(80));
  console.log(`  股价低于 2025-04-07 和 2024-09-23 的股票  共 ${results.length} 只`);
  console.log('═'.repeat(80));
  console.log('');
  console.log('  代码       名称        现价    2025-04-07  2024-09-23  平均跌幅%');
  console.log('  ────────────────────────────────────────────────────────');

  for (const r of results) {
    const namePad = r.name.length >= 4 ? '  ' : '    ';
    console.log(
      `  ${r.code}  ${r.name}${namePad}${String(r.now).padStart(6)}  ${String(r.d1.close).padStart(8)}  ${String(r.d2.close).padStart(8)}  ${String(r.dropPct).padStart(7)}%`,
    );
  }

  console.log('');
  console.log(`  总计: ${results.length} / ${stocks.length} (${((results.length / stocks.length) * 100).toFixed(1)}%)`);

  // CSV 输出
  const fs = await import('node:fs');
  const lines = ['code,name,now,close_20250407,close_20240923,pct_avg_drop'];
  for (const r of results) {
    lines.push(`${r.code},${r.name},${r.now},${r.d1.close},${r.d2.close},${r.dropPct}`);
  }
  fs.writeFileSync('belowHistory.csv', lines.join('\n'), 'utf-8');
  console.log(`\nCSV 已保存到 belowHistory.csv`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('错误:', err);
  process.exit(1);
});
