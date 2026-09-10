import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { offlineWorkerSource } from "./src/offline-worker";
import { deploymentAssetPath, deploymentBasePath } from "./src/deployment-path";

let deploymentBase = "/";

export default defineConfig({
  server: { proxy: { "/api/lan": "http://127.0.0.1:4175", "/lan": { target: "ws://127.0.0.1:4175", ws: true } } },
  build: { target: "es2022", chunkSizeWarningLimit: 2200 },
  plugins: [
    {
      name: "offline-cache",
      configResolved(config) { deploymentBase = deploymentBasePath(config.base); },
      writeBundle: {
        order: "post",
        handler(options, bundle) {
          // Vite finalizes HTML and CSS in later generateBundle hooks. Hash the
          // actual emitted bytes, after all bundle output and public-file copies.
          if (!options.dir) throw new Error("Offline packs require a build output directory.");
          const directory = resolve(options.dir);
          const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
          const files = new Set([...Object.keys(bundle), "index.html", "mark.svg"]);
          files.delete("sw.js");
          const assets: Record<string, string> = {};
          for (const file of [...files].sort()) assets[deploymentAssetPath(deploymentBase, file)] = hash(readFileSync(resolve(directory, file)));
          assets[deploymentBase] = assets[deploymentAssetPath(deploymentBase, "index.html")];
          // A worker-only change also receives a distinct staging cache; failed
          // installation can never delete the cache owned by the active worker.
          const version = hash(JSON.stringify(assets) + offlineWorkerSource.toString());
          writeFileSync(resolve(directory, "sw.js"), offlineWorkerSource(assets, version, deploymentBase));
        },
      },
    },
  ],
});
