/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://107.23.47.248:3000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;

