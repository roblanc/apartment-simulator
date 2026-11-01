import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const WALL_THICKNESS = 0.08;
const WALL_COLOR = 0xf2f0ec;
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
renderer.localClippingEnabled = true;
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

// --- WASD movement, free at the same time as mouse drag-to-look (no pointer lock) ---
const keys = { w: false, a: false, s: false, d: false, ' ': false };
window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = true; });
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });

// --- top-down view ---
const topBtn = document.getElementById('topBtn');
topBtn.addEventListener('click', () => {
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

// --- walls toggle (floor plan mode: just the floor) ---
const wallsBtn = document.getElementById('wallsBtn');
let wallsVisible = true;
wallsBtn.addEventListener('click', () => {
  wallsVisible = !wallsVisible;
  wallMeshes.forEach((m) => (m.visible = wallsVisible));
  traceMeshes.forEach((m) => (m.visible = !wallsVisible));
  if (!wallsVisible) {
    roofVisible = false;
    ceilingMeshes.forEach((m) => (m.visible = false));
    roofBtn.textContent = 'Show roof';
  }
  wallsBtn.textContent = wallsVisible ? 'Hide walls' : 'Show walls';
});

// --- half walls toggle (dollhouse view: walls cut at 1.2m) ---
const HALF_WALL_HEIGHT = 1.2;
const halfWallPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), HALF_WALL_HEIGHT);
const halfWallsBtn = document.getElementById('halfWallsBtn');
let halfWallsOn = false;
halfWallsBtn.addEventListener('click', () => {
  halfWallsOn = !halfWallsOn;
  if (halfWallsOn) {
    // a top-down angle makes the clipped walls look identical to full walls; tilt to an oblique view so the cut is visible
    orbit.target.copy(sceneCenter);
    camera.position.set(sceneCenter.x + sceneRadius * 0.9, sceneRadius * 0.9, sceneCenter.z + sceneRadius * 0.9);
    orbit.update();
  }
  if (halfWallsOn && !wallsVisible) {
    wallsVisible = true;
    wallMeshes.forEach((m) => (m.visible = true));
    traceMeshes.forEach((m) => (m.visible = false));
    wallsBtn.textContent = 'Hide walls';
  }
  wallMeshes.forEach((m) => {
    m.material.clippingPlanes = halfWallsOn ? [halfWallPlane] : [];
    m.material.needsUpdate = true;
  });
  if (halfWallsOn) {
    roofVisible = false;
    ceilingMeshes.forEach((m) => (m.visible = false));
    roofBtn.textContent = 'Show roof';
  }
  renderer.shadowMap.enabled = !halfWallsOn;
  halfWallsBtn.textContent = halfWallsOn ? 'Full walls' : 'Half walls';
});

function toVec3(p2, y) {
  return new THREE.Vector3(p2[0], y, p2[1]);
}

function polygonArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function createPlankTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2ede3';
  ctx.fillRect(0, 0, size, size);

  const plankWidthPx = size / 4; // 4 board-widths per texture tile (~0.3m each at repeat below)
  for (let i = 0; i < 4; i++) {
    const shade = Math.floor(Math.random() * 10 - 5);
    ctx.fillStyle = `rgb(${242 + shade}, ${237 + shade}, ${227 + shade})`;
    ctx.fillRect(i * plankWidthPx, 0, plankWidthPx, size);
  }

  ctx.strokeStyle = 'rgba(120,100,80,0.3)';
  ctx.lineWidth = 2;
  for (let x = plankWidthPx; x < size; x += plankWidthPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(150,130,108,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 8, size * 0.33, x - 8, size * 0.66, x + 4, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 1.2, 1 / 1.2); // ShapeGeometry UVs are raw metres, so this is ~1.2m per plank-tile
  return tex;
}
const plankTexture = createPlankTexture();

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
    color: opts.map ? 0xffffff : color,
    map: opts.map ?? null,
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

