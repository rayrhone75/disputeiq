// Build script for the DisputeIQ Chrome extension.
//
// Outputs to extension/dist/:
//   manifest.json (copied)
//   background.js, contentScript.js, popup.js (esbuild-bundled)
//   popup.html (copied)
//   icons/ (copied as-is)
//
// Usage:
//   node extension/build.mjs              # production build (minified)
//   node extension/build.mjs --watch      # rebuild on change
//   node extension/build.mjs --dev        # source maps, no minify
//
// Or via package.json:
//   npm run extension:build
//   npm run extension:dev
//
// The DisputeIQ origin baked into the extension is read from
// $DISPUTEIQ_ORIGIN at build time (defaults to https://disputeiq.org).
// Set DISPUTEIQ_ORIGIN=http://localhost:3000 for local dev.

import { build, context } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const watch = process.argv.includes("--watch");
const dev = process.argv.includes("--dev") || watch;

const DISPUTEIQ_ORIGIN =
  process.env.DISPUTEIQ_ORIGIN ?? "https://disputeiq.org";

function copyTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const s = join(srcDir, entry);
    const d = join(destDir, entry);
    const st = statSync(s);
    if (st.isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

function clean() {
  try {
    rmSync(DIST, { recursive: true, force: true });
  } catch {}
  mkdirSync(DIST, { recursive: true });
}

function copyStatic() {
  copyFileSync(join(ROOT, "manifest.json"), join(DIST, "manifest.json"));
  copyFileSync(join(SRC, "popup.html"), join(DIST, "popup.html"));
  copyTree(join(ROOT, "icons"), join(DIST, "icons"));
}

const entryPoints = {
  background: join(SRC, "background.ts"),
  contentScript: join(SRC, "contentScript.ts"),
  popup: join(SRC, "popup.ts"),
};

const sharedOptions = {
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  platform: "browser",
  sourcemap: dev ? "inline" : false,
  minify: !dev,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
    DISPUTEIQ_ORIGIN: JSON.stringify(DISPUTEIQ_ORIGIN),
  },
  logLevel: "info",
};

async function buildOnce() {
  clean();
  copyStatic();
  for (const [name, file] of Object.entries(entryPoints)) {
    await build({
      ...sharedOptions,
      entryPoints: [file],
      outfile: join(DIST, `${name}.js`),
    });
  }
  console.log(
    `\n✅ extension built → ${DIST}\n   DISPUTEIQ_ORIGIN=${DISPUTEIQ_ORIGIN}\n`,
  );
}

async function watchAll() {
  clean();
  copyStatic();
  const ctxs = await Promise.all(
    Object.entries(entryPoints).map(([name, file]) =>
      context({
        ...sharedOptions,
        entryPoints: [file],
        outfile: join(DIST, `${name}.js`),
      }),
    ),
  );
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log(
    `\n👀 watching extension/src — output at ${DIST}\n   DISPUTEIQ_ORIGIN=${DISPUTEIQ_ORIGIN}\n`,
  );
}

if (watch) {
  await watchAll();
} else {
  await buildOnce();
}
