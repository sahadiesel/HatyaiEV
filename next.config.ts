import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/projects/hiring-contracts/:path*",
        destination: "/contracts/hiring-contracts/:path*",
        permanent: true,
      },
      {
        source: "/projects/hiring-contracts",
        destination: "/contracts/hiring-contracts",
        permanent: true,
      },
      {
        source: "/projects/subcontract-agreements/:path*",
        destination: "/contracts/subcontract-agreements/:path*",
        permanent: true,
      },
      {
        source: "/projects/subcontract-agreements",
        destination: "/contracts/subcontract-agreements",
        permanent: true,
      },
      {
        source: "/projects/:id",
        destination: "/contracts",
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/contracts",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
