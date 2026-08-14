import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Points Next's file tracing at the pnpm workspace root so the standalone
  // build correctly bundles the @filecloud/db and @filecloud/storage
  // workspace packages instead of just this app's own directory.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
