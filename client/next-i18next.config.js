module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'el', 'de'],
    localeDetection: false,
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};