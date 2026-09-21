/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // The app doesn't use next/image (avatars/banners are plain <img>/CSS
    // background-image from Supabase Storage), so the optimizer is disabled
    // rather than exposed — see GHSA-2xp9-vwfh-vxw4.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
