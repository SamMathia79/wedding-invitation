import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  },
  async redirects() {
    return [
      {
        source: '/admin.html',
        destination: '/admin',
        permanent: true
      },
      {
        source: '/index.html',
        destination: '/',
        permanent: true
      }
    ];
  }
};

export default nextConfig;
