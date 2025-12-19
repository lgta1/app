import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve helper for absolute aliases to ensure both client and SSR builds find `~` and `@`.
const r = (p: string) => path.resolve(fileURLToPath(new URL(".", import.meta.url)), p);

export default defineConfig({
  // Ensure path alias plugin runs early; add explicit resolve.alias for SSR robustness.
  plugins: [tsconfigPaths(), tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "~": r("app"),
      "@": r("app/.server"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