const wallMeshes = [];

function addWallBox(start, end, xStart, xEnd, yStart, yEnd, color) {
  const dir = new THREE.Vector2(end[0] - start[0], end[1] - start[1]);
  const length = dir.length();
  if (length < 1e-6) return;
  const angle = Math.atan2(dir.y, dir.x);
  const segLen = Math.max(xEnd - xStart, 0.001);
  const segH = Math.max(yEnd - yStart, 0.001);
  const geo = new THREE.BoxGeometry(segLen, segH, WALL_THICKNESS);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const mesh = new THREE.Mesh(geo, mat);
  const midLocal = (xStart + xEnd) / 2;
  const worldX = start[0] + Math.cos(angle) * midLocal;
  const worldZ = start[1] + Math.sin(angle) * midLocal;
  mesh.position.set(worldX, (yStart + yEnd) / 2, worldZ);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallMeshes.push(mesh);
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
  wallMeshes.push(mesh); // door/window panels hide along with the walls
}

const traceMeshes = [];

function addTraceLine(p1, p2, color, y) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1[0], y, p1[1]),
    new THREE.Vector3(p2[0], y, p2[1]),
  ]);
  const mat = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  scene.add(line);
  traceMeshes.push(line);
  return line;
}

function buildWall(wall, openings) {
  addTraceLine(wall.start, wall.end, 0x6b7280, 0.08);
  const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  let freeIntervals = [[0, length]];

  const sortedOpenings = openings.slice().sort((a, b) => a.xStart - b.xStart);

  for (const o of sortedOpenings) {
    const xs = Math.max(0, o.xStart);
    const xe = Math.min(length, o.xEnd);
    if (o.yEnd < CEILING_HEIGHT) addWallBox(wall.start, wall.end, xs, xe, o.yEnd, CEILING_HEIGHT, WALL_COLOR);
    if (o.yStart > 0) addWallBox(wall.start, wall.end, xs, xe, 0, o.yStart, WALL_COLOR);
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
    if (fe - fs > 0.01) addWallBox(wall.start, wall.end, fs, fe, 0, CEILING_HEIGHT, WALL_COLOR);
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
  } else if (n.type === 'door') {
    const wall = nodes[n.wallId];
    const dir = new THREE.Vector2(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]).normalize();
    const cx = wall.start[0] + dir.x * n.position[0];
    const cz = wall.start[1] + dir.y * n.position[0];
    const half = n.width / 2;
    addTraceLine(
      [cx - dir.x * half, cz - dir.y * half],
      [cx + dir.x * half, cz + dir.y * half],
      0xd98a4a,
      0.09
    );
    if ((wallZoneCount[n.wallId] ?? 0) <= 1) {
      const div = document.createElement('div');
      div.textContent = 'Intrare';
      div.style.cssText = 'color:#fff;font:600 13px system-ui,sans-serif;background:rgba(180,60,20,0.75);padding:2px 8px;border-radius:5px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.6);';
      const label = new CSS2DObject(div);
      label.position.set(cx, 2.3, cz);
      scene.add(label);
    }
  } else if (n.type === 'zone') {
    const color = n.floor?.finish?.properties?.color ?? '#999999';
    const isWood = n.floor?.finish?.preset === 'wood';
    addFlatPolygon(n.polygon, 0.06, new THREE.Color(color), { map: isWood ? plankTexture : null, roughness: isWood ? 0.45 : 0.7 });
    if (n.name) {
      const cx = n.seed ? n.seed[0] : (n.polygon.reduce((s, p) => s + p[0], 0) / n.polygon.length);
      const cz = n.seed ? n.seed[1] : (n.polygon.reduce((s, p) => s + p[1], 0) / n.polygon.length);
      const div = document.createElement('div');
      div.style.cssText = 'color:#fff;font:600 13px system-ui,sans-serif;background:rgba(10,12,16,0.55);padding:2px 8px;border-radius:5px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.6);text-align:center;';
      const area = polygonArea(n.polygon);
      div.innerHTML = `${n.name}<br/><span style="font-size:10px;font-weight:400;opacity:0.65;">${area.toFixed(1)} m&sup2;</span>`;
      const label = new CSS2DObject(div);
      label.position.set(cx, 2.0, cz);
      scene.add(label);
    }
  } else if (n.type === 'ceiling') {
    ceilingMeshes.push(addFlatPolygon(n.polygon, CEILING_HEIGHT, new THREE.Color(0xe8e4da), { roughness: 1 }));
  }
}
ceilingMeshes.forEach((m) => (m.visible = roofVisible));

