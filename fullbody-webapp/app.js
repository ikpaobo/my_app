import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';

const ui = {
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  recordBtn: document.getElementById('recordBtn'),
  playBtn: document.getElementById('playBtn'),
  statusText: document.getElementById('statusText'),
  statusDot: document.getElementById('statusDot'),
  fpsBadge: document.getElementById('fpsBadge'),
  instructionOverlay: document.getElementById('instructionOverlay'),
  debugSkeleton: document.getElementById('debugSkeleton'),
  debugLandmarks: document.getElementById('debugLandmarks'),
  faceEnabled: document.getElementById('faceEnabled'),
  smoothRange: document.getElementById('smoothRange'),
  renderScale: document.getElementById('renderScale'),
  avatarSelect: document.getElementById('avatarSelect'),
  gestureCard: document.getElementById('gestureCard')
};

const threeCanvas = document.getElementById('threeCanvas');
const videoEl = document.getElementById('inputVideo');
const debugCanvas = document.getElementById('debugCanvas');
const debugCtx = debugCanvas.getContext('2d');

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d1a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 1.5, 3.8);

const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xc5d9ff, 0x101020, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(2, 4, 3);
scene.add(keyLight);
scene.add(new THREE.GridHelper(12, 24, 0x2d3b6d, 0x1a213f));

let avatarRoot = null;
let skeletonHelper = null;
let bones = {};
let morphMesh = null;
let morphMap = {};

const loader = new GLTFLoader();

const state = {
  cameraRunner: null,
  recording: false,
  playback: false,
  recordedFrames: [],
  lastPose: null,
  lastHands: null,
  lastFace: null,
  frameCount: 0,
  fpsTimer: 0,
  renderScale: Number(ui.renderScale.value),
  smoothFactor: Number(ui.smoothRange.value)
};

const MP_IDS = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28
};

const handJointGroups = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20]
};

const bodyBoneNameCandidates = {
  hips: ['Hips', 'hip', 'mixamorigHips'],
  spine: ['Spine', 'spine', 'mixamorigSpine'],
  chest: ['Chest', 'Spine2', 'mixamorigSpine2', 'UpperChest'],
  neck: ['Neck', 'mixamorigNeck'],
  head: ['Head', 'mixamorigHead'],
  leftUpperArm: ['LeftArm', 'LeftUpperArm', 'mixamorigLeftArm'],
  rightUpperArm: ['RightArm', 'RightUpperArm', 'mixamorigRightArm'],
  leftLowerArm: ['LeftForeArm', 'LeftLowerArm', 'mixamorigLeftForeArm'],
  rightLowerArm: ['RightForeArm', 'RightLowerArm', 'mixamorigRightForeArm'],
  leftHand: ['LeftHand', 'mixamorigLeftHand'],
  rightHand: ['RightHand', 'mixamorigRightHand'],
  leftUpperLeg: ['LeftUpLeg', 'LeftUpperLeg', 'mixamorigLeftUpLeg'],
  rightUpperLeg: ['RightUpLeg', 'RightUpperLeg', 'mixamorigRightUpLeg'],
  leftLowerLeg: ['LeftLeg', 'LeftLowerLeg', 'mixamorigLeftLeg'],
  rightLowerLeg: ['RightLeg', 'RightLowerLeg', 'mixamorigRightLeg'],
  leftFoot: ['LeftFoot', 'mixamorigLeftFoot'],
  rightFoot: ['RightFoot', 'mixamorigRightFoot']
};

const fingerBoneNamePatterns = {
  left: {
    thumb: ['LeftHandThumb1', 'LeftThumb1', 'mixamorigLeftHandThumb1'],
    index: ['LeftHandIndex1', 'LeftIndex1', 'mixamorigLeftHandIndex1'],
    middle: ['LeftHandMiddle1', 'LeftMiddle1', 'mixamorigLeftHandMiddle1'],
    ring: ['LeftHandRing1', 'LeftRing1', 'mixamorigLeftHandRing1'],
    pinky: ['LeftHandPinky1', 'LeftPinky1', 'mixamorigLeftHandPinky1']
  },
  right: {
    thumb: ['RightHandThumb1', 'RightThumb1', 'mixamorigRightHandThumb1'],
    index: ['RightHandIndex1', 'RightIndex1', 'mixamorigRightHandIndex1'],
    middle: ['RightHandMiddle1', 'RightMiddle1', 'mixamorigRightHandMiddle1'],
    ring: ['RightHandRing1', 'RightRing1', 'mixamorigRightHandRing1'],
    pinky: ['RightHandPinky1', 'RightPinky1', 'mixamorigRightHandPinky1']
  }
};

