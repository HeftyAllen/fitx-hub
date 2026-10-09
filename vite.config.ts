import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHash } from "node:crypto";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "fitx-offline-manifest",
      apply: "build",
      generateBundle(_, bundle) {
        const assets = [
          "/index.html",
          "/manifest.webmanifest",
          "/favicon.ico",
          ...Object.keys(bundle)
            .filter((name) => name.startsWith("assets/"))
            .map((name) => `/${name}`),
        ];
        const build = createHash("sha256")
          .update(JSON.stringify(assets))
          .digest("hex")
          .slice(0, 12);
        this.emitFile({
          type: "asset",
          fileName: "offline-assets.js",
          source: `self.FITX_BUILD=${JSON.stringify(build)};self.FITX_ASSETS=${JSON.stringify(assets)};`,
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
