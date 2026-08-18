

import { HandTracker, HAND_CONNECTIONS } from './hands.js';
import { DimensionalTear } from './tear.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';

const $ = id => document.getElementById(id);
const video = $('cam');
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const statusEl = $('status');
const startBtn = $('startBtn');
const startEl = $('start');
const startErr = $('startErr');

const mirror = document.createElement('canvas');
const mctx = mirror.getContext('2d');

const fx = new FX(canvas, $('onomaLayer'));
const audio = new AudioEngine();
const tear = new DimensionalTear();

let tracker = null;
let running = false;
let lastT = 0;
let W = 0, H = 0, SC = 1;
let showSkeleton = true;
let lastA = null, lastB = null, prevL = null, prevR = null;
let grip = false, armed = false, grrShown = false, ripShown = false, snapFired = false;
let energy = 0;

// distances are fractions of frame width
const GRIP_DIST = 0.26;
const OPEN_MIN = 0.25;
const OPEN_MAX = 0.62;
const SNAP_AT = 0.3;

const RIP_WORDS = ['RIIIP!', 'SHRRRIP!', 'KRA-KOOM!'];
const SNAP_WORDS = ['SLAMM!', 'KRAKK!', 'WHAMM!'];
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function setStatus(t) {
  if (statusEl.textContent !== t) statusEl.textContent = t;
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    startBtn.textContent = 'LOADING HAND TRACKER…';
    tracker = tracker || await HandTracker.create();
    startBtn.textContent = 'STARTING CAMERA…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    W = canvas.width = mirror.width = video.videoWidth || 1280;
    H = canvas.height = mirror.height = video.videoHeight || 720;
    SC = clamp(Math.min(W, H) / 720, 0.7, 1.4);
    audio.init();
    startEl.classList.add('hidden');
    running = true;
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    startErr.textContent =
      'Setup failed: ' + (err && err.message || err) +
      ' — try Chrome/Edge, allow camera access, and check your internet (the tracking model loads once from a CDN).';
    startBtn.disabled = false;
    startBtn.textContent = 'TRY AGAIN';
  }
});

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'h') showSkeleton = !showSkeleton;
  if (k === 'm') audio.toggleMute();
});

function drawTension(a, b, now) {
  ctx.save();
  ctx.setLineDash([8 * SC, 12 * SC]);
  ctx.lineDashOffset = -now * 80;
  ctx.lineWidth = 2 * SC;
  ctx.strokeStyle = 'rgba(255,47,214,.45)';
  ctx.beginPath(); ctx.moveTo(a.x, a.y + 3); ctx.lineTo(b.x, b.y + 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(25,230,255,.45)';
  ctx.beginPath(); ctx.moveTo(a.x, a.y - 3); ctx.lineTo(b.x, b.y - 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2.6 * SC;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}

function drawSkeleton(h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(25,230,255,.75)';
  ctx.lineWidth = 2 * SC;
  ctx.shadowColor = '#19e6ff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const [i, j] of HAND_CONNECTIONS) {
    ctx.moveTo(h.pts[i].x, h.pts[i].y);
    ctx.lineTo(h.pts[j].x, h.pts[j].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff2fd6';
  for (let i = 1; i < h.pts.length; i++) {
    ctx.beginPath();
    ctx.arc(h.pts[i].x, h.pts[i].y, 3 * SC, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(h.pts[0].x, h.pts[0].y, 5 * SC, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loop(t) {
  if (!running) return;
  requestAnimationFrame(loop);
  const now = t / 1000;
  const dt = clamp(now - (lastT || now), 0.001, 0.05);
  lastT = now;

  // mirrored, lightly graded base frame
  mctx.save();
  mctx.translate(W, 0);
  mctx.scale(-1, 1);
  mctx.filter = 'saturate(1.15) contrast(1.06)';
  mctx.drawImage(video, 0, 0, W, H);
  mctx.restore();
  mctx.filter = 'none';

  const hands = tracker ? tracker.detect(video, W, H) : [];
  const two = hands.length >= 2;
  let target = 0;

  if (two) {
    hands.sort((a, b) => a.palm.x - b.palm.x);
    const L = hands[0], R = hands[1];
    lastA = L.palm; lastB = R.palm;
    const dN = Math.hypot(R.palm.x - L.palm.x, R.palm.y - L.palm.y) / W;

    // hysteresis so the fist hold doesn't flicker at the threshold
    const fs = L.fistScore + R.fistScore;
    grip = fs > 1.4 ? true : fs < 1.1 ? false : grip;

    if (grip && dN < GRIP_DIST) armed = true;

    const vel = (
      (prevL ? Math.hypot(L.palm.x - prevL.x, L.palm.y - prevL.y) : 0) +
      (prevR ? Math.hypot(R.palm.x - prevR.x, R.palm.y - prevR.y) : 0)
    ) / 2;
    const speed = clamp(vel / dt / W * 2.2, 0, 1);
    prevL = L.palm; prevR = R.palm;

    if (armed && grip) {
      target = clamp((dN - OPEN_MIN) / (OPEN_MAX - OPEN_MIN), 0, 1);
      if (target < 0.1) drawTension(L.palm, R.palm, now);
      if (target > 0.02 && target < 0.35 && !grrShown) {
        grrShown = true;
        fx.onoma('grrrr…', (L.palm.x + R.palm.x) / 2, (L.palm.y + R.palm.y) / 2, W, H, 'mini');
      }
    }

    const inst = clamp(speed + Math.abs(target - tear.open) * 9, 0, 1);
    energy += (inst - energy) * (1 - Math.exp(-dt * 8));

    if (target > 0.12 && tear.open < 0.12 && !ripShown) {
      ripShown = true;
      fx.onoma(pick(RIP_WORDS), (L.palm.x + R.palm.x) / 2, (L.palm.y + R.palm.y) / 2 - 40 * SC, W, H, 'big');
      audio.rip(energy);
    }
    if (target < 0.05) ripShown = false;

    setStatus(!grip ? 'CLOSE BOTH FISTS' : !armed ? 'TOUCH FISTS TOGETHER' : tear.open < 0.12 ? 'NOW PULL APART' : 'TEARING REALITY');

    if (!grip) { armed = false; prevL = prevR = null; }
    tear.update(L.palm, R.palm, target, energy, dt, SC, W, H);
  } else {
    prevL = prevR = null;
    armed = false;
    energy *= Math.exp(-dt * 3);
    setStatus('SHOW BOTH HANDS');
    if (lastA && lastB) tear.update(lastA, lastB, 0, energy * 0.5, dt, SC, W, H);
  }

  // release mid-rip => slam shut with a burst
  if ((!grip || !two) && tear.open > SNAP_AT && !snapFired) {
    snapFired = true;
    tear.slam();
    const c = tear.center();
    fx.shockwave(c.x, c.y, SC);
    fx.onoma(pick(SNAP_WORDS), c.x, c.y, W, H, 'big');
    audio.snap();
  }
  if (tear.open < 0.03) snapFired = false;

  // ---- composite the frame ----
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const zoom = 1 + tear.open * 0.035 + energy * 0.006;
  const shake = (energy * 3.2 + (armed && tear.open < 0.15 ? 1.4 : 0)) * SC;
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.drawImage(mirror, 0, 0);
  tear.render(ctx, mirror, fx, now, SC, null);
  if (showSkeleton) for (const h of hands) drawSkeleton(h);
  fx.renderWorld(ctx, dt, SC);
  ctx.restore();
  fx.renderScreen(ctx, W, H, dt);

  document.body.classList.toggle('tearing', tear.open > 0.18);
  audio.setTear(tear.open, energy);
}
