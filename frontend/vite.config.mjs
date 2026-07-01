import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
  },
  envDir: "..",
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
