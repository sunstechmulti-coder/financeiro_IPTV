/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Permitir acesso do preview do Emergent
  allowedDevOrigins: [
    'public-repo-scout.cluster-0.preview.emergentcf.cloud',
    'public-repo-scout.cluster-5.preview.emergentcf.cloud',
    'local.preview.emergentcf.cloud',
  ],
}

export default nextConfig
