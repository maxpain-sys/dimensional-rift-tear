
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export class FX {
  constructor(stageCanvas, onomaLayer) {
    this.canvas = stageCanvas;
    this.layer = onomaLayer;
    this.shards = [];
    this.rings = [];
    this.flashA = 0;
    this.grainPat = null;
    this.vg = null; this.vgW = 0; this.vgH = 0;

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const im = g.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 28;
    }
    g.putImageData(im, 0, 0);
    this.grain = c;
  }

  spawnShard(x, y, ux, uy, energy, SC) {
    if (this.shards.length > 160) return;
    const speed = (80 + Math.random() * 220) * SC * (0.6 + energy);
    this.shards.push({
      x, y,
      vx: ux * speed + (Math.random() - 0.5) * 60 * SC,
      vy: uy * speed - 60 * SC,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      size: (3 + Math.random() * 6) * SC,
      life: 0.5 + Math.random() * 0.6,
      max: 1,
      ci: Math.random() < 0.5 ? '#ff2fd6' : '#19e6ff',
    });
    this.shards[this.shards.length - 1].max = this.shards[this.shards.length - 1].life;
  }

  shockwave(x, y, SC) {
    const max = 300 * SC;
    this.rings.push({ x, y, r: 6, max, lw: 5 * SC });
    this.rings.push({ x, y, r: 36, max: max * 1.15, lw: 4 * SC });
    this.rings.push({ x, y, r: 70, max: max * 1.3, lw: 3 * SC });
    this.flashA = Math.max(this.flashA, 0.9);
  }

  flash(a) { this.flashA = Math.max(this.flashA, a); }

  // maps canvas coordinates to where the object-fit:contain canvas
  // actually displays in the viewport
  mapToViewport(x, y, W, H) {
    const r = this.canvas.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = r.left + (r.width - W * s) / 2;
    const oy = r.top + (r.height - H * s) / 2;
    return { x: ox + x * s, y: oy + y * s };
  }

  // places the burst at the canvas position mapped to the viewport
  onoma(word, x, y, W, H, cls = 'big') {
    const p = this.mapToViewport(x, y, W, H);
    const r = this.canvas.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'onoma ' + cls;
    d.textContent = word;
    d.style.setProperty('--rot', (Math.random() * 22 - 11).toFixed(1) + 'deg');
    d.style.translate = '-50% -50%';
    const m = cls === 'big' ? 0.18 : 0.05;
    d.style.left = clamp(p.x, r.width * m, r.width * (1 - m)) + 'px';
    d.style.top = clamp(p.y, r.height * 0.08, r.height * 0.85) + 'px';
    this.layer.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
    setTimeout(() => d.remove(), 1600); // safety net
  }

  renderWorld(ctx, dt, SC) {
    // shards: reality debris
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      if (s.life <= 0) { this.shards.splice(i, 1); continue; }
      s.vy += 140 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
      const a = Math.max(s.life / s.max, 0);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.strokeStyle = s.ci;
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.size, 0);
      ctx.lineTo(-s.size * 0.6, s.size * 0.55);
      ctx.lineTo(-s.size * 0.6, -s.size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // rings: comic shockwaves with print-misregistration offsets
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      rg.r += dt * 1000 * SC;
      if (rg.r >= rg.max) { this.rings.splice(i, 1); continue; }
      const a = 1 - rg.r / rg.max;
      ctx.lineWidth = rg.lw;
      ctx.strokeStyle = `rgba(255,47,214,${a * 0.6})`;
      ctx.beginPath(); ctx.arc(rg.x - 3, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(25,230,255,${a * 0.6})`;
      ctx.beginPath(); ctx.arc(rg.x + 3, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  renderScreen(ctx, W, H, dt) {
    // film grain
    if (!this.grainPat) this.grainPat = ctx.createPattern(this.grain, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    ctx.fillStyle = this.grainPat;
    ctx.fillRect(-128, -128, W + 256, H + 256);
    ctx.restore();

    // vignette
    if (!this.vg || this.vgW !== W || this.vgH !== H) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(5,2,15,0)');
      g.addColorStop(1, 'rgba(5,2,15,.55)');
      this.vg = g; this.vgW = W; this.vgH = H;
    }
    ctx.fillStyle = this.vg;
    ctx.fillRect(0, 0, W, H);

    // white flash
    if (this.flashA > 0) {
      this.flashA = Math.max(0, this.flashA - dt * 2.6);
      ctx.fillStyle = `rgba(255,255,255,${this.flashA * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
