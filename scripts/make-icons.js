const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * 4 + 1) + 1 + x * 4;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  const s = size / 200;

  function put(x, y, color) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
    const p = (iy * size + ix) * 4;
    if (color.length === 4) {
      const a = color[3] / 255;
      px[p] = Math.round(color[0] * a + px[p] * (1 - a));
      px[p + 1] = Math.round(color[1] * a + px[p + 1] * (1 - a));
      px[p + 2] = Math.round(color[2] * a + px[p + 2] * (1 - a));
      px[p + 3] = Math.round(color[3] + px[p + 3] * (1 - a));
    } else {
      px[p] = color[0];
      px[p + 1] = color[1];
      px[p + 2] = color[2];
      px[p + 3] = 255;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      const c = t < 0.4 ? [248, 216, 40] : t < 0.8 ? [248, 184, 8] : [216, 120, 8];
      put(x, y, c);
    }
  }

  const navy = [6, 31, 77];
  const gold = [248, 216, 40];

  function fillRect(x0, y0, w, h, color) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) put(x, y, color);
    }
  }

  function strokeRect(x0, y0, w, h, r, t, color) {
    for (let y = y0 - t; y <= y0 + h + t; y++) {
      for (let x = x0 - t; x <= x0 + w + t; x++) {
        const inRect =
          x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h;
        const nearEdge =
          Math.abs(x - x0) <= t || Math.abs(x - (x0 + w)) <= t ||
          Math.abs(y - y0) <= t || Math.abs(y - (y0 + h)) <= t;
        if (!inRect && nearEdge) {
          const cx = x < x0 ? x0 : x > x0 + w ? x0 + w : x;
          const cy = y < y0 ? y0 : y > y0 + h ? y0 + h : y;
          if (Math.hypot(x - cx, y - cy) <= t) put(x, y, color);
        }
      }
    }
  }

  function fillCircle(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.hypot(x - cx, y - cy) <= r) put(x, y, color);
      }
    }
  }

  function strokeCircle(cx, cy, r, t, color) {
    for (let y = cy - r - t; y <= cy + r + t; y++) {
      for (let x = cx - r - t; x <= cx + r + t; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (Math.abs(d - r) <= t) put(x, y, color);
      }
    }
  }

  fillRect(18 * s, 68 * s, 164 * s, 112 * s, navy);
  fillRect(48 * s, 46 * s, 104 * s, 30 * s, navy);
  fillRect(66 * s, 40 * s, 68 * s, 14 * s, gold);
  strokeCircle(100 * s, 124 * s, 34 * s, 6 * s, gold);
  fillCircle(100 * s, 124 * s, 10 * s, gold);
  fillCircle(146 * s, 94 * s, 6 * s, gold);

  return encodePNG(size, size, Buffer.from(px));
}

fs.writeFileSync(path.join(__dirname, '..', 'icons', 'icon-512.png'), makeIcon(512));
fs.writeFileSync(path.join(__dirname, '..', 'icons', 'icon-192.png'), makeIcon(192));
console.log('icons generated');