function setStatus(text, color = '#666') {
  ui.statusText.textContent = text;
  ui.statusDot.style.background = color;
  gsap.to(ui.statusDot, { boxShadow: `0 0 14px ${color}`, duration: 0.3 });
}

function safeNormalize(v) {
  const out = v.clone();
  if (out.lengthSq() < 1e-7) return out.set(0, 0, 1);
  return out.normalize();
}

function mpToVec3(point) {
  return new THREE.Vector3((point.x - 0.5) * 2, (0.5 - point.y) * 2, -point.z * 2);
}

function findBoneByCandidates(root, names) {
  for (const n of names) {
    const b = root.getObjectByName(n);
    if (b && b.isBone) return b;
  }
  return null;
}

function findFingerChain(startBone, side, fingerName) {
  if (!startBone) return [];
  const direct = findBoneByCandidates(startBone.parent || startBone, fingerBoneNamePatterns[side][fingerName]);
  if (!direct) return [];
  const chain = [direct];
  let current = direct;
  for (let i = 0; i < 2; i += 1) {
    const next = current.children.find((c) => c.isBone);
    if (!next) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

function cacheRig(root) {
  bones = {};
  for (const key of Object.keys(bodyBoneNameCandidates)) {
    bones[key] = findBoneByCandidates(root, bodyBoneNameCandidates[key]);
  }

  bones.leftFingers = {};
  bones.rightFingers = {};
  for (const finger of Object.keys(handJointGroups)) {
    bones.leftFingers[finger] = findFingerChain(bones.leftHand, 'left', finger);
    bones.rightFingers[finger] = findFingerChain(bones.rightHand, 'right', finger);
  }

  morphMesh = null;
  morphMap = {};
  root.traverse((obj) => {
    if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences && !morphMesh) {
      morphMesh = obj;
      morphMap = obj.morphTargetDictionary;
    }
  });

  if (skeletonHelper) scene.remove(skeletonHelper);
  skeletonHelper = new THREE.SkeletonHelper(root);
  skeletonHelper.visible = ui.debugSkeleton.checked;
  scene.add(skeletonHelper);
}

function loadAvatar(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        if (avatarRoot) scene.remove(avatarRoot);
        avatarRoot = gltf.scene;
        avatarRoot.position.set(0, 0, 0);
        avatarRoot.traverse((o) => {
          if (o.isMesh) {
            o.frustumCulled = false;
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });
        scene.add(avatarRoot);
        cacheRig(avatarRoot);
        setStatus('Avatar ready', '#56f39a');
        resolve();
      },
      undefined,
      (err) => {
        setStatus('Avatar load failed', '#ff6b88');
        reject(err);
      }
    );
  });
}

function applyBoneLookAt(bone, from, to, alpha = state.smoothFactor) {
  if (!bone) return;
  const dir = safeNormalize(to.clone().sub(from));
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  bone.quaternion.slerp(targetQuat, alpha);
}

function limitBoneEuler(bone, limits) {
  if (!bone) return;
  const e = new THREE.Euler().setFromQuaternion(bone.quaternion, 'XYZ');
  e.x = THREE.MathUtils.clamp(e.x, limits.x[0], limits.x[1]);
  e.y = THREE.MathUtils.clamp(e.y, limits.y[0], limits.y[1]);
  e.z = THREE.MathUtils.clamp(e.z, limits.z[0], limits.z[1]);
  bone.quaternion.setFromEuler(e);
}

