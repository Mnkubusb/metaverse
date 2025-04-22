/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    async rewrites() {
        return [
          {
            source: '/api/v1/:path*',
            destination: 'http://54.237.240.145:3000/api/v1/:path*',
          },
        ];
      },
};

export default nextConfig;
