import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['cdn.example.com'] },
}

export default withSentryConfig(nextConfig, { silent: true })
