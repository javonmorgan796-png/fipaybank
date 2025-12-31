import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add these for production build optimization
  build: {
    outDir: "dist",
    sourcemap: mode === "development", // Enable sourcemaps only in development
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-alert-dialog",
          ],
          "utils-vendor": ["axios", "date-fns", "lodash", "zod"],
        },
        // Optimize chunk naming
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // Minify for production
    minify: mode === "production" ? "terser" : false,
    terserOptions: {
      compress: {
        drop_console: mode === "production", // Remove console logs in production
      },
    },
    // Target modern browsers
    target: "es2020",
  },
  // Preview configuration for production-like testing
  preview: {
    port: 8080,
    host: true,
  },
  // Environment variables configuration
  define: {
    "process.env": process.env,
  },
  // CSS optimization
  css: {
    devSourcemap: mode === "development",
    modules: {
      localsConvention: "camelCase",
    },
  },
}));