function solveBody(poseLandmarks) {
  if (!poseLandmarks || !bones.hips) return;

  const p = poseLandmarks.map(mpToVec3);
  const ls = p[MP_IDS.leftShoulder];
  const rs = p[MP_IDS.rightShoulder];
  const lh = p[MP_IDS.leftHip];
  const rh = p[MP_IDS.rightHip];

  // Root center and torso orientation
  const hipCenter = lh.clone().add(rh).multiplyScalar(0.5);
  const shoulderCenter = ls.clone().add(rs).multiplyScalar(0.5);
  const torsoUp = safeNormalize(shoulderCenter.clone().sub(hipCenter));
  const shoulderAxis = safeNormalize(rs.clone().sub(ls));
  const torsoForward = safeNormalize(new THREE.Vector3().crossVectors(shoulderAxis, torsoUp));

  const basis = new THREE.Matrix4().makeBasis(shoulderAxis, torsoUp, torsoForward);
  const torsoQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

  bones.hips.position.lerp(new THREE.Vector3(hipCenter.x, hipCenter.y + 0.8, -hipCenter.z * 0.3), 0.08);
  bones.hips.quaternion.slerp(torsoQuat, state.smoothFactor * 0.7);

  applyBoneLookAt(bones.leftUpperArm, ls, p[MP_IDS.leftElbow]);
  applyBoneLookAt(bones.leftLowerArm, p[MP_IDS.leftElbow], p[MP_IDS.leftWrist]);
  applyBoneLookAt(bones.rightUpperArm, rs, p[MP_IDS.rightElbow]);
  applyBoneLookAt(bones.rightLowerArm, p[MP_IDS.rightElbow], p[MP_IDS.rightWrist]);

  applyBoneLookAt(bones.leftUpperLeg, lh, p[MP_IDS.leftKnee]);
  applyBoneLookAt(bones.leftLowerLeg, p[MP_IDS.leftKnee], p[MP_IDS.leftAnkle]);
  applyBoneLookAt(bones.rightUpperLeg, rh, p[MP_IDS.rightKnee]);
  applyBoneLookAt(bones.rightLowerLeg, p[MP_IDS.rightKnee], p[MP_IDS.rightAnkle]);

  applyBoneLookAt(bones.neck, shoulderCenter, p[MP_IDS.nose]);
  applyBoneLookAt(bones.head, shoulderCenter, p[MP_IDS.nose]);

  limitBoneEuler(bones.leftUpperArm, { x: [-1.8, 1.8], y: [-1.4, 1.4], z: [-1.8, 1.8] });
  limitBoneEuler(bones.rightUpperArm, { x: [-1.8, 1.8], y: [-1.4, 1.4], z: [-1.8, 1.8] });
  limitBoneEuler(bones.leftUpperLeg, { x: [-1.4, 1.1], y: [-0.8, 0.8], z: [-0.8, 0.8] });
  limitBoneEuler(bones.rightUpperLeg, { x: [-1.4, 1.1], y: [-0.8, 0.8], z: [-0.8, 0.8] });
}

function solveOneHand(handLandmarks, side) {
  if (!handLandmarks) return;
  const fingers = side === 'left' ? bones.leftFingers : bones.rightFingers;

  for (const fingerName of Object.keys(handJointGroups)) {
    const ids = handJointGroups[fingerName];
    const chain = fingers[fingerName] || [];
    if (!chain.length) continue;

    for (let i = 0; i < Math.min(chain.length, 3); i += 1) {
      const a = mpToVec3(handLandmarks[ids[i]]);
      const b = mpToVec3(handLandmarks[ids[i + 1]]);
      applyBoneLookAt(chain[i], a, b, state.smoothFactor * 1.2);
      limitBoneEuler(chain[i], { x: [-1.4, 1.4], y: [-0.9, 0.9], z: [-1.1, 1.1] });
    }
  }
}

