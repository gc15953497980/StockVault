import { useEffect, useRef, useState, useCallback } from 'react';

interface AutoRefreshOptions {
  onRefresh: () => Promise<void>;
}

export function useAutoRefresh({ onRefresh }: AutoRefreshOptions) {
  const [autoRefresh, setAutoRefresh] = useState(
    localStorage.getItem('stockvault_auto_refresh') === '1'
  );
  const [intervalMinutes, setIntervalMinutes] = useState(() => {
    const saved = localStorage.getItem('stockvault_auto_refresh_interval');
    return saved ? parseInt(saved) : 5;
  });
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleAutoRefresh = useCallback((v: boolean) => {
    setAutoRefresh(v);
    localStorage.setItem('stockvault_auto_refresh', v ? '1' : '0');
    if (!v) setNextRefresh(null);
    else setNextRefresh(new Date(Date.now() + intervalMinutes * 60000));
  }, [intervalMinutes]);

  const setIntervalMinutesWithSave = useCallback((v: number) => {
    setIntervalMinutes(v);
    localStorage.setItem('stockvault_auto_refresh_interval', String(v));
    if (autoRefresh) {
      setNextRefresh(new Date(Date.now() + v * 60000));
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!autoRefresh) {
      return;
    }

    timerRef.current = setInterval(() => {
      if (document.hidden) return;
      onRefresh();
      setNextRefresh(new Date(Date.now() + intervalMinutes * 60000));
    }, intervalMinutes * 60000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, intervalMinutes, onRefresh]);

  return {
    autoRefresh,
    toggleAutoRefresh,
    intervalMinutes,
    setIntervalMinutes: setIntervalMinutesWithSave,
    nextRefresh,
  };
}
