// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '소소 채팅방 🐱',
  description: '귀여운 캐릭터들과 함께하는 채팅방',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '소소 채팅방',
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
      <body className={inter.className}>{children}</body>
    </html>
  )
}
