export {};

// One persistent field of characters. Each page declares a shape in the DOM (the portrait
// <pre> or a [data-glyph] heading) and the same particles fly between them on navigation.

// The first 16 cells are the portrait's own characters; the rest also serve as scramble.
const CHARS = ' .,:;-=+*xoX#%@|ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\{}<>[]()$&';
const ATLAS_GRID = 8;
const CELL = 64;
const COUNT = innerWidth < 768 ? 7000 : 20000;
const STRIDE = 21; // floats per particle
const MORPH_SECONDS = 1.5;

const VERT = `#version 300 es
in vec2 aFrom; in vec2 aTo; in vec2 aGlyph; in vec2 aBright; in vec2 aSize; in float aSeed;
in vec4 aColFrom; in vec4 aColTo; in vec2 aFill;
uniform vec2 uRes; uniform vec2 uMouse;
uniform float uT, uTime, uScroll, uDpr, uMouseOn, uDisperse, uMotion;
uniform vec3 uInk;
out float vGlyph; out float vAlpha; out float vHot; out float vFill; out vec3 vColor;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  float p = clamp((uT - aSeed * 0.45) / 0.55, 0.0, 1.0);
  float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
  float fly = sin(e * 3.14159265) * uMotion;

  vec2 pos = mix(aFrom, aTo - vec2(0.0, uScroll), e);
  vec2 d = pos - uRes * 0.5;
  float a = fly * (aSeed - 0.5) * 2.6;
  pos = uRes * 0.5 + mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
  pos += vec2(sin(aSeed * 91.0 + uTime * 2.0), cos(aSeed * 57.0 + uTime * 2.6)) * fly * 70.0;

  pos.x += (hash(aSeed * 7.0) - 0.5) * uDisperse * 300.0;
  pos.y -= hash(aSeed * 3.0) * uDisperse * 220.0;

  vec2 m = pos - uMouse;
  float f = uMouseOn * smoothstep(120.0, 0.0, length(m));
  pos += normalize(m + 0.001) * f * f * 16.0;

  float roll = floor(uTime * 13.0 + aSeed * 40.0);
  float scramble = 16.0 + floor(hash(aSeed + roll) * 48.0);
  float g = p <= 0.0 ? aGlyph.x : aGlyph.y;
  bool shimmer = uMotion > 0.5 && hash(aSeed + floor(uTime * 0.6)) > 0.997;
  if ((p > 0.0 && p < 1.0) || f > 0.55 || shimmer) g = scramble;

  vGlyph = g;
  vAlpha = mix(aBright.x, aBright.y, e) * (1.0 - uDisperse);
  vHot = max(max(fly, f * f), shimmer ? 0.8 : 0.0);
  vFill = mix(aFill.x, aFill.y, e) * (1.0 - fly) * (1.0 - f);
  vec4 col = mix(aColFrom, aColTo, e);
  vColor = mix(uInk, col.rgb, col.a);

  vec2 clip = pos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = mix(aSize.x, aSize.y, e) * (1.0 + fly * 0.6) * uDpr;
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uAtlas; uniform vec3 uHot; uniform float uPass;
in float vGlyph; in float vAlpha; in float vHot; in float vFill; in vec3 vColor;
out vec4 color;
void main() {
  vec2 cell = vec2(mod(vGlyph, 8.0), floor(vGlyph / 8.0));
  float shape = texture(uAtlas, (cell + gl_PointCoord) / 8.0).r;
  if (uPass < 0.5) {
    // Underpainting: soft overlapping blobs of each cell's colour, so there is no visible grid.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float blob = exp(-d * d * 3.2) * (1.0 - smoothstep(0.8, 1.0, d)) * vFill * vAlpha;
    if (blob < 0.004) discard;
    color = vec4(vColor * blob, blob);
    return;
  }
  float alpha = shape * vAlpha;
  // Lift toward white, not by scaling, so skin keeps its true hue.
  vec3 ink = mix(vColor, vec3(1.0), 0.32 * vFill);
  color = vec4(mix(ink, uHot, clamp(vHot, 0.0, 1.0)) * alpha, alpha);
}`;

