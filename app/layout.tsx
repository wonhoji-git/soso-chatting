// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import MobileDebugger from '@/components/MobileDebugger'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '소소 채팅방 🐱',
  description: '귀여운 캐릭터들과 함께하는 채팅방',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/cat.jpg',
    apple: '/images/cat.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '소소 채팅방',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: '소소 채팅방',
    title: '소소 채팅방 🐱',
    description: '귀여운 캐릭터들과 함께하는 실시간 채팅',
    images: ['/images/cat.jpg'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // iPhone X+ notch support
  themeColor: '#ec4899', // Pink theme for mobile browsers
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="소소 채팅방" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          {children}
          <MobileDebugger />
        </ErrorBoundary>
      </body>
    </html>
  )
}
