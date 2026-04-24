import './globals.css'

export const metadata = {
  title: 'TS객실제어 - 무인 숙박 키오스크',
  description: 'TS객실제어 스마트 무인 숙박 시스템 - 편리한 셀프 체크인/체크아웃',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TS객실제어',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] text-white">
        {children}
      </body>
    </html>
  )
}
