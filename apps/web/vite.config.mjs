import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { assertWebSupabaseEnv } from "./scripts/assert-supabase-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guardMode =
  process.env.NODE_ENV === "production" || process.argv.some((arg) => /\bbuild\b/.test(arg))
    ? "production"
    : "development";

assertWebSupabaseEnv(guardMode, __dirname);

// Part 75 — the commit actually packaged into the bundle, so the login screen
// can show a safe environment/build identifier (never full URLs/keys) and
// remove ambiguity about "which deploy is this". Vercel exposes the SHA via
// VERCEL_GIT_COMMIT_SHA (not VITE_-prefixed, so it never reaches the client on
// its own); outside Vercel (local build), it falls back to the real git HEAD.
function resolveCommitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { cwd: __dirname }).toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
    define: {
      "import.meta.env.VITE_COMMIT_SHA": JSON.stringify(resolveCommitSha()),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@music-os-360/config/environment": path.resolve(__dirname, "../../packages/config/src/environment.ts"),
        "@music-os-360/ai-skills": path.resolve(__dirname, "../../packages/ai-skills/src/index.ts"),
        "@music-os-360/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "@sentry/react",
        "posthog-js",
      ],
    },
    build: {
      outDir: path.resolve(__dirname, "../../dist"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router")
            )
              return "vendor-react";
            if (
              id.includes("node_modules/@radix-ui/") ||
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/react-icons")
            )
              return "vendor-ui";
            if (id.includes("node_modules/@tanstack/")) return "vendor-query";
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-")
            )
              return "vendor-charts";
            if (
              id.includes("node_modules/date-fns") ||
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/tailwind-merge") ||
              id.includes("node_modules/class-variance-authority") ||
              id.includes("node_modules/sonner") ||
              id.includes("node_modules/cmdk")
            )
              return "vendor-utils";
          },
        },
      },
    },
    server: {
      allowedHosts: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
        "/projects/upload-audio": { target: "http://127.0.0.1:3001", changeOrigin: true },
        "/projects/audio": { target: "http://127.0.0.1:3001", changeOrigin: true },
        "/socket.io": { target: "http://127.0.0.1:3001", changeOrigin: true, ws: true },
      },
    },
});
