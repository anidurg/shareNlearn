// scripts/generate-icons.mjs
// Draws the app icons used by the manifest and by iOS's "Add to Home Screen".
// Kept as a script rather than committed-by-hand binaries so the mark can be
// changed in one place and regenerated with `node scripts/generate-icons.mjs`.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// The palette from src/styles.css, so the icon and the app agree. The names are
// the roles the colours play — the blue scheme replaced the warm one it started
// with, and the mark follows it rather than keeping its own copy.
const PRIMARY = [0x25, 0x63, 0xeb];
const PRIMARY_DEEP = [0x1d, 0x4e, 0xd8];
const IVORY = [0xff, 0xff, 0xff];
const GOLD = [0x7d, 0xd3, 0xfc];

const mix = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);

/**
 * The mark: a record ring with two sound arcs beside it — a song being passed
 * around. Everything sits inside the middle 80% so a circular or squircle mask
 * never clips it.
 */
function markColour(x, y) {
  const dx = x - 0.465;
  const dy = y - 0.48;
  const r = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  if (r < 0.062) return IVORY;
  if (Math.abs(r - 0.235) < 0.026) return IVORY;

  const inArcWindow = Math.abs(angle) < 0.62;
  if (inArcWindow && Math.abs(r - 0.315) < 0.017) return GOLD;
  if (inArcWindow && Math.abs(angle) < 0.42 && Math.abs(r - 0.375) < 0.015) return GOLD;

  return null;
}

function backgroundColour(x, y) {
  const base = mix(PRIMARY, PRIMARY_DEEP, Math.min(1, (x * 0.55 + y * 0.75)));
  // A lighter highlight in the top-left corner, matching the page's own glow.
  const glow = Math.exp(-((Math.hypot(x - 0.12, y - 0.05) / 0.62) ** 2)) * 0.32;
  return mix(base, GOLD, glow);
}

/** Renders at 4x and box-filters down, which is enough antialiasing for a small icon. */
function renderPixels(size, { inset = 0 } = {}) {
  const scale = 4;
  const big = size * scale;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const u = (px * scale + sx + 0.5) / big;
          const v = (py * scale + sy + 0.5) / big;
          // `inset` shrinks the artwork so a maskable icon keeps its safe margin.
          const t = inset === 0 ? 1 : 1 / (1 - inset * 2);
          const x = (u - inset) * t;
          const y = (v - inset) * t;
          const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
          const colour = inside ? (markColour(x, y) ?? backgroundColour(x, y)) : backgroundColour(u, v);
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }
      const samples = scale * scale;
      const offset = (py * size + px) * 4;
      pixels[offset] = Math.round(r / samples);
      pixels[offset + 1] = Math.round(g / samples);
      pixels[offset + 2] = Math.round(b / samples);
      pixels[offset + 3] = Math.round(a / samples);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0])); // filter: none
    rows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, inset: 0.11 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size, inset = 0 } of targets) {
  writeFileSync(join(OUT_DIR, file), encodePng(size, renderPixels(size, { inset })));
  console.log(`wrote public/icons/${file} (${size}×${size})`);
}
