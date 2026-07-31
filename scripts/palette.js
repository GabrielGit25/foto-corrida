// Extrai a paleta dominante de uma imagem PNG/JPEG usando Node puro.
// Uso: node scripts/palette.js <caminho-da-imagem> [amostra]
'use strict';

const zlib = require('zlib');
const fs = require('fs');

function chunks(b) {
  const out = [];
  let o = 8;
  while (o + 8 <= b.length) {
    const len = b.readUInt32BE(o);
    out.push({ type: b.toString('ascii', o + 4, o + 8), data: b.slice(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x89 || b[1] !== 0x50) throw new Error('Nao e um PNG');
  const cs = chunks(b);
  const ihdr = cs.find((c) => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (interlace !== 0) throw new Error('PNG interlacado nao suportado');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error('colorType nao suportado: ' + colorType);
  const bpp = channels * (bitDepth / 8);
  const stride = Math.ceil((width * channels * bitDepth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const plte = cs.find((c) => c.type === 'PLTE');
  let pal = null;
  if (plte) {
    pal = [];
    for (let i = 0; i < plte.data.length; i += 3) {
      pal.push([plte.data[i], plte.data[i + 1], plte.data[i + 2]]);
    }
  }
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(row);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const bv = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 0xff;
      else if (f === 2) v = (v + bv) & 0xff;
      else if (f === 3) v = (v + ((a + bv) >> 1)) & 0xff;
      else if (f === 4) v = (v + paeth(a, bv, c)) & 0xff;
      line[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const base = x * channels * (bitDepth / 8);
      const oi = (y * width + x) * 4;
      const get = (ch) => {
        if (bitDepth === 16) return line[base + ch * 2];
        return line[base + ch];
      };
      if (colorType === 0) { const g = get(0); out[oi] = out[oi + 1] = out[oi + 2] = g; out[oi + 3] = 255; }
      else if (colorType === 2) { out[oi] = get(0); out[oi + 1] = get(1); out[oi + 2] = get(2); out[oi + 3] = 255; }
      else if (colorType === 3) {
        const idx = bitDepth === 16 ? line[base] : line[base];
        const p = pal[idx] || [0, 0, 0];
        out[oi] = p[0]; out[oi + 1] = p[1]; out[oi + 2] = p[2]; out[oi + 3] = 255;
      }
      else if (colorType === 4) { const g = get(0); out[oi] = out[oi + 1] = out[oi + 2] = g; out[oi + 3] = get(1); }
      else if (colorType === 6) { out[oi] = get(0); out[oi + 1] = get(1); out[oi + 2] = get(2); out[oi + 3] = get(3); }
    }
    line.copy(prev);
  }
  return { width, height, data: out };
}

function main() {
  const file = process.argv[2];
  const stride = parseInt(process.argv[3] || '4', 10);
  const { width, height, data } = decodePng(file);
  const counts = new Map();
  const totalPx = width * height;
  const target = 40000;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPx / target)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const sampled = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log('Dimensoes: ' + width + 'x' + height + ' (amostra a cada ' + step + 'px)');
  for (const [k, n] of top) {
    const r = ((k >> 8) & 0xf) * 16 + 8;
    const g = ((k >> 4) & 0xf) * 16 + 8;
    const b = (k & 0xf) * 16 + 8;
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    console.log(hex + '  ' + ((n / sampled) * 100).toFixed(1) + '%  (r=' + r + ' g=' + g + ' b=' + b + ')');
  }
}

main();
