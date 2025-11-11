import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/icon', '@nuxt/image'],
  css: ['./app/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  app: {
    head: {
      title: 'Portfolio Enpii',
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  runtimeConfig: {
    brevoSmtpHost: process.env.BREVO_SMTP_HOST,
    brevoSmtpPort: process.env.BREVO_SMTP_PORT,
    brevoSmtpUser: process.env.BREVO_SMTP_USER,
    brevoSmtpPass: process.env.BREVO_SMTP_PASS,
    contactReceiver: process.env.CONTACT_RECEIVER,
  },
})