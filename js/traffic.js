// Instanced cars looping across the deck (3 lanes each direction).
import * as THREE from 'three';
import { DECK_HALF_LEN } from './bridge.js';

const LANES = [
  { z: -8.85, dir: 1 }, { z: -5.35, dir: 1 }, { z: -1.85, dir: 1 },
  { z: 1.85, dir: -1 }, { z: 5.35, dir: -1 }, { z: 8.85, dir: -1 },
];
const COUNT = 46;
const WRAP = DECK_HALF_LEN - 30;

export function createTraffic() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.2, metalness: 0.4 });
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 1.3, 1.9), bodyMat, COUNT);
  const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.75, 1.7), cabinMat, COUNT);
  body.castShadow = cabin.castShadow = true;
  group.add(body, cabin);

  let seed = 2024;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cars = [];
  const color = new THREE.Color();
  const palette = [0xb8bcc2, 0x2b2f36, 0x8a1f1f, 0x1f3a63, 0xc7c3b4, 0x3d4a3a, 0x6b6f76];
  for (let i = 0; i < COUNT; i++) {
    const lane = LANES[i % LANES.length];
    cars.push({
      lane,
      x: -WRAP + rand() * WRAP * 2,
      speed: (17 + rand() * 9) * lane.dir,
    });
    color.setHex(palette[Math.floor(rand() * palette.length)]);
    color.offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    body.setColorAt(i, color);
  }
  body.instanceColor.needsUpdate = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();

  function update(dt) {
    if (!group.visible) return;
    for (let i = 0; i < COUNT; i++) {
      const car = cars[i];
      car.x += car.speed * dt;
      if (car.x > WRAP) car.x = -WRAP;
      if (car.x < -WRAP) car.x = WRAP;
      const rot = car.lane.dir < 0 ? flip : q.identity();
      p.set(car.x, 67.72, car.lane.z);
      body.setMatrixAt(i, m.compose(p, rot, s));
      p.y += 1.0;
      p.x -= 0.35 * car.lane.dir;
      cabin.setMatrixAt(i, m.compose(p, rot, s));
    }
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
  }

  return { group, update };
}
