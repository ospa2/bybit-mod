import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import mkcert from 'vite-plugin-mkcert'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts', // Указывает на твой главный файл
      
      userscript: {
        name: 'Bybit P2P Filter Enhanced',
        namespace: 'http://tampermonkey.net/',
        version: '3.0', // Можешь начать с 1.0
        description: 'Продвинутый фильтр для Bybit P2P',
        match: 'https://www.bybit.com/*/p2p/*/USDT/RUB',
        
        grant: ['GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue'],
        'run-at': 'document-end',
        
      },
    }),
    mkcert()
  ],
});
