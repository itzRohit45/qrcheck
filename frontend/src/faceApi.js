import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models";
let loadPromise = null;

// Load once; SsdMobilenetv1 (accuracy) + landmarks (alignment) + recognition.
export function loadModels() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }
  return loadPromise;
}

const detectorOptions = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.5,
});

// Single aligned detection with a 128-d descriptor, or null if no clear face.
export async function detectSingle(video) {
  return faceapi
    .detectSingleFace(video, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();
}

// Eye Aspect Ratio — small when the eye is closed, used for blink detection.
function eyeAspectRatio(eye) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const v = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const h = 2 * dist(eye[0], eye[3]);
  return h === 0 ? 0 : v / h;
}

// Liveness: over a few seconds require a real face that either blinks or moves.
// A held-up photo stays static with open eyes and fails. onStatus reports progress.
export async function runLiveness(video, onStatus, opts = {}) {
  const durationMs = opts.durationMs || 3500;
  const intervalMs = opts.intervalMs || 250;
  const start = Date.now();

  let sawFace = false;
  let blinked = false;
  let moved = false;
  let minEar = Infinity;
  let maxEar = 0;
  let firstNose = null;

  while (Date.now() - start < durationMs) {
    const det = await detectSingle(video);
    if (det) {
      sawFace = true;
      const lm = det.landmarks;
      const ear =
        (eyeAspectRatio(lm.getLeftEye()) + eyeAspectRatio(lm.getRightEye())) /
        2;
      minEar = Math.min(minEar, ear);
      maxEar = Math.max(maxEar, ear);
      if (maxEar - minEar > 0.12) blinked = true;

      const nose = lm.getNose()[3]; // nose tip
      if (!firstNose) firstNose = nose;
      else if (Math.hypot(nose.x - firstNose.x, nose.y - firstNose.y) > 12)
        moved = true;

      onStatus &&
        onStatus(
          blinked || moved
            ? "Liveness confirmed"
            : "Blink or move your head slightly..."
        );
    } else {
      onStatus && onStatus("Center your face in the frame...");
    }
    if (blinked || moved) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { live: sawFace && (blinked || moved), sawFace };
}

// Average several descriptors for a more stable enrollment reference.
export async function captureDescriptors(video, count, onStatus) {
  const descriptors = [];
  for (let i = 0; i < count; i++) {
    onStatus && onStatus(`Capturing ${i + 1} of ${count}...`);
    // Give React time to update the UI before running heavy face detection
    await new Promise((r) => setTimeout(r, 100));
    let det = null;
    for (let attempt = 0; attempt < 20 && !det; attempt++) {
      det = await detectSingle(video);
      if (!det) await new Promise((r) => setTimeout(r, 200));
    }
    if (det) descriptors.push(Array.from(det.descriptor));
    await new Promise((r) => setTimeout(r, 400));
  }
  return descriptors;
}

// One descriptor for live verification, as a plain number[] for JSON transport.
export async function captureSingleDescriptor(video) {
  const det = await detectSingle(video);
  return det ? Array.from(det.descriptor) : null;
}
