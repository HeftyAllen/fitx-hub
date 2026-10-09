import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHash } from "node:crypto";

export default defineConfig(({ mode }) => {
  const base = mode === "pages" ? "/fitx-hub/" : "/";
  return {
  base,
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
          `${base}index.html`,
          `${base}manifest.webmanifest`,
          `${base}favicon.ico`,
          `${base}placeholder.svg`,
          ...Object.keys(bundle)
            .filter((name) => name.startsWith("assets/"))
            .map((name) => `${base}${name}`),
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
        if (mode === "pages") {
          this.emitFile({
            type: "asset",
            fileName: "404.html",
            source: `<!doctype html><meta charset="utf-8"><title>Opening FitX Journey</title><script>var base=${JSON.stringify(base)};var route=location.pathname.startsWith(base)?location.pathname.slice(base.length):"";location.replace(base+"#/"+route+location.search+location.hash);</script><a href="${base}">Open FitX Journey</a>`,
          });
          this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" });
        }
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
  };
});
