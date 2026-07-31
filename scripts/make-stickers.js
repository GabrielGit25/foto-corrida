// Gera figurinhas PNG de exemplo usando apenas Node (zlib + crc32).
// Coloque suas próprias figurinhas em /stickers e adicione o nome delas
// na lista STICKERS dentro de app.js.
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const OUT_DIR = path.join(__dirname, '..', 'stickers');

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function makeCanvas() {
  return Buffer.alloc(SIZE * SIZE * 4);
}

function setPx(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const srcA = a / 255;
  const dstA = buf[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  buf[i] = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA);
  buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA);
  buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

function fillCircle(buf, cx, cy, r, color) {
  const [cr, cg, cb, ca] = color;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(SIZE - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(SIZE - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) setPx(buf, x, y, cr, cg, cb, ca);
    }
  }
}

function fillPoly(buf, pts, color) {
  const [cr, cg, cb, ca] = color;
  const ys = pts.map((p) => p.y);
  const yMin = Math.max(0, Math.floor(Math.min.apply(null, ys)));
  const yMax = Math.min(SIZE - 1, Math.ceil(Math.max.apply(null, ys)));
  for (let y = yMin; y <= yMax; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        xs.push(p1.x + ((y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const x0 = Math.max(0, Math.floor(xs[j]));
      const x1 = Math.min(SIZE - 1, Math.ceil(xs[j + 1]));
      for (let x = x0; x <= x1; x++) setPx(buf, x, y, cr, cg, cb, ca);
    }
  }
}

// Contorno escuro: desenha a forma um pouco maior atrás para dar contraste.
function withOutline(draw) {
  const dark = [0, 0, 0, 130];
  const buf = makeCanvas();
  const S = 1.13;
  function scaleC(cx, cy, r) {
    return { cx: SIZE / 2 + (cx - SIZE / 2) * S, cy: SIZE / 2 + (cy - SIZE / 2) * S, r: r * S };
  }
  const sc = scaleC(SIZE / 2, SIZE / 2, SIZE / 2);
  // desenha a silhueta escura usando a mesma função com centro de escala
  draw(buf, dark, sc.cx, sc.cy, S);
  draw(buf, null, SIZE / 2, SIZE / 2, 1);
  return buf;
}

function heart(buf, color, ox, oy, s) {
  const cx = ox, cy = oy, r = SIZE * 0.42 * s;
  fillCircle(buf, cx - r * 0.45, cy - r * 0.38, r * 0.5, color);
  fillCircle(buf, cx + r * 0.45, cy - r * 0.38, r * 0.5, color);
  fillPoly(buf, [
    { x: cx - r * 0.82, y: cy - r * 0.18 },
    { x: cx + r * 0.82, y: cy - r * 0.18 },
    { x: cx, y: cy + r * 0.62 },
  ], color);
}

function star(buf, color, ox, oy, s) {
  const cx = ox, cy = oy, R = SIZE * 0.46 * s, r = R * 0.44;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  fillPoly(buf, pts, color);
}

function smiley(buf, color, ox, oy, s) {
  const cx = ox, cy = oy, r = SIZE * 0.44 * s;
  fillCircle(buf, cx, cy, r, color);
  const black = [20, 20, 20, 255];
  fillCircle(buf, cx - r * 0.34, cy - r * 0.22, r * 0.1, black);
  fillCircle(buf, cx + r * 0.34, cy - r * 0.22, r * 0.1, black);
  const mcx = cx, mcy = cy + r * 0.26, mr = r * 0.52;
  for (let y = Math.floor(mcy - mr); y <= Math.ceil(mcy + mr); y++) {
    for (let x = Math.floor(mcx - mr); x <= Math.ceil(mcx + mr); x++) {
      const d = Math.hypot(x - mcx, y - mcy);
      if (d >= mr * 0.55 && d <= mr) {
        const ang = Math.atan2(y - mcy, x - mcx);
        if (ang > 0.15 && ang < Math.PI - 0.15) setPx(buf, x, y, 20, 20, 20, 255);
      }
    }
  }
}

function bolt(buf, color, ox, oy, s) {
  const cx = ox, cy = oy;
  const w = SIZE * 0.72 * s, h = SIZE * 0.84 * s;
  const pts = [
    { x: cx + w * 0.22, y: cy - h * 0.44 },
    { x: cx - w * 0.3, y: cy + h * 0.05 },
    { x: cx - w * 0.02, y: cy + h * 0.05 },
    { x: cx - w * 0.22, y: cy + h * 0.44 },
    { x: cx + w * 0.3, y: cy - h * 0.06 },
    { x: cx + w * 0.02, y: cy - h * 0.06 },
  ];
  fillPoly(buf, pts, color);
}

function fire(buf, color, ox, oy, s) {
  const cx = ox, cy = oy, r = SIZE * 0.42 * s;
  fillCircle(buf, cx, cy + r * 0.2, r * 0.72, color);
  fillCircle(buf, cx - r * 0.18, cy - r * 0.15, r * 0.5, color);
  fillCircle(buf, cx + r * 0.22, cy - r * 0.12, r * 0.46, color);
  fillPoly(buf, [
    { x: cx - r * 0.5, y: cy - r * 0.1 },
    { x: cx + r * 0.5, y: cy - r * 0.1 },
    { x: cx, y: cy - r * 0.85 },
  ], color);
}

function crown(buf, color, ox, oy, s) {
  const cx = ox, cy = oy;
  const w = SIZE * 0.62 * s, h = SIZE * 0.5 * s;
  const baseY = cy + h * 0.38;
  fillPoly(buf, [
    { x: cx - w * 0.5, y: baseY },
    { x: cx + w * 0.5, y: baseY },
    { x: cx + w * 0.5, y: baseY + h * 0.16 },
    { x: cx - w * 0.5, y: baseY + h * 0.16 },
  ], color);
  fillPoly(buf, [
    { x: cx - w * 0.5, y: baseY },
    { x: cx - w * 0.42, y: baseY - h * 0.42 },
    { x: cx - w * 0.16, y: baseY - h * 0.02 },
    { x: cx, y: baseY - h * 0.52 },
    { x: cx + w * 0.16, y: baseY - h * 0.02 },
    { x: cx + w * 0.42, y: baseY - h * 0.42 },
    { x: cx + w * 0.5, y: baseY },
  ], color);
  const red = [225, 6, 0, 255];
  for (let t = -1; t <= 1; t += 2) {
    fillCircle(buf, cx + t * w * 0.42, baseY - h * 0.4, h * 0.09, red);
  }
  fillCircle(buf, cx, baseY - h * 0.5, h * 0.09, red);
  fillCircle(buf, cx - w * 0.3, baseY + h * 0.14, h * 0.12, red);
  fillCircle(buf, cx, baseY + h * 0.14, h * 0.12, red);
  fillCircle(buf, cx + w * 0.3, baseY + h * 0.14, h * 0.12, red);
}

function trophy(buf, color, ox, oy, s) {
  const cx = ox, cy = oy;
  const w = SIZE * 0.6 * s;
  const gold = color;
  fillCircle(buf, cx, cy - w * 0.02, w * 0.34, gold);
  const [r1, g1, b1, a1] = gold;
  for (let t = -1; t <= 1; t += 2) {
    const hx = cx + t * w * 0.32;
    for (let y = Math.floor(cy - w * 0.3); y <= Math.ceil(cy + w * 0.08); y++) {
      for (let x = Math.floor(hx - w * 0.12); x <= Math.ceil(hx + w * 0.12); x++) {
        const d = Math.hypot(x - hx, y - (cy - w * 0.08));
        if (d >= w * 0.1 && d <= w * 0.17) setPx(buf, x, y, r1, g1, b1, a1);
      }
    }
  }
  fillPoly(buf, [
    { x: cx - w * 0.07, y: cy + w * 0.28 },
    { x: cx + w * 0.07, y: cy + w * 0.28 },
    { x: cx + w * 0.09, y: cy + w * 0.5 },
    { x: cx - w * 0.09, y: cy + w * 0.5 },
  ], color);
  fillPoly(buf, [
    { x: cx - w * 0.2, y: cy + w * 0.5 },
    { x: cx + w * 0.2, y: cy + w * 0.5 },
    { x: cx + w * 0.24, y: cy + w * 0.62 },
    { x: cx - w * 0.24, y: cy + w * 0.62 },
  ], color);
}

function flag(buf, color, ox, oy, s) {
  const cx = ox, cy = oy;
  const w = SIZE * 0.76 * s, h = SIZE * 0.52 * s;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const red = [225, 6, 0, 255];
  fillCircle(buf, cx, cy, Math.max(w, h) * 0.56, red);
  const [r1, g1, b1, a1] = color;
  for (let y = Math.floor(y0); y < y0 + h; y++) {
    for (let x = Math.floor(x0); x < x0 + w; x++) {
      const dx = x - x0, dy = y - y0;
      const col = Math.floor(dx / (w / 6));
      const row = Math.floor(dy / (h / 4));
      const d = Math.hypot(x - cx, y - cy);
      if (d <= Math.max(w, h) * 0.5) {
        if ((row + col) % 2 === 0) setPx(buf, x, y, 255, 255, 255, 255);
        else setPx(buf, x, y, r1, g1, b1, a1);
      }
    }
  }
}

const SHAPES = {
  heart: heart,
  star: star,
  smiley: smiley,
  bolt: bolt,
  fire: fire,
  crown: crown,
  trophy: trophy,
  flag: flag,
};

const COLORS = {
  heart: [233, 30, 60, 255],
  star: [255, 205, 0, 255],
  smiley: [255, 214, 0, 255],
  bolt: [255, 213, 0, 255],
  fire: [255, 94, 32, 255],
  crown: [255, 205, 0, 255],
  trophy: [255, 205, 0, 255],
  flag: [20, 20, 20, 255],
};

function build(name) {
  const shape = SHAPES[name];
  const color = COLORS[name];
  const buf = makeCanvas();
  // contorno escuro
  shape(buf, [0, 0, 0, 150], SIZE / 2, SIZE / 2, 1.16);
  // forma principal
  shape(buf, color, SIZE / 2, SIZE / 2, 1);
  return buf;
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const name of Object.keys(SHAPES)) {
  const buf = build(name);
  const file = path.join(OUT_DIR, name + '.png');
  fs.writeFileSync(file, encodePNG(SIZE, buf));
  console.log('Gerado:', path.relative(process.cwd(), file));
}
