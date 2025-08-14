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
}

module.exports = nextConfig
