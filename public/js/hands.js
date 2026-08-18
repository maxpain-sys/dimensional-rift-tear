// Hand tracking via MediaPipe HandLandmarker (runs fully in-browser).
// Falls back across CDNs and CPU delegate so it survives flaky setups.

const CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14',
];
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function loadVision() {
  let lastErr;
  for (const base of CDN_BASES) {
    for (const url of [base, base + '/vision_bundle.mjs']) {
      try {
        return await import(url);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error('Could not load the MediaPipe tracking library (internet required): ' + (lastErr && lastErr.message));
}

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17],
];

export class HandTracker {
  static async create() {
    const vision = await loadVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.4, // loose, so fast rips don't drop tracking
      minHandPresenceConfidence: 0.4,
    });
    let hl;
    try {
      hl = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch (e) {
      hl = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU'));
    }
    return new HandTracker(hl);
  }

  constructor(hl) {
    this.hl = hl;
    this.lastVideoTime = -1;
    this.lastHands = [];
  }

  // Returns [{pts:[21 px points], palm:{x,y}, fistScore:0..1}]
  // Coordinates are mirrored to match the selfie view on screen.
  detect(video, W, H) {
    if (video.readyState < 2) return this.lastHands;
    if (video.currentTime === this.lastVideoTime) return this.lastHands;
    this.lastVideoTime = video.currentTime;

    let res;
    try {
      res = this.hl.detectForVideo(video, performance.now());
    } catch (e) {
      return this.lastHands;
    }

    const hands = [];
    for (const lm of res.landmarks || []) {
      const pts = lm.map(p => ({ x: (1 - p.x) * W, y: p.y * H }));
      const palm = {
        x: (pts[0].x + pts[5].x + pts[17].x) / 3,
        y: (pts[0].y + pts[5].y + pts[17].y) / 3,
      };
      // fist = fingertips pulled back near the wrist vs their PIP joints
      const tips = [8, 12, 16, 20], pips = [6, 10, 14, 18];
      let curled = 0;
      for (let i = 0; i < 4; i++) {
        const dT = (lm[tips[i]].x - lm[0].x) ** 2 + (lm[tips[i]].y - lm[0].y) ** 2;
        const dP = (lm[pips[i]].x - lm[0].x) ** 2 + (lm[pips[i]].y - lm[0].y) ** 2;
        if (dT < dP * 1.1) curled++;
      }
      hands.push({ pts, palm, fistScore: curled / 4 });
    }
    this.lastHands = hands;
    return hands;
  }
}
