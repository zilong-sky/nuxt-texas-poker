export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: true,
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],
  nitro: {
    preset: 'vercel'
  },
  typescript: {
    strict: false
  },
  app: {
    head: {
      title: 'Texas Poker',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no',
      meta: [
        { name: 'format-detection', content: 'telephone=no' }
      ]
    }
  },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    // 服务器端专用（Vercel KV 使用环境变量自动读取）
    public: {}
  }
})
