import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Market } from '../types';
import { fetchStockKline, type KlineBar, type KlinePeriod } from '../utils/api';
import { marketLabel } from '../utils/api';
import styles from './KlineChartModal.module.css';

interface Props {
  code: string;
  name: string;
  market: Market;
  onClose: () => void;
}

const PERIODS: { key: KlinePeriod; label: string }[] = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
];

const MA_CONFIGS = [
  { period: 5, color: '#f9a825' },
  { period: 10, color: '#e040fb' },
  { period: 20, color: '#00bcd4' },
  { period: 60, color: '#ff6e40' },
];

function toTime(date: string): Time {
  const [y, m, d] = date.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) / 1000) as UTCTimestamp;
}

function computeMA(data: KlineBar[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: toTime(data[i].date), value: sum / period });
  }
  return result;
}

export default function KlineChartModal({ code, name, market, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [period, setPeriod] = useState<KlinePeriod>('day');
  const [klineData, setKlineData] = useState<KlineBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data when period changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await fetchStockKline(code, period);
        if (!active) return;
        if (data.length === 0) {
          setError('暂无K线数据（可能不支持该市场，或代码有误）');
        } else {
          setKlineData(data);
        }
      } catch {
        if (active) setError('获取K线数据失败，请稍后重试');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [code, period]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || klineData.length === 0) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#999',
      },
      grid: {
        vertLines: { color: '#1e1e3a' },
        horzLines: { color: '#1e1e3a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#2a2a4a',
        timeVisible: period === 'day',
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2a2a4a',
        autoScale: true,
      },
    });

    // ── Candlestick ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#e83929',
      downColor: '#22c55e',
      borderUpColor: '#e83929',
      borderDownColor: '#22c55e',
      wickUpColor: '#e83929',
      wickDownColor: '#22c55e',
    });

    candleSeries.setData(
      klineData.map(d => ({
        time: toTime(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // ── Volume (on separate price scale, compressed to bottom 20%) ──
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.setData(
      klineData.map(d => ({
        time: toTime(d.date),
        value: d.volume,
        color: d.close >= d.open ? 'rgba(232,57,41,0.35)' : 'rgba(34,197,94,0.35)',
      }))
    );

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // ── MA lines ──
    for (const cfg of MA_CONFIGS) {
      const maData = computeMA(klineData, cfg.period);
      if (maData.length > 0) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: cfg.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineSeries.setData(maData);
      }
    }

    // Fit content
    chart.timeScale().fitContent();

    // Resize observer
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    observer.observe(container);

    chartRef.current = chart;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [klineData, period]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Latest bar stats
  const latest = klineData.length > 0 ? klineData[klineData.length - 1] : null;
  const prev = klineData.length > 1 ? klineData[klineData.length - 2] : null;
  const latestChange = latest && prev && prev.close > 0
    ? ((latest.close - prev.close) / prev.close) * 100
    : 0;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>{name || code}</span>
          <span className={styles.codeLabel}>{code}</span>
          <span className={styles.codeLabel}>{marketLabel(market)}</span>
          <div className={styles.spacer} />

          <div className={styles.periodGroup}>
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`${styles.periodBtn} ${period === p.key ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button className={styles.closeBtn} onClick={onClose}>关闭</button>
        </div>

        {/* Chart */}
        <div className={styles.chartArea} ref={containerRef}>
          {loading && <div className={styles.loading}>加载中...</div>}
          {error && !loading && <div className={styles.error}>{error}</div>}
        </div>

        {/* Footer */}
        {latest && (
          <div className={styles.footer}>
            <span className={styles.footerPrice}>
              {latest.close.toFixed(2)}
            </span>
            <span className={latestChange >= 0 ? styles.footerUp : styles.footerDown}>
              {latestChange >= 0 ? '+' : ''}{latestChange.toFixed(2)}%
            </span>
            <span>O: {latest.open.toFixed(2)}</span>
            <span>H: {latest.high.toFixed(2)}</span>
            <span>L: {latest.low.toFixed(2)}</span>
            <span>V: {(latest.volume / 10000).toFixed(0)}万手</span>
            <div className={styles.spacer} />
            <div className={styles.legendGroup}>
              {MA_CONFIGS.map(cfg => (
                <span key={cfg.period} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: cfg.color }} />
                  MA{cfg.period}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
