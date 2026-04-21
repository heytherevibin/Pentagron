import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: {},
  async rewrites() {
    // Server-side API base for rewrites (Docker: use service DNS name).
    // Fallback to NEXT_PUBLIC_API_URL so local dev keeps working.
    const apiUrl =
      process.env.API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:8080'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
