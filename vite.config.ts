import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

// Custom middleware for /api/benchmark — creates a fresh HTTPS connection per
// request to avoid socket hang-up caused by http-proxy connection reuse.
function benchmarkMiddleware() {
  return {
    name: 'benchmark-proxy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/benchmark', (req, res) => {
        const path = (req.url ?? '').replace(/^\/api\/benchmark/, '') || '/'
        const options = {
          hostname: 'push2his.eastmoney.com',
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

export default defineConfig({
  plugins: [react(), benchmarkMiddleware()],
  server: {
    port: 4396,
    proxy: {
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
      '/api/gold': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gold/, ''),
        headers: {
          Referer: 'https://www.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        agent: false,
      },
      '/api/fundf10': {
        target: 'https://fundf10.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fundf10/, ''),
        headers: {
          Referer: 'https://fundf10.eastmoney.com/',
        },
      },

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
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      },
    },
  },
})
