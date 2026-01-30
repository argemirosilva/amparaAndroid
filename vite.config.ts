import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Disable aggressive caching in development to ensure code changes are reflected
  optimizeDeps: {
    force: mode === "development",
  },
  build: {
    // Ensure full rebuild when needed
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
}));
