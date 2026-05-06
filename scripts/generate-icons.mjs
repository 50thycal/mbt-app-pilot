import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BG = [244, 241, 234];   // #f4f1ea
const FG = [42, 40, 35];      // #2a2823

function blend(t, a, b) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
}

function pixel(x, y, w, h) {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = w / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r;

  // Center filled dot
  if (dist < 0.20) {
    const edge = Math.max(0, Math.min(1, (0.20 - dist) * (w / 4)));
    const c = blend(edge, BG, FG);
    return [c[0], c[1], c[2], 255];
  }
  // Soft ring
  const ringCenter = 0.36;
  const ringWidth = 0.06;
  const d = Math.abs(dist - ringCenter);
  if (d < ringWidth) {
    const intensity = (1 - d / ringWidth) * 0.55;
    const c = blend(intensity, BG, FG);
    return [c[0], c[1], c[2], 255];
  }
  return [BG[0], BG[1], BG[2], 255];
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcVal]);
}

function makePNG(size) {
  const w = size, h = size;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rows = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4);
    rows[off] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y, w, h);
      const p = off + 1 + x * 4;
      rows[p] = r;
      rows[p + 1] = g;
      rows[p + 2] = b;
      rows[p + 3] = a;
    }
  }
  const idat = deflateSync(rows);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('.', { recursive: true });
writeFileSync('icon-192.png', makePNG(192));
writeFileSync('icon-512.png', makePNG(512));
writeFileSync('apple-touch-icon.png', makePNG(180));
console.log('Generated icon-192.png, icon-512.png, apple-touch-icon.png');
