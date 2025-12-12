import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import mkcert from 'vite-plugin-mkcert'

// src/vite.config.ts
export default defineConfig({
  server: {
    host: 'localhost',
    https: true,
    cors: true,
  },
  plugins: [

    monkey({
      entry: 'src/main.ts',

      userscript: {
        name: 'Bybit P2P Filter Enhanced',
        namespace: 'http://tampermonkey.net/',
        version: '3.0',
        description: 'Продвинутый фильтр для Bybit P2P',
        match: 'https://www.bybit.com/*/p2p/*/USDT/RUB',

        grant: ['GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue'],
        'run-at': 'document-end',

        // --- СЮДА НУЖНО ДОБАВИТЬ ВАШ БОЕВОЙ ДОМЕН ---
        // Разрешаем подключение к серверу разработки (уже есть)
        connect: [
          'localhost:5173',
          // Добавляем домен, к которому скрипт пытается подключиться
          'orders-finances-68zktfy1k-ospa2s-projects.vercel.app'
        ],
        // ----------------------------------------------
      },
    }),
    mkcert()
  ],
});