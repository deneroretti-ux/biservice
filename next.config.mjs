/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 🔴 Ignora ERROS de TypeScript no build (Vercel)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🔴 Ignora ERROS de ESLint no build (Vercel)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
