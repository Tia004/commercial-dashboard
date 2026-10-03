/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure we don't compile stitch_omnihub_ai_sales_crm
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/stitch_omnihub_ai_sales_crm/**', '**/node_modules/**'],
    };
    return config;
  },
};

module.exports = nextConfig;