function solveFace(faceLandmarks) {
  if (!ui.faceEnabled.checked || !faceLandmarks || !morphMesh) return;

  // Simple expression inference (eyebrow raise + smile + blink approximation)
  const lipLeft = faceLandmarks[61];
  const lipRight = faceLandmarks[291];
  const upperLip = faceLandmarks[13];
  const lowerLip = faceLandmarks[14];
  const leftEyeUp = faceLandmarks[159];
  const leftEyeDown = faceLandmarks[145];
  const rightEyeUp = faceLandmarks[386];
  const rightEyeDown = faceLandmarks[374];

  const smile = Math.min(1, Math.max(0, Math.abs(lipRight.x - lipLeft.x) * 5 - 0.35));
  const mouthOpen = Math.min(1, Math.max(0, Math.abs(lowerLip.y - upperLip.y) * 20 - 0.1));
  const blinkL = 1 - Math.min(1, Math.abs(leftEyeDown.y - leftEyeUp.y) * 45);
  const blinkR = 1 - Math.min(1, Math.abs(rightEyeDown.y - rightEyeUp.y) * 45);

  const setMorph = (nameOptions, value) => {
    for (const n of nameOptions) {
      const idx = morphMap[n];
      if (idx !== undefined) {
        morphMesh.morphTargetInfluences[idx] = THREE.MathUtils.lerp(morphMesh.morphTargetInfluences[idx], value, 0.35);
      }
    }
  };

  setMorph(['Smile', 'mouthSmile', 'MouthSmile'], smile);
  setMorph(['MouthOpen', 'jawOpen', 'JawOpen'], mouthOpen);
  setMorph(['EyeBlinkLeft', 'blinkLeft'], blinkL);
  setMorph(['EyeBlinkRight', 'blinkRight'], blinkR);
}

function updateGesture(poseLandmarks) {
  if (!poseLandmarks) return;
  const lW = poseLandmarks[MP_IDS.leftWrist];
  const rW = poseLandmarks[MP_IDS.rightWrist];
  const nose = poseLandmarks[MP_IDS.nose];

  let gesture = 'None';
  if (rW.y < nose.y - 0.1) {
    gesture = 'Wave';
  }

  const dx = lW.x - rW.x;
  const dy = lW.y - rW.y;
  if (Math.hypot(dx, dy) < 0.08) {
    gesture = 'Clap';
  }

  ui.gestureCard.textContent = `Gesture: ${gesture}`;
}

function drawDebug(poseLandmarks, handResults, faceLandmarks) {
  if (!ui.debugLandmarks.checked) {
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    return;
  }

  debugCtx.save();
  debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  debugCtx.drawImage(videoEl, 0, 0, debugCanvas.width, debugCanvas.height);

  if (poseLandmarks) {
    drawConnectors(debugCtx, poseLandmarks, POSE_CONNECTIONS, { color: '#7dd3fc', lineWidth: 2 });
    drawLandmarks(debugCtx, poseLandmarks, { color: '#facc15', lineWidth: 1, radius: 2 });
  }

  (handResults || []).forEach((hand) => {
    drawConnectors(debugCtx, hand, HAND_CONNECTIONS, { color: '#34d399', lineWidth: 2 });
    drawLandmarks(debugCtx, hand, { color: '#fde047', lineWidth: 1, radius: 2 });
  });

  if (faceLandmarks && ui.faceEnabled.checked) {
    drawConnectors(debugCtx, faceLandmarks, FACEMESH_TESSELATION, { color: 'rgba(168,85,247,0.35)', lineWidth: 0.5 });
  }

  debugCtx.restore();
}

const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});
pose.onResults((res) => {
  state.lastPose = res.poseLandmarks || null;
});

const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0,
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.55
});
hands.onResults((res) => {
  state.lastHands = res.multiHandLandmarks || [];
});

const faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: false,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});
faceMesh.onResults((res) => {
  state.lastFace = res.multiFaceLandmarks?.[0] || null;
});

async function processFrame() {
  if (videoEl.readyState < 2) return;
  await pose.send({ image: videoEl });
  await hands.send({ image: videoEl });
  if (ui.faceEnabled.checked) {
    await faceMesh.send({ image: videoEl });
  } else {
    state.lastFace = null;
  }

  if (state.recording) {
    state.recordedFrames.push({
      pose: structuredClone(state.lastPose),
      hands: structuredClone(state.lastHands),
      face: structuredClone(state.lastFace)
    });
    ui.playBtn.disabled = state.recordedFrames.length < 5;
  }
}

