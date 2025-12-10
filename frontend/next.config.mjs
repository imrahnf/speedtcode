/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['http://localhost:3000', 'http://192.168.0.100:3000', 'http://192.168.0.125:3000'],
};

export default nextConfig;
