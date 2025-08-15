/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 13+ 에서는 App Router가 기본값이므로 appDir 옵션 불필요
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: [],
    unoptimized: false,
  },
  // Production 환경에서 최적화
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  // 정적 파일 최적화
  trailingSlash: false,
  // 폰트 최적화
  optimizeFonts: true,
  // React Strict Mode 비활성화 (개발 환경에서 Pusher 연결 안정성을 위해)
  reactStrictMode: false,
  
  // PWA 및 Service Worker 설정
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
  
  // Vercel 환경 최적화
  experimental: {
    serverComponentsExternalPackages: ['web-push'],
  },
  
  // 환경 변수 설정
  env: {
    CUSTOM_ENV: process.env.NODE_ENV,
  },
}

module.exports = nextConfig
