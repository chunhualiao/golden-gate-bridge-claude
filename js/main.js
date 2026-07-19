import * as THREE from 'three';
import { buildEnvironment, terrainHeight } from './environment.js';
import { buildBridge } from './bridge.js';
import { createTraffic } from './traffic.js';
import { createFlyControls } from './controls.js';
import { initUI } from './ui.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.5, 40000
);
camera.position.set(-1150, 230, 620);
camera.lookAt(150, 90, -60);

const env = buildEnvironment(scene, renderer);
const bridge = buildBridge(terrainHeight);
scene.add(bridge.group);
const traffic = createTraffic();
scene.add(traffic.group);

const splash = document.getElementById('splash');
const controls = createFlyControls(camera, renderer.domElement, (active) => {
  splash.classList.toggle('hidden', active);
});

initUI({ env, traffic, sun: env.sun, renderer });

const fpsEl = document.getElementById('fps');
const speedEl = document.getElementById('speed');
let fpsFrames = 0, fpsTime = 0;

const clock = new THREE.Clock();
let elapsed = 0;

function tick(dtOverride) {
  const dt = dtOverride ?? Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  controls.update(dt);
  env.update(dt, camera, elapsed);
  bridge.update(elapsed, env.state);
  traffic.update(dt);
  renderer.render(scene, camera);

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} fps`;
    speedEl.textContent = `${Math.round(controls.speed)} m/s`;
    fpsFrames = 0;
    fpsTime = 0;
  }
}

renderer.setAnimationLoop(() => tick());

// debug handle
window.GG = { renderer, scene, camera, env, controls, step: (dt) => tick(dt) };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
