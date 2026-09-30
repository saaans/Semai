import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Jangan biarkan `next dev` menambah blok otomatis ke CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
