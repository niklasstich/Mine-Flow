import path from "path";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Mine-Flow/",
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // *.spec.ts is Playwright's convention (see tsconfig.playwright.json) --
    // those run via `playwright test`, not vitest.
    exclude: [...configDefaults.exclude, "**/*.spec.ts"],
  },
});