const root = document.documentElement;
const canvas = document.getElementById('field') as HTMLCanvasElement | null;
const gl = canvas?.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const motionOn = () => !reducedQuery.matches || root.classList.contains('motion-on');

type Target = {
  x: number;
  y: number;
  glyph: number;
  bright: number;
  size: number;
  color?: [number, number, number];
  fill?: number;
};

function compile(ctx: WebGL2RenderingContext, type: number, source: string) {
  const shader = ctx.createShader(type)!;
  ctx.shaderSource(shader, source);
  ctx.compileShader(shader);
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    throw new Error(ctx.getShaderInfoLog(shader) ?? 'shader failed');
  }
  return shader;
}

function buildAtlas(ctx: WebGL2RenderingContext) {
  const size = ATLAS_GRID * CELL;
  const paper = document.createElement('canvas');
  paper.width = paper.height = size;
  const c = paper.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, size, size);
  c.fillStyle = '#fff';
  c.font = '500 50px "IBM Plex Mono", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  [...CHARS].forEach((char, i) => {
    c.fillText(char, (i % ATLAS_GRID) * CELL + CELL / 2, Math.floor(i / ATLAS_GRID) * CELL + CELL / 2);
  });
  const texture = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, paper);
  ctx.generateMipmap(ctx.TEXTURE_2D);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR_MIPMAP_LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
}

let colors: { data: Uint8ClampedArray; width: number } | null = null;

async function loadColors() {
  const image = new Image();
  image.src = '/portrait.png';
  await image.decode();
  const paper = document.createElement('canvas');
  paper.width = image.naturalWidth;
  paper.height = image.naturalHeight;
  const c = paper.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(image, 0, 0);
  colors = { data: c.getImageData(0, 0, paper.width, paper.height).data, width: paper.width };
}

// Portrait: every character in the <pre> lands on its exact cell, in the photo's colour.
function portraitTargets(pre: HTMLElement): Target[] {
  const lines = (pre.textContent ?? '').split('\n');
  const box = pre.getBoundingClientRect();
  const top = box.top + scrollY;
  const cw = parseFloat(getComputedStyle(pre).fontSize) * 0.6;
  const ch = box.height / lines.length;
  const step = cw < 2.4 ? 2 : 1;
  const targets: Target[] = [];
  for (let r = 0; r < lines.length; r += step) {
    for (let c = 0; c < lines[r].length; c += step) {
      const glyph = CHARS.indexOf(lines[r][c]);
      if (glyph <= 0) continue;
      const i = (r * (colors?.width ?? 0) + c) * 4;
      const px = colors?.data;
      targets.push({
        x: box.left + (c + 0.5 * step) * cw,
        y: top + (r + 0.5 * step) * ch,
        glyph,
        bright: px ? px[i + 3] / 255 : 0.8,
        size: ch * step * 1.6,
        color: px ? [px[i] / 255, px[i + 1] / 255, px[i + 2] / 255] : undefined,
        fill: 0.72,
      });
    }
  }
  return targets;
}

// Heading: rasterise the real element's text, then fill the letterforms with characters.
function wordTargets(el: HTMLElement): Target[] {
  const style = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const top = box.top + scrollY;
  const word = (el.textContent ?? '').trim();
  const w = Math.ceil(box.width);
  const h = Math.ceil(box.height);
  if (!w || !h || !word) return [];

  const paper = document.createElement('canvas');
  paper.width = w;
  paper.height = h;
  const c = paper.getContext('2d', { willReadFrequently: true })!;
  c.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  c.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff';
  const text = style.textTransform === 'uppercase' ? word.toUpperCase() : word;
  const m = c.measureText(text);
  const baseline = (h + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
  c.fillText(text, 0, baseline);
  const { data } = c.getImageData(0, 0, w, h);

  const letters = text.replace(/[^A-Z0-9]/g, '') || 'X';
  const sample = (cw: number, ch: number) => {
    const out: Target[] = [];
    for (let y = ch / 2; y < h; y += ch) {
      for (let x = cw / 2; x < w; x += cw) {
        if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] < 128) continue;
        const letter = letters[out.length % letters.length];
        out.push({
          x: box.left + x,
          y: top + y,
          glyph: CHARS.indexOf(letter),
          bright: 1,
          size: ch * 1.5,
        });
      }
    }
    return out;
  };
  let ch = innerWidth < 768 ? 4.6 : 7.5;
  let targets = sample(ch * 0.62, ch);
  while (targets.length > COUNT && ch < 40) {
    ch *= 1.12;
    targets = sample(ch * 0.62, ch);
  }
  return targets;
}

