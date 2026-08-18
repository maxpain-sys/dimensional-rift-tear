

const MAG = [255, 47, 214];   // magenta edge
const CYN = [25, 230, 255];   // cyan edge
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export class DimensionalTear {
  constructor() {
    this.N = 16;
    this.top = Array.from({ length: this.N }, () => ({ x: 0, y: 0 }));
    this.bot = Array.from({ length: this.N }, () => ({ x: 0, y: 0 }));
    this.open = 0;        // 0 sealed .. 1 fully ripped
    this.energy = 0;      // motion energy, drives glitch/shake
    this.stab = 0;        // smoothed "held wide open" -> interior calms
    this.slamming = false;
    this.inited = false;
    this.seed = Math.random() * 100;
    this.ax = 0; this.ay = 0; this.bx = 0; this.by = 0;
    this.W = 0; this.H = 0;

    const dc = document.createElement('canvas');
    dc.width = dc.height = 12;
    const g = dc.getContext('2d');
    g.fillStyle = '#000';
    g.beginPath(); g.arc(6, 6, 2.3, 0, Math.PI * 2); g.fill();
    this.dots = dc;
    this.dotPat = null;
  }

  // band-limited pseudo-noise, organic without a library
  noise(t, s) {
    return Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 2.13 + s * 1.7 + 1.3) * 0.3 + Math.sin(t * 4.71 + s * 0.3 + 2.1) * 0.2;
  }

  slam() { this.slamming = true; }

  center() {
    const i = this.N >> 1;
    return { x: (this.top[i].x + this.bot[i].x) / 2, y: (this.top[i].y + this.bot[i].y) / 2 };
  }

  update(A, B, targetOpen, energy, dt, SC, W, H) {
    this.W = W; this.H = H; this.energy = energy;
    this.ax = A.x; this.ay = A.y; this.bx = B.x; this.by = B.y;

    const rate = this.slamming ? 18 : 10;
    this.open += (targetOpen - this.open) * (1 - Math.exp(-dt * rate));
    if (this.open < 0.02) this.slamming = false;

    const stabTarget = this.open > 0.82 ? 1 : 0;
    this.stab += (stabTarget - this.stab) * (1 - Math.exp(-dt * 4));

    if (this.open <= 0.001) { this.inited = false; return; }

    const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const dx = (B.x - A.x) / L, dy = (B.y - A.y) / L;
    const nx = -dy, ny = dx;
    const maxW = Math.min(L * 0.42, 250 * SC);
    const k = this.inited ? 1 - Math.exp(-dt * 14) : 1; // snap on first frame, then ease

    for (let i = 0; i < this.N; i++) {
      const t = i / (this.N - 1);
      const taper = 0.35 + 0.65 * Math.sin(Math.PI * t);
      const j = this.noise(t * 6, this.seed) * (6 + this.open * 26 + this.energy * 20) * SC * taper;
      const w = this.open * maxW * Math.pow(Math.sin(Math.PI * t), 0.65) + 1.5;
      const e1 = this.noise(t * 9, this.seed + 31) * 4 * (0.3 + this.open);
      const e2 = this.noise(t * 9, this.seed + 77) * 4 * (0.3 + this.open);
      const bx = A.x + (B.x - A.x) * t + nx * j;
      const by = A.y + (B.y - A.y) * t + ny * j;
      const p = this.top[i], q = this.bot[i];
      p.x += (bx + nx * (w + e1) - p.x) * k;
      p.y += (by + ny * (w + e1) - p.y) * k;
      q.x += (bx - nx * (w + e2) - q.x) * k;
      q.y += (by - ny * (w + e2) - q.y) * k;
    }
    this.inited = true;
  }

  render(ctx, src, fx, now, SC, uni) {
    const W = this.W, H = this.H;
    if (this.open <= 0.02 || !W) return;
    const P = this.top, Q = this.bot, N = this.N;
    const o = this.open, en = this.energy;

    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (let i = 0; i < N; i++) {
      for (const p of [P[i], Q[i]]) {
        if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
        if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
      }
    }
    const pad = 20 * SC;
    mnx -= pad; mny -= pad; mxx += pad; mxy += pad;

    // ---- interior ----
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(P[i].x, P[i].y);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(Q[i].x, Q[i].y);
    ctx.closePath();
    ctx.clip();

    const dxg = (3 + en * 9) * SC;
    // where the room canvas lands, cover-fit into the bbox (+parallax)
    let uniDraw = null;
    if (uni && uni.cv) {
      const rw = uni.cv.width || 960, rh = uni.cv.height || 540;
      const s = Math.max((mxx - mnx) / rw, (mxy - mny) / rh) * 1.12;
      const dw = rw * s, dh = rh * s;
      uniDraw = {
        s,
        dx: (mnx + mxx) / 2 - dw / 2 + (uni.px || 0),
        dy: (mny + mxy) / 2 - dh / 2 + (uni.py || 0),
        dw, dh, rw, rh,
      };
    }

    if (uniDraw) {
      // ---- a window into someone's bedroom ----
      ctx.filter = 'saturate(1.12) contrast(1.05)';
      ctx.drawImage(uni.cv, uniDraw.dx, uniDraw.dy, uniDraw.dw, uniDraw.dh);

      // glitch slices sampled from the room
      if (Math.random() > this.stab * 0.7) {
        const slices = 1 + Math.round(Math.random() * (1 + en * 3));
        for (let g = 0; g < slices; g++) {
          const sh = 6 + Math.random() * 26 * SC;
          const sy = clamp(mny + Math.random() * (mxy - mny - sh), 0, H - sh);
          const shU = clamp(sh / uniDraw.dh * uniDraw.rh, 2, uniDraw.rh);
          const syU = clamp((sy - uniDraw.dy) / uniDraw.dh * uniDraw.rh, 0, uniDraw.rh - shU);
          const off = (Math.random() - 0.5) * 46 * SC * (0.3 + en);
          ctx.drawImage(uni.cv, 0, syU, uniDraw.rw, shU, off, sy, (mxx - mnx) + 40, sh);
        }
      }

      // chromatic ghosts of the room
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(-50deg)';
      ctx.drawImage(uni.cv, uniDraw.dx - dxg, uniDraw.dy, uniDraw.dw, uniDraw.dh);
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(150deg)';
      ctx.drawImage(uni.cv, uniDraw.dx + dxg, uniDraw.dy, uniDraw.dw, uniDraw.dh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // ---- the inverted other-side (rift mode) ----
      // hue steps in discrete increments: continuous values force
      // per-frame filter recompiles and stutter
      const hue = 160 + 30 * (Math.floor(now * 6) % 12);
      const drift = 1 + 0.05 * Math.sin(now * 0.7);
      ctx.filter = `invert(1) hue-rotate(${hue}deg) saturate(2.7) contrast(1.35) brightness(1.08)`;
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(drift, drift); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(src, 0, 0, W, H);
      ctx.restore();

      // glitch slices of raw feed sliding sideways
      if (Math.random() > this.stab * 0.7) {
        const slices = 1 + Math.round(Math.random() * (1 + en * 3));
        for (let g = 0; g < slices; g++) {
          const sh = 6 + Math.random() * 26 * SC;
          const sy = clamp(mny + Math.random() * (mxy - mny - sh), 0, H - sh);
          const off = (Math.random() - 0.5) * 46 * SC * (0.3 + en);
          ctx.drawImage(src, 0, sy, W, sh, off, sy, W, sh);
        }
      }

      // chromatic ghosts of the feed
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(-50deg)';
      ctx.drawImage(src, -dxg, 0, W, H);
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(150deg)';
      ctx.drawImage(src, dxg, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ben-day print dots, slowly crawling
    if (!this.dotPat) this.dotPat = ctx.createPattern(this.dots, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(Math.floor(now * 8) % 12, 0);
    ctx.fillStyle = this.dotPat;
    ctx.fillRect(mnx - 12, mny, (mxx - mnx) + 24, mxy - mny);
    ctx.restore();

    // inner rim halo (re-strokes the still-current clip path)
    ctx.lineWidth = 22 * SC;
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.stroke();

    // star twinkles when held open
    if (o > 0.4) {
      ctx.globalCompositeOperation = 'lighter';
      const n = 1 + Math.round(Math.random() * 2);
      for (let s = 0; s < n; s++) {
        const x = mnx + Math.random() * (mxx - mnx);
        const y = mny + Math.random() * (mxy - mny);
        const r = (3 + Math.random() * 5) * SC;
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * o + Math.random() * 0.3})`;
        ctx.lineWidth = 1.5 * SC;
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore(); // unclip

    // ---- edges: glowing, color-graded magenta -> cyan ----
    for (const [pts] of [[P], [Q]]) {
      for (let i = 0; i < N - 1; i++) {
        const t = i / (N - 2);
        const col = mix(MAG, CYN, t);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.5)`;
        ctx.lineWidth = (5 + en * 4) * SC;
        ctx.shadowColor = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.shadowBlur = 16 * SC;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.lineWidth = 2.4 * SC;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 7 * SC;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    // ---- fray spikes + reality debris ----
    for (const [pts, sgn] of [[P, 1], [Q, -1]]) {
      for (let i = 2; i < N - 2; i += 2) {
        const vx = P[i].x - Q[i].x, vy = P[i].y - Q[i].y;
        const vl = Math.hypot(vx, vy) || 1;
        const ux = (vx / vl) * sgn, uy = (vy / vl) * sgn;
        if (Math.random() < 0.04 + en * 0.12) fx.spawnShard(pts[i].x, pts[i].y, ux, uy, en, SC);
        const len = (4 + Math.random() * 8 + en * 10) * SC;
        const w = 2.5 * SC;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.moveTo(pts[i].x + (-uy) * w, pts[i].y + ux * w);
        ctx.lineTo(pts[i].x + ux * len, pts[i].y + uy * len);
        ctx.lineTo(pts[i].x - (-uy) * w, pts[i].y - ux * w);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- grip flares anchored at both fists ----
    this.flare(ctx, this.ax, this.ay, now, SC);
    this.flare(ctx, this.bx, this.by, now, SC);
  }

  flare(ctx, x, y, now, SC) {
    const o = this.open;
    const cols = ['#ffffff', '#ff2fd6', '#19e6ff'];
    ctx.save();
    ctx.translate(x, y);
    for (let k = 0; k < 8; k++) {
      const a = now * 1.3 + k * Math.PI / 4;
      const r1 = (14 + 4 * Math.sin(now * 9 + k)) * SC * (0.7 + o * 0.5);
      const r2 = r1 + (10 + 5 * Math.sin(now * 7 + k * 2)) * SC;
      ctx.strokeStyle = cols[k % 3];
      ctx.lineWidth = 3 * SC;
      ctx.shadowColor = cols[k % 3];
      ctx.shadowBlur = 10 * SC;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.setLineDash([9 * SC, 7 * SC]);
    ctx.lineDashOffset = -now * 50;
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 * SC;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * SC * (0.8 + o * 0.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
