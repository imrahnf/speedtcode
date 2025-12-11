/** @type {import('next').NextConfig} */
console.log("Loading next.config.js with allowedDevOrigins...");

const nextConfig = {
  reactCompiler: true,
  // allowedDevOrigins expects host:port strings
  allowedDevOrigins: [
    "localhost:3000",
    "http://localhost:3000",
    "10.16.182.157:3000",
    "http://10.16.182.157:3000",
    "192.168.0.100:3000",
    "http://192.168.0.100:3000",
    "192.168.0.125:3000",
    "http://192.168.0.125:3000",
    "http://10.16.182.157:8000",
  ],
};

module.exports = nextConfig;
