# 🌀 TEAR — Dimensional Rift Webcam Effect

> An interactive, browser-based webcam effect that uses hand tracking to simulate dimensional screen-tearing. Inspired by the multiverse aesthetic of modern comic-book animation, this project is built entirely with **MediaPipe**, the **Canvas API**, and **WebAudio**. No game engines, no external assets, and 100% procedurally generated.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made with MediaPipe](https://img.shields.io/badge/MediaPipe-HandLandmarker-blue)](https://developers.google.com/mediapipe)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-ff69b4)](#)

**Want to try it without installing anything?** Skip to the
[CLICK HERE](#live-preview) section.

---

## ✨ Features

- ✋ **Real-time hand tracking** with MediaPipe (GPU + CPU fallback)
- ✊ **Fist-grab gesture** — close both fists, touch them, and pull to create the tear
- 🌌 **Animated dimensional rift** — jagged noise-driven edges, glowing
  magenta↔cyan color grading, hot white cores
- 🪞 **Inverted "other-side" interior** — hue-cycling, glitch slices,
  chromatic RGB ghosts, crawling ben-day print dots
- 💥 **Comic-book FX** — reality-debris shards, shockwave rings, white
  flash, screen shake + punch-zoom, film grain, vignette
- 🔤 **Onomatopoeia bursts** — `RIIIP!`, `SLAMM!`, `KRAKK!` with
  chromatic-offset display type (Bangers font)
- 🔊 **Fully synthesized audio** — low-frequency rumble, noise-sweep
  rips, thumpy bass snaps (no sound files)
- 🎬 **Cinematic letterbox** that slides in while the rift is active
- 🖥️ **Hand-skeleton overlay** for visualizing the tracking (toggle with H)

---

## 🎮 How to Use

1. Open the app (local or [live preview](#live-preview)) and click **ENTER THE RIFT**.
2. Allow camera access when prompted.
3. Step back so the camera sees **both hands**.
4. **Close both fists** and **touch them together** — a vibrating tension
   line appears (`grrrr…`). 
5. **Pull your fists apart** — the rift tears open as wide as you stretch.
6. **Hold it wide** — the interior stabilizes into a calm window.
7. **Let go** — `SLAMM!` — it snaps shut with a flash and shockwave.

### Keyboard Controls

| Key | Action |
|-----|--------|
| `H` | Toggle hand-skeleton overlay |
| `M` | Mute / unmute audio |

---

## 🚀 Install & Run (Local)

### Requirements

- **Node.js 16+** ([download](https://nodejs.org)) — only for the dev server.
  You don't need it if you just use the live preview.
- A modern browser: **Chrome or Edge recommended** (uses `ctx.filter` on
  canvas, which is unreliable in Safari).
- A webcam. Decent lighting and a fairly plain background help tracking.

### Steps

```bash
# 1. clone the repo
git clone [https://github.com/maxpain-sys/dimensional-rift-tear.git](https://github.com/maxpain-sys/dimensional-rift-tear.git)
cd dimensional-rift-tear

# 2. run the server (no npm install needed — it's pure Node)
node server.js
