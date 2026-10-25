/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
    ] }];
  },
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['edge-tts-universal', 'ws'],
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