function applyTrackingFrame(poseData, handData, faceData) {
  solveBody(poseData);

  if (handData?.length) {
    if (handData[0]) solveOneHand(handData[0], 'left');
    if (handData[1]) solveOneHand(handData[1], 'right');
  }

  solveFace(faceData);
  updateGesture(poseData);
  drawDebug(poseData, handData, faceData);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  state.frameCount += 1;
  state.fpsTimer += dt;
  if (state.fpsTimer > 0.5) {
    const fps = Math.round(state.frameCount / state.fpsTimer);
    ui.fpsBadge.textContent = `FPS: ${fps}`;
    state.frameCount = 0;
    state.fpsTimer = 0;
  }

  if (avatarRoot) {
    if (!state.playback) {
      applyTrackingFrame(state.lastPose, state.lastHands, state.lastFace);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

async function startCamera() {
  if (state.cameraRunner) return;

  try {
    setStatus('Requesting camera...', '#fbbf24');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 540, frameRate: { ideal: 60, max: 60 } },
      audio: false
    });

    videoEl.srcObject = stream;
    await videoEl.play();

    state.cameraRunner = new Camera(videoEl, {
      onFrame: processFrame,
      width: 960,
      height: 540
    });
    state.cameraRunner.start();

    ui.startBtn.disabled = true;
    ui.stopBtn.disabled = false;
    gsap.to(ui.instructionOverlay, { autoAlpha: 0, duration: 0.4, pointerEvents: 'none' });
    setStatus('Tracking live', '#56f39a');
  } catch (e) {
    setStatus('Camera denied', '#ff6b88');
    console.error(e);
  }
}

function stopCamera() {
  if (!videoEl.srcObject) return;

  videoEl.srcObject.getTracks().forEach((t) => t.stop());
  videoEl.srcObject = null;

  if (state.cameraRunner) {
    state.cameraRunner.stop();
    state.cameraRunner = null;
  }

  ui.startBtn.disabled = false;
  ui.stopBtn.disabled = true;
  setStatus('Stopped', '#9ca3af');
}

function startRecording() {
  state.recordedFrames = [];
  state.recording = true;
  setStatus('Recording motion...', '#f97316');
  ui.recordBtn.textContent = 'Recording...';
}

async function playRecording() {
  if (!state.recordedFrames.length) return;
  state.playback = true;
  setStatus('Playback', '#60a5fa');

  for (const frame of state.recordedFrames) {
    applyTrackingFrame(frame.pose, frame.hands, frame.face);
    await new Promise((r) => setTimeout(r, 33)); // ~30 fps playback
  }

  state.playback = false;
  state.recording = false;
  ui.recordBtn.textContent = 'Record';
  setStatus('Tracking live', '#56f39a');
}

function fitViewport() {
  const rect = threeCanvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  renderer.setSize(w * state.renderScale, h * state.renderScale, false);
  renderer.domElement.style.width = `${w}px`;
  renderer.domElement.style.height = `${h}px`;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  debugCanvas.width = w;
  debugCanvas.height = h;
}

ui.startBtn.addEventListener('click', startCamera);
ui.stopBtn.addEventListener('click', stopCamera);
ui.recordBtn.addEventListener('click', () => {
  if (!state.recording) {
    startRecording();
  } else {
    state.recording = false;
    ui.recordBtn.textContent = 'Record';
    setStatus('Recording saved', '#22c55e');
  }
});
ui.playBtn.addEventListener('click', playRecording);

ui.debugSkeleton.addEventListener('change', () => {
  if (skeletonHelper) skeletonHelper.visible = ui.debugSkeleton.checked;
});

ui.smoothRange.addEventListener('input', () => {
  gsap.to(state, { smoothFactor: Number(ui.smoothRange.value), duration: 0.2, overwrite: true });
});

ui.renderScale.addEventListener('input', () => {
  state.renderScale = Number(ui.renderScale.value);
  fitViewport();
});

ui.avatarSelect.addEventListener('change', async () => {
  setStatus('Loading avatar...', '#fbbf24');
  await loadAvatar(ui.avatarSelect.value);
});

window.addEventListener('resize', fitViewport);

(async function boot() {
  fitViewport();
  try {
    await loadAvatar(ui.avatarSelect.value);
  } catch (e) {
    console.warn('Avatar load issue:', e);
  }

  animate();
  setStatus('Idle', '#9ca3af');
})();
