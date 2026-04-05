import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@langchain/langgraph", "@langchain/langgraph-checkpoint-postgres", "@langchain/core", "socket.io"],
};

export default nextConfig;
