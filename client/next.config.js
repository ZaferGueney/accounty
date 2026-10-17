const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  // Lets a check build or a second dev server use its own folder
  // (e.g. NEXT_DIST_DIR=.next-check) without touching the live .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
