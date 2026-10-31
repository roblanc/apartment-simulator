import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const WALL_THICKNESS = 0.15;
const CEILING_HEIGHT = 2.7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
scene.fog = new THREE.Fog(0x0b0d10, 25, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
let sceneCenter = new THREE.Vector3(0, 0, 0);
let sceneRadius = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- orbit controls (default) ---
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.2, 0);
orbit.enableDamping = true;
orbit.zoomSpeed = 3;
orbit.panSpeed = 2.5;
orbit.rotateSpeed = 1.2;
orbit.maxPolarAngle = Math.PI * 0.495;

// --- fly mode (pointer lock + free WASD + space/shift) ---
// A plain click (no drag) enters fly mode; a drag is left alone for orbit rotate.
const pointerLock = new PointerLockControls(camera, document.body);
const keys = { w: false, a: false, s: false, d: false, ' ': false };
let walking = false;
let downPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const dx = e.clientX - downPos[0], dy = e.clientY - downPos[1];
  downPos = null;
  if (Math.hypot(dx, dy) > 4) return; // was a drag, not a click
  if (e.button !== 0) return; // only left click enters fly mode
  walking = true;
  orbit.enabled = false;
  pointerLock.lock();
});
pointerLock.addEventListener('unlock', () => {
  walking = false;
  orbit.enabled = true;
});
window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = true; });
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });

// --- top-down view ---
const topBtn = document.getElementById('topBtn');
topBtn.addEventListener('click', () => {
  if (walking) { pointerLock.unlock(); }
  orbit.target.copy(sceneCenter);
  camera.position.set(sceneCenter.x + 0.01, sceneRadius * 2.2, sceneCenter.z + 0.01);
  orbit.update();
});

// --- roof toggle (hidden by default) ---
const roofBtn = document.getElementById('roofBtn');
let roofVisible = false;
roofBtn.addEventListener('click', () => {
  roofVisible = !roofVisible;
  ceilingMeshes.forEach((m) => (m.visible = roofVisible));
  roofBtn.textContent = roofVisible ? 'Hide roof' : 'Show roof';
});

function toVec3(p2, y) {
  return new THREE.Vector3(p2[0], y, p2[1]);
}

function shapeFromPolygon(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  return shape;
}

