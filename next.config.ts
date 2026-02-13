import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'myvibeproject.bb4be4706863711bab16632895c4fab3.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // PDF.js configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    // Handle PDF.js worker
    config.module.rules.push({
      test: /\.pdf$/,
      type: 'asset/resource',
    });

    return config;
  },
  // Exclude backup and chrome-extension from page directory scanning
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
};

export default nextConfig;
