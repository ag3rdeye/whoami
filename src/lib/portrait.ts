import sharp from 'sharp';

const TONES = ' .,:;-=+*xoX#%@';
const ROWS = 130;
const BODY = 0.54; // how far down the photo to go: head to torso
const SOURCE = 'src/assets/hero.jpg';
const MASK = 'src/assets/hero-mask.png'; // person cut-out, see scripts/portrait-mask.swift

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Crops to the person, then samples colour, local-contrast tone, and the mask per character.
const cells = async () => {
  const { width = 0, height = 0 } = await sharp(SOURCE).metadata();
  const full = await sharp(MASK).resize(width, height, { fit: 'fill' }).greyscale().raw().toBuffer();

  const limit = Math.round(height * BODY);
  let left = width;
  let right = 0;
  let top = limit;
  for (let y = 0; y < limit; y++) {
    for (let x = 0; x < width; x++) {
      if (full[y * width + x] < 128) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
    }
  }
  const pad = Math.round(width * 0.012);
  const region = {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    width: Math.min(width, right + pad) - Math.max(0, left - pad),
    height: limit - Math.max(0, top - pad),
  };
  const cols = Math.round((ROWS * (region.width / region.height)) / 0.6);
  const size = { width: cols, height: ROWS, fit: 'fill' as const, kernel: 'lanczos3' as const };

  const [color, tone, mask] = await Promise.all([
    sharp(SOURCE).extract(region).resize(size).removeAlpha().raw().toBuffer(),
    sharp(SOURCE)
      .extract(region)
      .greyscale()
      .clahe({ width: 48, height: 48, maxSlope: 3 })
      .resize(size)
      .sharpen({ sigma: 0.6 })
      .raw()
      .toBuffer(),
    sharp(full, { raw: { width, height, channels: 1 } })
      .extract(region)
      .resize(size)
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const alpha = (x: number, y: number) =>
    smooth(0.4, 0.85, mask[y * cols + x] / 255) * (1 - smooth(0.76, 1, y / ROWS));
  return { cols, color, tone, alpha };
};

// Real text at build time: tone sets density, and along strong edges the character follows
// the direction of the line. Anything outside the person stays empty.
export async function portraitArt() {
  const { cols, tone, alpha } = await cells();
  const at = (x: number, y: number) =>
    tone[Math.min(ROWS - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))] / 255;

  const lines: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      if (alpha(x, y) < 0.06) {
        line += ' ';
        continue;
      }
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      if (Math.hypot(gx, gy) > 0.3) {
        const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
        line += angle < 22 || angle >= 158 ? '|' : angle < 67 ? '\\' : angle < 112 ? '-' : '/';
        continue;
      }
      line += TONES[Math.max(1, Math.round(at(x, y) ** 0.9 * (TONES.length - 1)))];
    }
    lines.push(line.trimEnd());
  }
  return { text: lines.join('\n'), cols, rows: ROWS };
}

// One pixel per character: the photo's colour, with shadows lifted so a dark suit still
// reads against a black page, and the person's outline in the alpha channel.
export async function portraitColors() {
  const { cols, color, alpha } = await cells();
  const out = Buffer.alloc(cols * ROWS * 4);
  const lift = (v: number) => Math.round((v / 255) ** 0.8 * 255);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      out[i * 4] = lift(color[i * 3]);
      out[i * 4 + 1] = lift(color[i * 3 + 1]);
      out[i * 4 + 2] = lift(color[i * 3 + 2]);
      out[i * 4 + 3] = Math.round(alpha(x, y) * 255);
    }
  }
  return sharp(out, { raw: { width: cols, height: ROWS, channels: 4 } }).png().toBuffer();
}
