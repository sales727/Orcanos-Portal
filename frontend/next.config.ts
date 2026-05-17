import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && {
    async rewrites() {
      return {
        // fallback only runs if no Next.js route matched — so /api/auth/* is
        // handled by the route handler first and never reaches this proxy
        fallback: [
          {
            source: "/api/:path*",
            destination: "http://localhost:8000/api/:path*",
          },
        ],
      };
    },
  }),
};

export default nextConfig;
