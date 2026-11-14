import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 에서는 https://<user>.github.io/fridge/ 아래에서 서비스
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // 푸시 알림 수신(public/push-sw.js)을 생성된 서비스워커에 붙인다
      // 식품 그림(src/assets/food/*.png)도 미리 받아 둬서 냉장고 앞 약한 와이파이에서도 그림이 나오게 한다
      workbox: { importScripts: ['push-sw.js'], globPatterns: ['**/*.{js,css,html,png}'] },
      manifest: {
        name: '냉장고를 부탁해',
        short_name: '냉장고',
        description: '우리 집 냉장고 재고와 유통기한 관리',
        lang: 'ko',
        theme_color: '#1e6b52',
        background_color: '#f3f5f2',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
