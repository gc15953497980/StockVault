import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 40,
          color: 'var(--text)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
          }}>⚠️</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>页面出现异常</h2>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            margin: '0 0 24px',
            textAlign: 'center',
            maxWidth: 400,
          }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
              style={{
                padding: '8px 20px',
                border: '1px solid var(--primary)',
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重试
            </button>
            <button
              onClick={() => {
                // Only clear app data, not all localStorage (avoid clobbering other same-origin apps)
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k && k.startsWith('stockvault_')) keysToRemove.push(k);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                window.location.reload();
              }}
              style={{
                padding: '8px 20px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              清除缓存并刷新
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
