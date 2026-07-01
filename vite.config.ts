import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

// Custom middleware for /api/benchmark and /api/gold — creates a fresh HTTPS
// connection per request to avoid socket hang-up caused by http-proxy connection reuse.
function customProxyMiddleware(apiPath: string, hostname: string) {
  return {
    name: `${apiPath}-proxy`,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(apiPath, (req, res) => {
        const path = (req.url ?? '').replace(new RegExp(`^${apiPath}`), '') || '/'
        const options = {
          hostname,
          port: 443,
          path,
          method: req.method ?? 'GET',
          headers: {
            Referer: 'https://www.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          // New agent per request — no connection reuse
          agent: new https.Agent({ keepAlive: false }),
        }
        const proxy = https.request(options, (upstream) => {
          res.writeHead(upstream.statusCode ?? 200, {
            'Content-Type': upstream.headers['content-type'] ?? 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          upstream.pipe(res)
        })
        proxy.on('error', (err) => {
          if (!res.headersSent) res.writeHead(502)
          res.end(JSON.stringify({ error: err.message }))
        })
        req.pipe(proxy)
      })
    },
  }
}

function benchmarkMiddleware() {
  return customProxyMiddleware('/api/benchmark', 'push2his.eastmoney.com')
}

function goldMiddleware() {
  return customProxyMiddleware('/api/gold', 'push2his.eastmoney.com')
}

export default defineConfig({
  plugins: [react(), benchmarkMiddleware(), goldMiddleware()],
  server: {
    port: 4396,
    proxy: {
      // Specific /api/sina-* rules must come BEFORE generic /api/sina
      '/api/sina-stocklist': {
        target: 'https://vip.stock.finance.sina.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sina-stocklist/, ''),
        headers: {
          Referer: 'https://finance.sina.com.cn/',
        },
      },
      '/api/sina-stocklist2': {
        target: 'https://money.finance.sina.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sina-stocklist2/, ''),
        headers: {
          Referer: 'https://finance.sina.com.cn/',
        },
      },
      '/api/sina-kline': {
        target: 'https://money.finance.sina.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sina-kline/, ''),
        headers: {
          Referer: 'https://finance.sina.com.cn',
        },
      },
      '/api/sina': {
        target: 'https://hq.sinajs.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sina/, ''),
        headers: {
          Referer: 'https://finance.sina.com.cn',
        },
      },
      '/api/fundnav': {
        target: 'https://api.fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fundnav/, ''),
        headers: {
          Referer: 'https://fundf10.eastmoney.com/',
        },
      },
      '/api/fundf10': {
        target: 'https://fundf10.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fundf10/, ''),
        headers: {
          Referer: 'https://fundf10.eastmoney.com/',
        },
      },
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      },
    },
  },
})
