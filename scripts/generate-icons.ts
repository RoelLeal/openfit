/**
 * Renders the app icons and splash images as PNG without dependencies
 * (a tiny rasterizer + PNG encoder). The design matches public/favicon.svg:
 * a progress ring on the accent color.
 *
 *   npm run icons           PWA icons (public/icons) and native sources (assets/)
 *   npm run mobile:assets   turns assets/ into Android and iOS resources (@capacitor/assets)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

type Rgb = readonly [number, number, number];

const ACCENT: Rgb = [0x1d, 0x7a, 0x4a];
const WHITE: Rgb = [255, 255, 255];
const LIGHT_BG: Rgb = [0xf6, 0xf6, 0xf4];
const DARK_BG: Rgb = [0x0f, 0x0f, 0x0e];
const SAMPLES = 4; // supersampling per axis

/** Geometry in the 64-unit space of favicon.svg. */
const RING_RADIUS = 18;
const RING_WIDTH = 7;
const ARC_START = -90; // degrees, top
const ARC_SWEEP = 300; // clockwise
const DOT_RADIUS = 5;
const CORNER = 14;

export interface ImageSpec {
  file: string;
  dir: 'public/icons' | 'assets';
  size: number;
  /** Color around the logo; null for transparent. */
  canvas: Rgb | null;
  /** Side of the logo box in pixels (defaults to the whole image). */
  logoSize?: number;
  /** Accent plate behind the glyph. */
  plate: 'rounded' | 'square' | 'none';
  /** Glyph scale inside the logo box (0 draws no glyph). */
  glyphScale: number;
}

export const IMAGES: ImageSpec[] = [
  // PWA
  {
    file: 'icon-192.png',
    dir: 'public/icons',
    size: 192,
    canvas: null,
    plate: 'rounded',
    glyphScale: 1,
  },
  {
    file: 'icon-512.png',
    dir: 'public/icons',
    size: 512,
    canvas: null,
    plate: 'rounded',
    glyphScale: 1,
  },
  {
    file: 'maskable-512.png',
    dir: 'public/icons',
    size: 512,
    canvas: null,
    plate: 'square',
    glyphScale: 0.72,
  },
  {
    file: 'apple-touch-icon.png',
    dir: 'public/icons',
    size: 180,
    canvas: null,
    plate: 'square',
    glyphScale: 0.85,
  },
  // Native sources for @capacitor/assets (custom mode)
  {
    file: 'icon-only.png',
    dir: 'assets',
    size: 1024,
    canvas: null,
    plate: 'square',
    glyphScale: 0.8,
  },
  {
    file: 'icon-foreground.png',
    dir: 'assets',
    size: 1024,
    canvas: null,
    plate: 'none',
    glyphScale: 0.62,
  },
  {
    file: 'icon-background.png',
    dir: 'assets',
    size: 1024,
    canvas: ACCENT,
    plate: 'none',
    glyphScale: 0,
  },
  {
    file: 'splash.png',
    dir: 'assets',
    size: 2732,
    canvas: LIGHT_BG,
    logoSize: 512,
    plate: 'rounded',
    glyphScale: 1,
  },
  {
    file: 'splash-dark.png',
    dir: 'assets',
    size: 2732,
    canvas: DARK_BG,
    logoSize: 512,
    plate: 'rounded',
    glyphScale: 1,
  },
];

function insideRoundedRect(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > 64 || y > 64) return false;
  const cx = Math.min(Math.max(x, CORNER), 64 - CORNER);
  const cy = Math.min(Math.max(y, CORNER), 64 - CORNER);
  return (x - cx) ** 2 + (y - cy) ** 2 <= CORNER ** 2;
}

function insideGlyph(x: number, y: number): boolean {
  const dx = x - 32;
  const dy = y - 32;
  const distance = Math.hypot(dx, dy);
  if (distance <= DOT_RADIUS) return true;
  const half = RING_WIDTH / 2;
  if (Math.abs(distance - RING_RADIUS) <= half) {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if ((angle - ARC_START + 360) % 360 <= ARC_SWEEP) return true;
  }
  // Round caps at both ends of the arc.
  for (const degrees of [ARC_START, ARC_START + ARC_SWEEP]) {
    const radians = (degrees * Math.PI) / 180;
    const capX = 32 + RING_RADIUS * Math.cos(radians);
    const capY = 32 + RING_RADIUS * Math.sin(radians);
    if (Math.hypot(x - capX, y - capY) <= half) return true;
  }
  return false;
}

/** Color of one sample in logo space (0..64), or null when transparent. */
function sampleLogo(spec: ImageSpec, x: number, y: number): Rgb | null {
  const onPlate =
    spec.plate === 'square'
      ? x >= 0 && y >= 0 && x <= 64 && y <= 64
      : spec.plate === 'rounded' && insideRoundedRect(x, y);
  if (spec.glyphScale > 0) {
    const gx = 32 + (x - 32) / spec.glyphScale;
    const gy = 32 + (y - 32) / spec.glyphScale;
    if ((onPlate || spec.plate === 'none') && insideGlyph(gx, gy)) return WHITE;
  }
  return onPlate ? ACCENT : spec.canvas;
}

export function renderImage(spec: ImageSpec): Buffer {
  const { size, canvas } = spec;
  const logoSize = spec.logoSize ?? size;
  const logoStart = (size - logoSize) / 2;
  const scale = 64 / logoSize;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const offset = (py * size + px) * 4;
      const outside =
        px < logoStart - 1 ||
        py < logoStart - 1 ||
        px > logoStart + logoSize ||
        py > logoStart + logoSize;
      if (outside) {
        if (canvas) pixels.set([...canvas, 255], offset);
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES - logoStart) * scale;
          const y = (py + (sy + 0.5) / SAMPLES - logoStart) * scale;
          const color = sampleLogo(spec, x, y);
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          alpha++;
        }
      }
      if (alpha === 0) continue;
      pixels.set(
        [
          Math.round(r / alpha),
          Math.round(g / alpha),
          Math.round(b / alpha),
          Math.round((alpha / (SAMPLES * SAMPLES)) * 255),
        ],
        offset,
      );
    }
  }
  return encodePng(size, size, pixels);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA, 8 bits per channel, no filtering. */
export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const image of IMAGES) {
    const dir = fileURLToPath(new URL(`../${image.dir}/`, import.meta.url));
    mkdirSync(dir, { recursive: true });
    const png = renderImage(image);
    writeFileSync(`${dir}${image.file}`, png);
    console.log(
      `✓ ${image.dir}/${image.file} (${image.size}px, ${(png.length / 1024).toFixed(1)} KB)`,
    );
  }
}
