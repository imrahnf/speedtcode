/** @type {import('next').NextConfig} */
console.log("Loading next.config.mjs with allowedDevOrigins...");

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "localhost:3000",
    "0.0.0.0:3000",
    "192.168.0.109:3000",
    "192.168.0.109",
    "10.16.182.157:3000",
    "192.168.0.100:3000",
    "192.168.0.125:3000",
    "172.29.160.1:3000"
  ],
};

export default nextConfig;
