/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    async rewrites() {
        return [
          {
            source: '/api/v1/:path*',
            destination: 'http://54.209.206.60:3000/api/v1/:path*',
          },
        ];
      },
};

export default nextConfig;
