import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": "/src",
      "@world": "/src/robotWorld",
      "@components": "/src/robotWorld/components",
      "@composables": "/src/robotWorld/composables",
      "@core": "/src/robotWorld/core",
      "@interfaces": "/src/robotWorld/interfaces",
      "@store": "/src/robotWorld/store",
      "@utils": "/src/robotWorld/utils"
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, "/api"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
          });
        }
      }
    }
  }
});
