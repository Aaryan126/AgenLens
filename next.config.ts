import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@langchain/langgraph", "@langchain/core", "socket.io"],
};

export default nextConfig;
