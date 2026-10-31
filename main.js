import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const WALL_THICKNESS = 0.15;
const CEILING_HEIGHT = 2.7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
scene.fog = new THREE.Fog(0x0b0d10, 25, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(8, 6, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

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
  new THREE.CircleGeometry(20, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- orbit controls (default) ---
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.2, 0);
orbit.enableDamping = true;

// --- walk mode (pointer lock + WASD) ---
const pointerLock = new PointerLockControls(camera, document.body);
const keys = { w: false, a: false, s: false, d: false };
let walking = false;
const walkBtn = document.getElementById('walkBtn');
walkBtn.addEventListener('click', () => {
  walking = true;
  orbit.enabled = false;
  camera.position.set(0, 1.6, 0);
  pointerLock.lock();
});
pointerLock.addEventListener('unlock', () => {
  walking = false;
  orbit.enabled = true;
});
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false; });

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
  geo.rotateX(-Math.PI / 2);
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

for (const id in nodes) {
  const n = nodes[id];
  if (n.type === 'wall') {
    buildWall(n, openingsByWall[id] ?? []);
  } else if (n.type === 'zone') {
    const color = n.floor?.finish?.properties?.color ?? '#999999';
    addFlatPolygon(n.polygon, 0.06, new THREE.Color(color));
  } else if (n.type === 'ceiling') {
    addFlatPolygon(n.polygon, CEILING_HEIGHT, new THREE.Color(0xe8e4da), { roughness: 1 });
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const WALK_SPEED = 2.6;
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (walking && pointerLock.isLocked) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.d) move.add(right);
    if (keys.a) move.sub(right);
    move.normalize();
    camera.position.addScaledVector(move, WALK_SPEED * dt);
    camera.position.y = 1.6;
  } else {
    orbit.update();
  }

  renderer.render(scene, camera);
}
animate();
