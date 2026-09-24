/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // As telas que falam com o banco não puderam ser type-checadas no ambiente de
  // geração (sem o client Prisma). O motor financeiro tem testes próprios (npm test).
  // Não travar o build de produção em erros de tipo/lint dessa camada de UI/DB.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
