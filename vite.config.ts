import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
      '/api/benchmark': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/benchmark/, ''),
      },
      '/api/gold': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gold/, ''),
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
