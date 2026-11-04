import { inflateSync } from 'node:zlib';

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}

// 8-bit RGB or RGBA, no interlacing. Enough for a Playwright canvas screenshot.
export function decodePng(buffer) {
  const png = Buffer.from(buffer);
  if (png.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a png');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const chunks = [];
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      chunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png ${width}x${height} depth ${bitDepth} type ${colorType} interlace ${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  const prior = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    for (let i = 0; i < stride; i += 1) current[i] = raw[cursor + i];
    cursor += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? current[i - channels] : 0;
      const up = prior[i];
      const upLeft = i >= channels ? prior[i - channels] : 0;
      if (filter === 1) current[i] = (current[i] + left) & 255;
      else if (filter === 2) current[i] = (current[i] + up) & 255;
      else if (filter === 3) current[i] = (current[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) current[i] = (current[i] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`bad png filter ${filter}`);
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const dest = (y * width + x) * 4;
      out[dest] = current[source];
      out[dest + 1] = current[source + 1];
      out[dest + 2] = current[source + 2];
      out[dest + 3] = channels === 4 ? current[source + 3] : 255;
    }
    prior.set(current);
  }
  return { width, height, data: out };
}

// A blank canvas is one flat colour and compresses to a few KB. The solid
// room is only a few colours too, so size alone cannot tell them apart. A
// drawn frame also has pixels that are not the corner colour. Devices and
// cables still land well above the old byte threshold.
const DRAWN_MIN_BYTES = 20000;

export function canvasShowsAPicture(buffer) {
  if (buffer.length > DRAWN_MIN_BYTES) return true;
  const { width, height, data } = decodePng(buffer);
  if (width < 2 || height < 2) return false;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 48));
  let different = 0;
  let samples = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const delta = Math.abs(data[index] - data[0])
        + Math.abs(data[index + 1] - data[1])
        + Math.abs(data[index + 2] - data[2]);
      if (delta > 30) different += 1;
      samples += 1;
    }
  }
  return different > samples * 0.02;
}