function currentTargets(): Target[] {
  const pre = document.querySelector<HTMLElement>('[data-portrait]');
  if (pre) return portraitTargets(pre);
  const word = document.querySelector<HTMLElement>('[data-glyph]');
  return word ? wordTargets(word) : [];
}

function start(ctx: WebGL2RenderingContext, view: HTMLCanvasElement) {
  const program = ctx.createProgram()!;
  ctx.attachShader(program, compile(ctx, ctx.VERTEX_SHADER, VERT));
  ctx.attachShader(program, compile(ctx, ctx.FRAGMENT_SHADER, FRAG));
  ctx.linkProgram(program);
  ctx.useProgram(program);
  buildAtlas(ctx);

  const state = new Float32Array(COUNT * STRIDE);
  const buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, state.byteLength, ctx.DYNAMIC_DRAW);
  const bind = (name: string, size: number, offset: number) => {
    const loc = ctx.getAttribLocation(program, name);
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, size, ctx.FLOAT, false, STRIDE * 4, offset * 4);
  };
  bind('aFrom', 2, 0);
  bind('aTo', 2, 2);
  bind('aGlyph', 2, 4);
  bind('aBright', 2, 6);
  bind('aSize', 2, 8);
  bind('aSeed', 1, 10);
  bind('aColFrom', 4, 11);
  bind('aColTo', 4, 15);
  bind('aFill', 2, 19);

  const u = (name: string) => ctx.getUniformLocation(program, name);
  const uniforms = {
    res: u('uRes'), mouse: u('uMouse'), t: u('uT'), time: u('uTime'), scroll: u('uScroll'),
    dpr: u('uDpr'), mouseOn: u('uMouseOn'), disperse: u('uDisperse'),
    motion: u('uMotion'), ink: u('uInk'), hot: u('uHot'), pass: u('uPass'),
  };

  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);

  for (let i = 0; i < COUNT; i++) {
    const o = i * STRIDE;
    state[o] = Math.random() * innerWidth;
    state[o + 1] = Math.random() * innerHeight;
    state[o + 4] = state[o + 5] = 16 + Math.floor(Math.random() * 48);
    state[o + 8] = state[o + 9] = 8;
    state[o + 10] = Math.random();
  }

  let morphStart = -10;
  let dpr = 1;
  const mouse = { x: -999, y: -999, tx: -999, ty: -999, on: 0, want: 0 };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    view.width = Math.round(innerWidth * dpr);
    view.height = Math.round(innerHeight * dpr);
    ctx.viewport(0, 0, view.width, view.height);
  };

  const rgb = (value: string) => {
    const hex = value.trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  };

  const paintTheme = () => {
    const style = getComputedStyle(root);
    ctx.uniform3fv(uniforms.ink, rgb(style.getPropertyValue('--fg')));
    ctx.uniform3fv(uniforms.hot, rgb(style.getPropertyValue('--accent')));
  };

  // Particles keep flying from wherever they are now, so an interrupted morph stays smooth.
  const morph = (instant = false) => {
    const targets = currentTargets();
    const order = Array.from({ length: COUNT }, (_, i) => i);
    for (let i = COUNT - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const animate = motionOn() && !instant;
    for (let n = 0; n < COUNT; n++) {
      const o = order[n] * STRIDE;
      const t = targets[n];
      state[o] = state[o + 2] || state[o];
      state[o + 1] = (state[o + 3] || state[o + 1]) - (animate ? lastScroll : 0);
      state[o + 4] = state[o + 5];
      state[o + 6] = state[o + 7];
      state[o + 8] = state[o + 9];
      state[o + 19] = state[o + 20];
      for (let k = 0; k < 4; k++) state[o + 11 + k] = state[o + 15 + k];
      if (t) {
        state[o + 2] = t.x;
        state[o + 3] = t.y;
        state[o + 5] = t.glyph;
        state[o + 7] = t.bright;
        state[o + 9] = t.size;
        state[o + 20] = t.fill ?? 0;
        state[o + 15] = t.color?.[0] ?? 0;
        state[o + 16] = t.color?.[1] ?? 0;
        state[o + 17] = t.color?.[2] ?? 0;
        state[o + 18] = t.color ? 1 : 0;
      } else {
        // Spares drift off and wait for a shape that needs them.
        state[o + 2] = Math.random() * innerWidth;
        state[o + 3] = Math.random() * innerHeight;
        state[o + 7] = 0;
        state[o + 9] = 8;
        state[o + 20] = 0;
      }
      if (!animate) {
        state[o] = state[o + 2];
        state[o + 1] = state[o + 3];
        state[o + 4] = state[o + 5];
        state[o + 19] = state[o + 20];
        for (let k = 0; k < 4; k++) state[o + 11 + k] = state[o + 15 + k];
      }
    }
    ctx.bufferSubData(ctx.ARRAY_BUFFER, 0, state);
    morphStart = animate ? performance.now() : performance.now() - 5000;
    fadeIn = animate ? 1 : 0;
  };

  let lastScroll = 0;
  let fadeIn = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    mouse.x += (mouse.tx - mouse.x) * 0.18;
    mouse.y += (mouse.ty - mouse.y) * 0.18;
    mouse.on += (mouse.want - mouse.on) * 0.12;
    lastScroll = scrollY;
    const t = (now - morphStart) / 1000 / MORPH_SECONDS;
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.uniform2f(uniforms.res, innerWidth, innerHeight);
    ctx.uniform2f(uniforms.mouse, mouse.x, mouse.y);
    ctx.uniform1f(uniforms.t, Math.min(t, 1));
    ctx.uniform1f(uniforms.time, now / 1000);
    ctx.uniform1f(uniforms.scroll, scrollY);
    ctx.uniform1f(uniforms.dpr, dpr);
    ctx.uniform1f(uniforms.mouseOn, mouse.on);
    ctx.uniform1f(uniforms.disperse, Math.min(1, scrollY / (innerHeight * 0.75)));
    ctx.uniform1f(uniforms.motion, motionOn() ? 1 : 0);
    ctx.uniform1f(uniforms.pass, 0);
    ctx.drawArrays(ctx.POINTS, 0, COUNT);
    ctx.uniform1f(uniforms.pass, 1);
    ctx.drawArrays(ctx.POINTS, 0, COUNT);
  };

  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    if (mouse.x < -500) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    mouse.want = 1;
  });
  document.addEventListener('pointerleave', () => (mouse.want = 0));

  let timer = 0;
  addEventListener('resize', () => {
    resize();
    clearTimeout(timer);
    timer = window.setTimeout(() => morph(true), 150);
  });

  document.addEventListener('astro:after-swap', () => {
    root.classList.add('has-field');
    paintTheme();
    morph();
  });
  addEventListener('field:theme', paintTheme);
  addEventListener('field:motion', () => morph());

  resize();
  paintTheme();
  root.classList.add('has-field');
  morph();
  requestAnimationFrame(frame);
}

if (gl && canvas) {
  const ready = [
    document.fonts.load('500 50px "IBM Plex Mono"'),
    document.fonts.load('200px Anton'),
    loadColors(),
  ];
  Promise.all(ready)
    .catch(() => {})
    .then(() => {
      try {
        start(gl, canvas);
      } catch {
        // No field: the real text stays visible, which is the designed fallback.
        root.classList.remove('has-field');
      }
    });
}
