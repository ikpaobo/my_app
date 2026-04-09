FULLBODY PUPPETRY WEB APP (Browser-Only)
=======================================

FOLDER STRUCTURE
----------------
fullbody-webapp/
│
├── index.html
├── style.css
├── app.js
├── models/
│   ├── humanoid.glb        <-- add your rigged avatar here
│   └── README_MODEL.txt
├── assets/
│   ├── textures/
│   └── images/
└── README.txt

WHAT YOU GET
------------
- Real-time webcam body tracking with MediaPipe Pose (33 landmarks)
- Hand tracking with MediaPipe Hands (21 landmarks per hand)
- Optional face mesh tracking (468 landmarks) for simple facial blendshape driving
- Three.js real-time 3D scene + GLTF avatar loading
- Skeleton helper + landmark debug overlay
- Motion smoothing, rotation limits, and gesture detection (Wave + Clap)
- Avatar switch support, record + playback, responsive UI
- Optimized controls for low-end PCs (render scale + face toggle)

HOW TO RUN (LOCAL)
------------------
1) Put your avatar file in: models/humanoid.glb
2) Start a local server inside fullbody-webapp:

   Python:
   python3 -m http.server 8080

   or Node:
   npx serve .

3) Open:
   http://localhost:8080

4) Click "Start Camera" and allow webcam permission.

IMPORTANT BROWSER NOTES
-----------------------
- Webcam access requires http://localhost or HTTPS.
- If you open index.html directly as file://, camera may fail in many browsers.
- Chrome/Edge are recommended for best WebGL + MediaPipe performance.

EXPECTED VISUAL RESULT
----------------------
- Left panel: full-screen 3D scene with your avatar.
- Avatar mirrors head/spine/arms/legs in real time.
- Hands animate finger chains if model has finger bones.
- Optional face mode drives simple smile, blink, and jaw-open expressions.
- Debug landmarks and skeleton overlays help alignment.

COMMON ERRORS + FIXES
---------------------
1) "Camera denied" or no webcam image
   - Allow camera in browser permissions.
   - Reload the tab and retry.
   - Confirm another app is not locking the webcam.

2) Avatar does not move
   - Ensure model is rigged with humanoid bones.
   - Rename the model file exactly to models/humanoid.glb.
   - Try the built-in fallback avatar from the Avatar dropdown.

3) Fingers do not animate
   - Model may not include finger chains or uses uncommon bone names.
   - Export with standard Mixamo-like names where possible.

4) Face expressions do not animate
   - Model needs blendshapes/morph targets (Smile, JawOpen, EyeBlinkLeft, EyeBlinkRight).
   - Keep "Use face mesh" enabled.

5) Low FPS / jitter on low-end PCs
   - Lower Render Scale slider (0.55–0.75 recommended).
   - Disable "Use face mesh".
   - Keep camera at 720p or lower.
   - Use a lighter avatar model (fewer polygons/textures).

LANDMARK-TO-RIG MAPPING OVERVIEW
--------------------------------
Pose (33 landmarks):
- Torso orientation from shoulders + hips
- Hips position from midpoint of left/right hips
- Left arm: shoulder->elbow->wrist
- Right arm: shoulder->elbow->wrist
- Left leg: hip->knee->ankle
- Right leg: hip->knee->ankle
- Neck/head from shoulder center -> nose direction

Hands (21 landmarks each hand):
- Thumb: 1->2->3->4
- Index: 5->6->7->8
- Middle: 9->10->11->12
- Ring: 13->14->15->16
- Pinky: 17->18->19->20

Face (468 landmarks, optional):
- Smile estimate from mouth corner spread
- Jaw-open estimate from upper/lower lip distance
- Blink estimate from eyelid distances

CDN LIBRARIES USED
------------------
MediaPipe:
- @mediapipe/camera_utils
- @mediapipe/drawing_utils
- @mediapipe/pose
- @mediapipe/hands
- @mediapipe/face_mesh

Three.js:
- three.module.js
- OrbitControls.js
- GLTFLoader.js

Animation helper:
- GSAP 3.x