function addFlatPolygon(points, height, color, opts = {}) {
  const shape = shapeFromPolygon(points.map(([x, y]) => [x, y]));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    transparent: !!opts.opacity,
    opacity: opts.opacity ?? 1,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

function addWallBox(start, end, xStart, xEnd, yStart, yEnd, color) {
  const dir = new THREE.Vector2(end[0] - start[0], end[1] - start[1]);
  const length = dir.length();
  if (length < 1e-6) return;
  const angle = Math.atan2(dir.y, dir.x);
  const segLen = Math.max(xEnd - xStart, 0.001);
  const segH = Math.max(yEnd - yStart, 0.001);
  const geo = new THREE.BoxGeometry(segLen, segH, WALL_THICKNESS);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  const midLocal = (xStart + xEnd) / 2;
  const worldX = start[0] + Math.cos(angle) * midLocal;
  const worldZ = start[1] + Math.sin(angle) * midLocal;
  mesh.position.set(worldX, (yStart + yEnd) / 2, worldZ);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addOpeningPanel(start, end, xStart, xEnd, yStart, yEnd, color, opacity) {
  const dir = new THREE.Vector2(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(dir.y, dir.x);
  const segLen = Math.max(xEnd - xStart, 0.001);
  const segH = Math.max(yEnd - yStart, 0.001);
  const geo = new THREE.PlaneGeometry(segLen, segH);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  const midLocal = (xStart + xEnd) / 2;
  const worldX = start[0] + Math.cos(angle) * midLocal;
  const worldZ = start[1] + Math.sin(angle) * midLocal;
  mesh.position.set(worldX, (yStart + yEnd) / 2, worldZ);
  mesh.rotation.y = -angle;
  scene.add(mesh);
}

function buildWall(wall, openings) {
  const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  let freeIntervals = [[0, length]];

  const sortedOpenings = openings.slice().sort((a, b) => a.xStart - b.xStart);

  for (const o of sortedOpenings) {
    const xs = Math.max(0, o.xStart);
    const xe = Math.min(length, o.xEnd);
    if (o.yEnd < CEILING_HEIGHT) addWallBox(wall.start, wall.end, xs, xe, o.yEnd, CEILING_HEIGHT, 0x6b6f76);
    if (o.yStart > 0) addWallBox(wall.start, wall.end, xs, xe, 0, o.yStart, 0x6b6f76);
    addOpeningPanel(wall.start, wall.end, xs, xe, o.yStart, o.yEnd, o.kind === 'door' ? 0x8a5a33 : 0x8fd4e8, o.kind === 'door' ? 1 : 0.35);

    const next = [];
    for (const [fs, fe] of freeIntervals) {
      if (xe <= fs || xs >= fe) { next.push([fs, fe]); continue; }
      if (xs > fs) next.push([fs, xs]);
      if (xe < fe) next.push([xe, fe]);
    }
    freeIntervals = next;
  }

  for (const [fs, fe] of freeIntervals) {
    if (fe - fs > 0.01) addWallBox(wall.start, wall.end, fs, fe, 0, CEILING_HEIGHT, 0x6b6f76);
  }
}

const res = await fetch('./scene.json');
const data = await res.json();
const nodes = data.nodes;

const openingsByWall = {};
for (const id in nodes) {
  const n = nodes[id];
  if (n.type !== 'door' && n.type !== 'window') continue;
  const xCenter = n.position[0];
  const yCenter = n.position[1];
  const entry = {
    kind: n.type,
    xStart: xCenter - n.width / 2,
    xEnd: xCenter + n.width / 2,
    yStart: yCenter - n.height / 2,
    yEnd: yCenter + n.height / 2,
  };
  (openingsByWall[n.wallId] ??= []).push(entry);
}

// bounding box of all rooms, for framing the camera / top-down view
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const id in nodes) {
  const n = nodes[id];
  if (n.type !== 'zone') continue;
  for (const [x, z] of n.polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
}
sceneCenter = new THREE.Vector3((minX + maxX) / 2, 1.2, (minZ + maxZ) / 2);
sceneRadius = Math.max(maxX - minX, maxZ - minZ) / 2 + 2;
orbit.target.copy(sceneCenter);
orbit.minDistance = sceneRadius * 0.5;
orbit.maxDistance = sceneRadius * 5;
camera.position.set(sceneCenter.x + sceneRadius * 0.9, sceneRadius * 0.9, sceneCenter.z + sceneRadius * 0.9);
ground.position.set(sceneCenter.x, -0.02, sceneCenter.z);

// exterior walls: those bordering exactly one zone (used to find the entrance door)
const edgeKey = (a, b) => `${Math.round(a[0] * 1000)},${Math.round(a[1] * 1000)}|${Math.round(b[0] * 1000)},${Math.round(b[1] * 1000)}`;
const wallEndpoints = {};
for (const id in nodes) {
  const n = nodes[id];
  if (n.type === 'wall') wallEndpoints[id] = [n.start, n.end];
}
const wallZoneCount = {};
for (const id in nodes) {
  const n = nodes[id];
  if (n.type !== 'zone') continue;
  for (let i = 0; i < n.polygon.length; i++) {
    const a = n.polygon[i], b = n.polygon[(i + 1) % n.polygon.length];
    for (const wid in wallEndpoints) {
      const [ws, we] = wallEndpoints[wid];
      if (edgeKey(a, b) === edgeKey(ws, we) || edgeKey(a, b) === edgeKey(we, ws)) {
        wallZoneCount[wid] = (wallZoneCount[wid] ?? 0) + 1;
      }
    }
  }
}

const ceilingMeshes = [];
for (const id in nodes) {
  const n = nodes[id];
  if (n.type === 'wall') {
    buildWall(n, openingsByWall[id] ?? []);
  } else if (n.type === 'door' && (wallZoneCount[n.wallId] ?? 0) <= 1) {
    const wall = nodes[n.wallId];
    const dir = new THREE.Vector2(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    const angle = Math.atan2(dir.y, dir.x);
    const wx = wall.start[0] + Math.cos(angle) * n.position[0];
    const wz = wall.start[1] + Math.sin(angle) * n.position[0];
    const div = document.createElement('div');
    div.textContent = 'Intrare';
    div.style.cssText = 'color:#fff;font:600 13px system-ui,sans-serif;background:rgba(180,60,20,0.75);padding:2px 8px;border-radius:5px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.6);';
    const label = new CSS2DObject(div);
    label.position.set(wx, 2.3, wz);
    scene.add(label);
  } else if (n.type === 'zone') {
    const color = n.floor?.finish?.properties?.color ?? '#999999';
    addFlatPolygon(n.polygon, 0.06, new THREE.Color(color));
    if (n.name) {
      const cx = n.polygon.reduce((s, p) => s + p[0], 0) / n.polygon.length;
      const cz = n.polygon.reduce((s, p) => s + p[1], 0) / n.polygon.length;
      const div = document.createElement('div');
      div.textContent = n.name;
      div.style.cssText = 'color:#fff;font:600 13px system-ui,sans-serif;background:rgba(10,12,16,0.55);padding:2px 8px;border-radius:5px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.6);';
      const label = new CSS2DObject(div);
      label.position.set(cx, 2.0, cz);
      scene.add(label);
    }
  } else if (n.type === 'ceiling') {
    ceilingMeshes.push(addFlatPolygon(n.polygon, CEILING_HEIGHT, new THREE.Color(0xe8e4da), { roughness: 1 }));
  }
}
ceilingMeshes.forEach((m) => (m.visible = roofVisible));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const FLY_SPEED = 12;
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (walking && pointerLock.isLocked) {
    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();
    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.d) move.add(right);
    if (keys.a) move.sub(right);
    if (keys[' ']) move.add(up);
    if (move.lengthSq() > 0) move.normalize();
    camera.position.addScaledVector(move, FLY_SPEED * dt);
  } else {
    orbit.update();
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();