// --- Furniture & fixtures parameterized by room zone (Dormitor, Baie, Bucatarie, Sufragerie) ---
function addBox(size, pos, color, opts = {}) {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const zonesByName = {};
for (const id in nodes) {
  const n = nodes[id];
  if (n.type === 'zone') {
    if (n.name) zonesByName[n.name] = n;
    zonesByName[id] = n;
  }
}

function getZoneBounds(zone) {
  if (!zone || !zone.polygon) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of zone.polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

// --- Baie: bathtub under window, wc and sink with mirror ---
{
  const b = getZoneBounds(zonesByName['Baie'] || zonesByName['zone_baie']);
  if (b) {
    const tubW = 0.70;
    const tubL = b.depth - 0.16;
    addBox([tubW, 0.45, tubL], [b.maxX - tubW / 2, 0.225, (b.minZ + b.maxZ) / 2], 0xeef3f5);

    // toilet against north/south wall
    const wcX = b.minX + 0.40;
    addBox([0.42, 0.42, 0.42], [wcX, 0.21, b.maxZ - 0.25], 0xffffff);
    addBox([0.32, 0.12, 0.30], [wcX, 0.46, b.maxZ - 0.10], 0xffffff);

    // sink + mirror
    const sinkX = b.minX + 0.40;
    addBox([0.48, 0.85, 0.42], [sinkX, 0.425, b.minZ + 0.25], 0xffffff);
    const mirrorGeo = new THREE.PlaneGeometry(0.5, 0.7);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xb9d6dc, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(sinkX, 1.5, b.minZ + 0.03);
    scene.add(mirror);
  }
}

// --- Bucătărie: fridge, dining table + chairs, kitchen counter ---
{
  const b = getZoneBounds(zonesByName['Bucătărie'] || zonesByName['Bucatarie'] || zonesByName['zone_bucatarie']);
  if (b) {
    const wx = b.minX + 0.36;
    addBox([0.65, 1.80, 0.65], [wx, 0.90, b.minZ + 0.50], 0xe9e9e9); // fridge
    addBox([0.42, 0.45, 0.42], [wx - 0.10, 0.225, b.minZ + 1.50], 0x6b4a33); // chair
    addBox([0.65, 0.75, 0.85], [wx + 0.05, 0.375, b.minZ + 2.20], 0xc9a876); // table
    addBox([0.42, 0.45, 0.42], [wx - 0.10, 0.225, b.minZ + 2.90], 0x6b4a33); // chair

    // kitchen counter along east wall
    addBox([0.55, 0.85, 2.00], [b.maxX - 0.30, 0.425, b.minZ + 1.70], 0xd0d5dd);
  }
}

// --- Sufragerie: TV on west wall (indicated by user), sofa on opposing east wall ---
{
  const b = getZoneBounds(zonesByName['Sufragerie'] || zonesByName['zone_sufragerie']);
  if (b) {
    const centerZ = 10.50;

    // TV stand & TV against west wall (x = b.minX)
    addBox([0.40, 0.40, 1.60], [b.minX + 0.25, 0.20, centerZ], 0x8a6a4a); // TV stand
    addBox([0.06, 0.75, 1.40], [b.minX + 0.20, 0.75, centerZ], 0x111214); // TV screen

    // Sofa against opposing east wall (x = b.maxX)
    const sofaX = b.maxX - 0.55;
    addBox([0.90, 0.45, 2.40], [sofaX, 0.225, centerZ], 0x4a4f57); // sofa seat
    addBox([0.20, 0.45, 2.40], [b.maxX - 0.12, 0.670, centerZ], 0x4a4f57); // sofa back
    addBox([0.90, 0.30, 0.20], [sofaX, 0.50, centerZ - 1.20], 0x4a4f57); // north armrest
    addBox([0.90, 0.30, 0.20], [sofaX, 0.50, centerZ + 1.20], 0x4a4f57); // south armrest

    // Coffee table centered between TV and sofa
    const tableX = (b.minX + 0.25 + sofaX) / 2;
    addBox([0.60, 0.35, 1.00], [tableX, 0.175, centerZ], 0xa37b52);
  }
}

// --- Birou: desk in front of window with monitor, sofa on left, wardrobe on right ---
{
  const b = getZoneBounds(zonesByName['Birou'] || zonesByName['zone_birou']);
  if (b) {
    const midX = (b.minX + b.maxX) / 2;

    // Desk directly in front of the north window
    addBox([1.30, 0.75, 0.65], [midX, 0.375, b.minZ + 0.38], 0xc9a876); // desk
    addBox([0.60, 0.40, 0.05], [midX, 0.95, b.minZ + 0.15], 0x111214);  // monitor
    addBox([0.55, 0.85, 0.55], [midX, 0.425, b.minZ + 0.90], 0x2d3748); // office chair

    // Sofa on the left of the desk (against west wall)
    const sofaZ = b.minZ + 2.10;
    addBox([0.85, 0.45, 1.80], [b.minX + 0.48, 0.225, sofaZ], 0x3a4b5c); // sofa seat
    addBox([0.18, 0.45, 1.80], [b.minX + 0.14, 0.670, sofaZ], 0x3a4b5c); // sofa back
    addBox([0.85, 0.30, 0.18], [b.minX + 0.48, 0.500, sofaZ - 0.90], 0x3a4b5c); // armrest north
    addBox([0.85, 0.30, 0.18], [b.minX + 0.48, 0.500, sofaZ + 0.90], 0x3a4b5c); // armrest south

    // Wardrobe on the right of the desk (against east wall)
    const wardrobeZ = b.minZ + 1.20;
    addBox([0.60, 2.10, 1.50], [b.maxX - 0.33, 1.05, wardrobeZ], 0x6e5746); // dulap
  }
}

// --- Dormitor: double bed, nightstands, wardrobe ---
{
  const b = getZoneBounds(zonesByName['Dormitor'] || zonesByName['zone_dormitor']);
  if (b) {
    const midZ = (b.minZ + b.maxZ) / 2;
    addBox([0.10, 0.95, 1.80], [b.minX + 0.08, 0.475, midZ], 0x5a4a3a); // headboard
    addBox([2.00, 0.45, 1.60], [b.minX + 1.10, 0.225, midZ], 0xeeeae2); // bed mattress
    addBox([0.45, 0.45, 0.40], [b.minX + 0.25, 0.225, midZ - 1.15], 0x8a6a4a); // nightstand
    addBox([0.45, 0.45, 0.40], [b.minX + 0.25, 0.225, midZ + 1.15], 0x8a6a4a); // nightstand
    addBox([0.60, 2.10, 1.80], [b.maxX - 0.33, 1.05, midZ], 0x6e5746); // wardrobe
  }
}

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

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();
  const move = new THREE.Vector3();
  if (keys.w) move.add(forward);
  if (keys.s) move.sub(forward);
  if (keys.d) move.add(right);
  if (keys.a) move.sub(right);
  if (keys[' ']) move.add(up);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(FLY_SPEED * dt);
    camera.position.add(move);
    orbit.target.add(move);
  }

  orbit.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();
