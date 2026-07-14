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
        source: "/clients",
        destination: "/entities",
        permanent: false,
      },
      {
        source: "/clients/:path*",
        destination: "/entities",
        permanent: false,
      },
      {
        source: "/contractors",
        destination: "/entities",
        permanent: false,
      },
      {
        source: "/contractors/:path*",
        destination: "/entities",
        permanent: false,
      },
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
        destination: "/contracts/hiring-contracts",
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/contracts/hiring-contracts",
        permanent: true,
      },
      {
        source: "/contracts",
        destination: "/contracts/hiring-contracts",
        permanent: false,
      },
      {
        source: "/documents/hire-contract",
        destination: "/contracts/subcontract-agreements",
        permanent: false,
      },
      {
        source: "/documents/hire-contract/:path*",
        destination: "/contracts/subcontract-agreements",
        permanent: false,
      },
      {
        source: "/services",
        destination: "/contracts/subcontract-agreements",
        permanent: false,
      },
      {
        source: "/services/:path*",
        destination: "/contracts/subcontract-agreements",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
