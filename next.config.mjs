/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desliga o otimizador de imagens (mitiga GHSA-2xp9 / AVIF). Só servimos a logo,
  // não precisamos de otimização. next/image serve o arquivo diretamente.
  images: { unoptimized: true },
  // Não expõe o cabeçalho de versão do Next.
  poweredByHeader: false,
};
export default nextConfig;
