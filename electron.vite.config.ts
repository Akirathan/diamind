import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** `migrate()` reads the migration files at runtime, next to `out/main/index.js`. */
function copyMigrations(): Plugin {
  return {
    name: "diamind:copy-migrations",
    writeBundle(options) {
      cpSync(
        resolve(__dirname, "src/main/db/migrations"),
        resolve(options.dir ?? "out/main", "migrations"),
        { recursive: true },
      );
    },
  };
}

export default defineConfig({
  main: {
    plugins: [copyMigrations()],
  },
  preload: {},
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
