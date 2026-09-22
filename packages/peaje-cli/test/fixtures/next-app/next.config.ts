import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/menu-viejo', destination: '/menu' }]
  },
}

export default nextConfig
