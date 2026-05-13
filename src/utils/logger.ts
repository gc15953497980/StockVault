type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '#6b7280',
  info: '#1a73e8',
  warn: '#e67e22',
  error: '#e83929',
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 23).replace('T', ' ');
}

export function createLogger(module: string) {
  const log = (level: Level, msg: string, data?: unknown) => {
    const ts = timestamp();
    const prefix = `%c[${ts}] [${module}] [${level.toUpperCase()}]`;
    const style = `color:${COLORS[level]};font-weight:bold`;
    if (data !== undefined) {
      console.log(`${prefix} ${msg}`, style, data);
    } else {
      console.log(`${prefix} ${msg}`, style);
    }
  };

  return {
    debug: (msg: string, data?: unknown) => log('debug', msg, data),
    info: (msg: string, data?: unknown) => log('info', msg, data),
    warn: (msg: string, data?: unknown) => log('warn', msg, data),
    error: (msg: string, data?: unknown) => log('error', msg, data),
  };
}
