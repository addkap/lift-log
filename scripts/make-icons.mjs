// Draws the app icon (a white dumbbell on Bills blue with a red stripe) as PNG files.
// No image libraries needed: it writes the pixels itself. Run with: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BLUE = [0, 51, 141], RED = [198, 12, 48], WHITE = [255, 255, 255], NAVY = [12, 35, 64];

// CRC32 (PNG chunks need it)
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

function icon(size) {
  const px = Buffer.alloc(size * size * 3);
  const fill = (x0, y0, x1, y1, color) => { // rectangle in 0..1 coordinates
    for (let y = Math.round(y0 * size); y < Math.round(y1 * size); y++)
      for (let x = Math.round(x0 * size); x < Math.round(x1 * size); x++) px.set(color, (y * size + x) * 3);
  };
  fill(0, 0, 1, 1, BLUE);
  fill(0, 0.80, 1, 0.86, WHITE);            // racing stripes along the bottom
  fill(0, 0.86, 1, 0.92, RED);
  // Everything important stays inside the middle 70% so round/masked icons never crop it.
  fill(0.28, 0.465, 0.72, 0.535, WHITE);     // bar
  fill(0.22, 0.30, 0.30, 0.70, WHITE);       // inner plates
  fill(0.70, 0.30, 0.78, 0.70, WHITE);
  fill(0.30, 0.34, 0.34, 0.66, RED);         // collars
  fill(0.66, 0.34, 0.70, 0.66, RED);
  fill(0.15, 0.38, 0.22, 0.62, WHITE);       // outer plates
  fill(0.78, 0.38, 0.85, 0.62, WHITE);
  fill(0.22, 0.30, 0.23, 0.70, NAVY);        // thin outlines so plates read clearly
  fill(0.77, 0.30, 0.78, 0.70, NAVY);

  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3); }
  const head = Buffer.alloc(13); head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, icon(size));
  console.log('wrote public/icons/' + name);
}
