// Draws the DeskLab app icon: a light ground, a dark desk, and the pink dot.
// Output is a square PNG that `tauri icon` turns into the bundle sizes.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size, paint) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const cx = x < left + radius ? left + radius : x >= right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y >= bottom - radius ? bottom - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

const image = png(SIZE, (x, y, size) => {
  const ground = [242, 243, 245, 255];
  const ink = [27, 27, 31, 255];
  const dot = [242, 53, 122, 255];
  const margin = size * 0.12;
  if (!insideRoundedRect(x, y, margin, margin, size - margin * 2, size - margin * 2, size * 0.18)) {
    return ground;
  }
  const deskTop = size * 0.58;
  const deskLeft = size * 0.22;
  const deskWidth = size * 0.56;
  const deskHeight = size * 0.08;
  if (insideRoundedRect(x, y, deskLeft, deskTop, deskWidth, deskHeight, size * 0.02)) return ink;
  const legWidth = size * 0.035;
  const legTop = deskTop + deskHeight - 2;
  const legHeight = size * 0.16;
  if (insideRoundedRect(x, y, deskLeft + size * 0.04, legTop, legWidth, legHeight, 4)) return ink;
  if (insideRoundedRect(x, y, deskLeft + deskWidth - size * 0.04 - legWidth, legTop, legWidth, legHeight, 4)) return ink;
  const dx = x - size * 0.72;
  const dy = y - size * 0.36;
  const radius = size * 0.055;
  if (dx * dx + dy * dy <= radius * radius) return dot;
  return ground;
});

const out = join(dirname(fileURLToPath(import.meta.url)), 'icon-source.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, image);
console.log(out);
