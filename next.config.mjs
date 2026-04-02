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
    '*.preview.emergentcf.cloud',
    '*.preview.emergentagent.com',
  ],
}

export default nextConfig
