import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY;
  const msToken = env.MS_GRAPH_TOKEN || env.VITE_MS_GRAPH_TOKEN;

  return {
    plugins: [react()],
    // Relative base so the built app works when loaded via file:// in Electron.
    base: "./",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5183,
      strictPort: true,
      // Listen on all network interfaces so the app is reachable from other
      // computers/phones on the same Wi-Fi (e.g. http://<ip>:5183).
      host: true,
      proxy: {
        "/api/groq": {
          target: "https://api.groq.com",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/groq/, "/openai/v1"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (groqKey) {
                proxyReq.setHeader("Authorization", `Bearer ${groqKey}`);
              }
            });
          },
        },
        "/api/graph": {
          target: "https://graph.microsoft.com",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/graph/, "/v1.0"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (msToken) {
                proxyReq.setHeader("Authorization", `Bearer ${msToken}`);
              }
            });
            // Allow the browser to pass a per-request token via the accessToken header.
            proxy.on("proxyReq", (proxyReq, req) => {
              const supplied = req.headers["x-ms-access-token"];
              if (typeof supplied === "string" && supplied) {
                proxyReq.setHeader("Authorization", `Bearer ${supplied}`);
              }
            });
          },
        },
      },
    },
  };
});
