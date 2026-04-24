/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 환경변수로 백엔드 URL 설정 (클라우드 배포 시 NEXT_PUBLIC_API_BASE_URL 변경)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
