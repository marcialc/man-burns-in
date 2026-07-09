import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client is a plain SPA; Vite builds static assets into ./dist,
// which the Cloudflare Worker serves via its ASSETS binding.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
