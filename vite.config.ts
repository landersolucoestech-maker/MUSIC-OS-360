import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  define: {
    "import.meta.env.VITE_MOCK_MODE": JSON.stringify(
      process.env.VITE_MOCK_MODE ??
        (process.env.NODE_ENV === "production" ? "false" : "true")
    ),
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
  },
});
