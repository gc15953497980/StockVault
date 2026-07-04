#!/usr/bin/env node
/**
 * 统计收盘价在5日线(MA5)上方的A股
 *
 * 排除规则：
 *   - 创业板 (300xxx / 301xxx)
 *   - 科创板 (688xxx)
 *   - 北交所 (8xxxxx / 92xxxx / 4xxxxx)
 *   - ST / *ST
 *   - 退市
 *
 * 用法：node scripts/aboveMa5.mjs
 */

const SINA_KLINE_BASE = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData';

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

    // 过滤创业板
    if (code.startsWith('300') || code.startsWith('301')) continue;
    // 过滤科创板
    if (code.startsWith('688')) continue;
    // 过滤北交所 (8x和92开头) + 老三板(4开头)
    if (code.startsWith('8') || code.startsWith('4') || code.startsWith('9')) continue;
    // 过滤 ST / 退市
    if (name.includes('ST') || name.includes('退')) continue;

    seen.add(code);
    stocks.push({ code, name });
  }

  return stocks;
}

// ── 2. 获取日K线（新浪API，兼容GBK编码） ──────────────────────────

/**
 * @param {string} code  6位股票代码
 * @param {number} count  获取条数，默认10
 * @returns {Promise<Array<{date:string, close:number}>>}
 */
async function fetchDailyKline(code, count = 10) {
  // 新浪symbol格式: sh600519 / sz000001
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

    // 尝试 UTF-8，失败则用 GBK（新浪有时返回GBK编码JSON）
    let text = new TextDecoder('utf-8').decode(buffer);
    let json;
    try {
      json = JSON.parse(text);
    } catch {
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

// ── 3. 计算 MA5 ─────────────────────────────────────────────────

/**
 * @param {Array<{date:string, close:number}>} kline
 * @returns {number | null}
 */
function calcMa5(kline) {
  if (kline.length < 5) return null;
  const last5 = kline.slice(-5);
  return last5.reduce((s, b) => s + b.close, 0) / 5;
}

// ── 4. 主流程 ───────────────────────────────────────────────────

async function main() {
  console.log('获取股票列表...');
  const stocks = await fetchStockList();
  console.log(`共 ${stocks.length} 只 (已排除创业板/科创板/北交所/ST/退市)\n`);

  console.log('逐只拉取K线并计算MA5...\n');

  /** @type {Array<{code:string, name:string, close:number, ma5:number, pctAbove:number}>} */
  const above = [];
  let done = 0;
  const BATCH = 6; // 并发数

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    const klines = await Promise.all(batch.map((s) => fetchDailyKline(s.code)));

    for (let j = 0; j < batch.length; j++) {
      const stock = batch[j];
      const kline = klines[j];
      const ma5 = calcMa5(kline);

      if (ma5 !== null && kline.length > 0) {
        const lastClose = kline[kline.length - 1].close;
        if (lastClose > ma5 && lastClose <= 100) {
          above.push({
            code: stock.code,
            name: stock.name,
            close: lastClose,
            ma5: Math.round(ma5 * 100) / 100,
            pctAbove: Math.round((lastClose / ma5 - 1) * 10000) / 100,
          });
        }
      }
    }

    done += batch.length;

    const pct = ((done / stocks.length) * 100).toFixed(1);
    process.stdout.write(`\r进度: ${done}/${stocks.length} (${pct}%) | 线上: ${above.length}`);

    // 批次间稍作延迟
    if (i + BATCH < stocks.length) {
      await sleep(300 + Math.random() * 400);
    }
  }

  // 按偏离幅度降序排列
  above.sort((a, b) => b.pctAbove - a.pctAbove);

  // ── 输出 ───────────────────────────────────────────────────────

  console.log('\n');
  console.log('═'.repeat(72));
  console.log(`  收盘价在 5日线 上方的股票  共 ${above.length} 只`);
  console.log('═'.repeat(72));
  console.log('');
  console.log('  代码      名称         收盘价     MA5      线上%');
  console.log('  ─────────────────────────────────────────────');

  for (const r of above) {
    const namePad = r.name.length >= 4 ? '  ' : '    ';
    console.log(
      `  ${r.code}   ${r.name}${namePad}${String(r.close).padStart(7)}  ${String(r.ma5).padStart(7)}  ${String(r.pctAbove).padStart(6)}%`,
    );
  }

  console.log('');
  console.log(`  总计: ${above.length} / ${stocks.length} (${((above.length / stocks.length) * 100).toFixed(1)}%)`);

  // CSV 输出
  const fs = await import('node:fs');
  const lines = ['code,name,close,ma5,pct_above'];
  for (const r of above) {
    lines.push(`${r.code},${r.name},${r.close},${r.ma5},${r.pctAbove}`);
  }
  fs.writeFileSync('aboveMa5.csv', lines.join('\n'), 'utf-8');
  console.log(`\nCSV 已保存到 aboveMa5.csv`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('错误:', err);
  process.exit(1);
});
