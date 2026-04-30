// Icon generator for the DisputeIQ Connector Chrome extension.
//
// Renders one canonical SVG (a violet→indigo gradient rounded square
// with a stylized "D + shield" mark) at 16, 48, and 128 px and writes
// PNGs to extension/icons/. Re-run any time the brand mark changes:
//
//   node extension/scripts/build-icons.mjs
//
// Uses `sharp` (already in package.json). The SVG is intentionally
// minimal so it stays legible at 16×16, where Chrome shows it in the
// extension toolbar.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "icons");

const SIZES = [16, 48, 128];

// Canonical SVG. 256-unit viewBox so the design scales cleanly to
// every target resolution. Anything below ~28 units (≈ 11 % of edge)
// will antialias to a grey blur at 16×16, so we keep strokes thick
// and shapes simple.
//
// Visual: rounded-square plate with the violet→indigo gradient that's
// used throughout the DisputeIQ UI, a diagonal sheen, and a white
// shield with a checkmark inside.
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="55%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>

  <!-- Plate -->
  <rect x="0" y="0" width="256" height="256" rx="56" ry="56" fill="url(#bg)"/>
  <!-- Diagonal highlight -->
  <rect x="0" y="0" width="256" height="160" rx="56" ry="56" fill="url(#sheen)"/>

  <!-- Shield with check -->
  <g transform="translate(128 132) scale(1.15)">
    <path
      d="M0 -78 L62 -52 L62 8 C62 50 32 86 0 96 C-32 86 -62 50 -62 8 L-62 -52 Z"
      fill="white"
      opacity="0.95"
    />
    <path
      d="M-26 4 L-6 24 L30 -22"
      fill="none"
      stroke="#4f46e5"
      stroke-width="14"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</svg>
`;

async function main() {
  const svgBuf = Buffer.from(SVG);
  for (const size of SIZES) {
    const out = join(ICONS_DIR, `icon-${size}.png`);
    await sharp(svgBuf, { density: Math.max(72, size * 4) })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✓ ${out}`);
  }
  // Also write the source SVG so it's checked in alongside the PNGs.
  await writeFile(join(ICONS_DIR, "icon-source.svg"), SVG, "utf8");
  console.log(`✓ ${join(ICONS_DIR, "icon-source.svg")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
