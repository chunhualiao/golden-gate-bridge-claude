// Procedural Golden Gate Bridge at true scale (meters).
import * as THREE from 'three';
import { roadTexture, concreteTexture, glowTexture } from './textures.js';

export const DECK_Y = 67;        // roadway surface above water
export const TOWER_X = 640;      // towers at +/- half the 1280 m main span
export const TOWER_TOP = 227;
export const DECK_HALF_LEN = 1340;
export const DECK_HALF_W = 13.7;
export const CABLE_Z = 12.9;
export const TRUSS_BOT = 59.6;

const STEP = 15.24;              // suspender / truss panel spacing (50 ft)
const CABLE_END_X = 995, CABLE_END_Y = 74;

// Height of the main cable above water at longitudinal position x.
export function cableHeight(x) {
  const ax = Math.abs(x);
  if (ax <= TOWER_X) return 72 + 155 * (x / TOWER_X) ** 2;
  const t = Math.min((ax - TOWER_X) / (CABLE_END_X - TOWER_X), 1);
  return (1 - t) ** 2 * TOWER_TOP + 2 * (1 - t) * t * 148 + t * t * CABLE_END_Y;
}

const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const ZAXIS = new THREE.Vector3(0, 0, 1);

function composed(px, py, pz, sx = 1, sy = 1, sz = 1, rotZ = 0) {
  tmpPos.set(px, py, pz);
  tmpQuat.setFromAxisAngle(ZAXIS, rotZ);
  tmpScale.set(sx, sy, sz);
  return new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
}

function instanced(geom, mat, matrices, shadows = true) {
  const mesh = new THREE.InstancedMesh(geom, mat, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = mesh.receiveShadow = shadows;
  return mesh;
}

export function buildBridge(terrainHeight) {
  const group = new THREE.Group();

  // International Orange; warm emissive simulates the night floodlighting
  const steel = new THREE.MeshStandardMaterial({
    color: 0xc0362c, roughness: 0.52, metalness: 0.28,
    emissive: 0xff8c38, emissiveIntensity: 0,
  });
  const steelDark = new THREE.MeshStandardMaterial({
    color: 0xa72e26, roughness: 0.6, metalness: 0.3,
    emissive: 0xff8c38, emissiveIntensity: 0,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0xb5342a, roughness: 0.48, metalness: 0.35,
    emissive: 0xff8c38, emissiveIntensity: 0,
  });
  const concrete = new THREE.MeshStandardMaterial({
    map: concreteTexture(), color: 0xb6b2a6, roughness: 0.95, metalness: 0.0,
    emissive: 0xffa050, emissiveIntensity: 0,
  });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const addBox = (mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(unitBox, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // --- towers -------------------------------------------------------------
  for (const side of [-1, 1]) {
    const tx = side * TOWER_X;

    // concrete pier at the waterline
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 20, 28), concrete);
    pier.position.set(tx, 3, 0);
    pier.scale.set(27, 1, 19);
    pier.castShadow = pier.receiveShadow = true;
    group.add(pier);

    // legs: stepped Art Deco sections [yBot, yTop, xWidth, zWidth]
    const sections = [
      [12, DECK_Y, 13, 11],
      [DECK_Y, 120, 10.5, 9.5],
      [120, 165, 9.5, 8.5],
      [165, 205, 8.5, 7.5],
      [205, TOWER_TOP, 7.5, 7],
    ];
    for (const zSide of [-1, 1]) {
      for (const [yb, yt, xw, zw] of sections) {
        addBox(steel, tx, (yb + yt) / 2, zSide * CABLE_Z, xw, yt - yb, zw);
      }
      // cable saddle housing on each leg top
      addBox(steelDark, tx, TOWER_TOP + 1.6, zSide * CABLE_Z, 5, 3.2, 5.6);
    }

    // portal struts between the legs (stepped fascia = two nested boxes)
    const struts = [[34, 10], [56, 9], [90, 13], [134, 12], [176, 11], [214, 12]];
    for (const [cy, hh] of struts) {
      const sec = sections.find(([yb, yt]) => cy >= yb && cy <= yt) || sections[0];
      const xw = sec[2];
      addBox(steel, tx, cy, 0, xw * 0.82, hh, CABLE_Z * 2);
      addBox(steelDark, tx, cy, 0, xw * 0.5, hh + 4, CABLE_Z * 2 + 0.6);
    }
  }

  // --- main cables ----------------------------------------------------------
  for (const zSide of [-1, 1]) {
    const pts = [];
    for (let x = -CABLE_END_X; x <= CABLE_END_X; x += 8) {
      pts.push(new THREE.Vector3(x, cableHeight(x), zSide * CABLE_Z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 420, 0.55, 10), cableMat);
    tube.castShadow = true;
    group.add(tube);
  }

  // --- suspender ropes ------------------------------------------------------
  {
    const mats = [];
    for (let x = -960; x <= 960; x += STEP) {
      if (Math.abs(Math.abs(x) - TOWER_X) < 10) continue;
      const len = cableHeight(x) - (DECK_Y + 0.3);
      if (len < 2) continue;
      for (const zSide of [-1, 1]) {
        mats.push(composed(x, DECK_Y + 0.3 + len / 2, zSide * CABLE_Z, 1, len, 1));
      }
    }
    const geom = new THREE.CylinderGeometry(0.28, 0.28, 1, 6);
    group.add(instanced(geom, cableMat, mats));
  }

  // --- deck -----------------------------------------------------------------
  const L = DECK_HALF_LEN * 2;

  // slab
  addBox(steelDark, 0, 66.35, 0, L, 1.3, DECK_HALF_W * 2);

  // road surface
  const roadTex = roadTexture();
  roadTex.repeat.set(L / 12, 1);
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex, roughness: 0.92, metalness: 0,
    emissive: 0xffb861, emissiveIntensity: 0,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, 22), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = DECK_Y + 0.02;
  road.receiveShadow = true;
  group.add(road);

  // walkways
  for (const zSide of [-1, 1]) {
    addBox(concrete, 0, DECK_Y + 0.12, zSide * 12.35, L, 0.35, 2.7);
  }

  // railings: posts + rails
  {
    const postMats = [];
    for (let x = -DECK_HALF_LEN; x <= DECK_HALF_LEN; x += 4) {
      for (const zSide of [-1, 1]) postMats.push(composed(x, 67.95, zSide * 13.55, 1, 1, 1));
    }
    group.add(instanced(new THREE.BoxGeometry(0.1, 1.3, 0.1), steel, postMats, false));
    for (const zSide of [-1, 1]) {
      addBox(steel, 0, 68.55, zSide * 13.55, L, 0.09, 0.09);
      addBox(steel, 0, 68.15, zSide * 13.55, L, 0.07, 0.07);
    }
  }

  // --- stiffening truss -----------------------------------------------------
  {
    // chords
    for (const zSide of [-1, 1]) {
      addBox(steel, 0, TRUSS_BOT + 0.3, zSide * 13.4, L, 0.9, 0.9);
      addBox(steel, 0, 66.0, zSide * 13.4, L, 0.9, 0.9);
    }
    const vertMats = [], diagMats = [], beamMats = [];
    const dy = 66.0 - (TRUSS_BOT + 0.3);
    const diagLen = Math.hypot(STEP, dy);
    const ang = Math.atan2(dy, STEP);
    let i = 0;
    for (let x = -DECK_HALF_LEN + 4; x <= DECK_HALF_LEN - 4; x += STEP, i++) {
      beamMats.push(composed(x, TRUSS_BOT + 0.5, 0, 1, 1, 1));
      for (const zSide of [-1, 1]) {
        vertMats.push(composed(x, 62.9, zSide * 13.4, 1, 1, 1));
        if (x + STEP <= DECK_HALF_LEN - 4) {
          diagMats.push(composed(
            x + STEP / 2, 62.9, zSide * 13.4,
            diagLen, 0.5, 0.5, i % 2 ? ang : -ang
          ));
        }
      }
    }
    group.add(instanced(new THREE.BoxGeometry(0.6, 1.1, 26.6), steel, beamMats, false));
    group.add(instanced(new THREE.BoxGeometry(0.55, 6.4, 0.55), steel, vertMats, false));
    group.add(instanced(unitBox, steel, diagMats, false));
  }

  // --- anchorages + pylons --------------------------------------------------
  for (const side of [-1, 1]) {
    const ax = side * 983;
    addBox(concrete, ax, 39, 0, 76, 38, 44);
    addBox(concrete, ax, 66, 0, 54, 16, 38);
    addBox(concrete, ax + side * 6, 79, 0, 34, 10, 30);
    // pylon portal over the deck
    const px = side * 935;
    for (const zSide of [-1, 1]) {
      addBox(concrete, px, 64, zSide * 16.2, 6, 52, 5);
    }
    addBox(concrete, px, 89.5, 0, 6, 7, 37);
  }

  // --- approach viaduct bents ----------------------------------------------
  for (const side of [-1, 1]) {
    for (const bx of [1040, 1120, 1200, 1280]) {
      const x = side * bx;
      const ground = terrainHeight(x, 0);
      const h = TRUSS_BOT - ground;
      if (h < 3) continue;
      for (const zSide of [-1, 1]) {
        addBox(steel, x, ground + h / 2, zSide * 11, 2.4, h, 2.4);
      }
      addBox(steel, x, TRUSS_BOT - 1.6, 0, 1.6, 2, 23);
    }
  }

  // --- street lamps ---------------------------------------------------------
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x555555, emissive: 0xffb861, emissiveIntensity: 0.05,
  });
  const lampGlowPositions = [];
  {
    const poleMats = [], headMats = [];
    for (let x = -1300; x <= 1300; x += 65) {
      for (const zSide of [-1, 1]) {
        poleMats.push(composed(x, 70.9, zSide * 12.6, 1, 1, 1));
        headMats.push(composed(x, 74.6, zSide * 12.6, 1, 1, 1));
        lampGlowPositions.push(x, 74.6, zSide * 12.6);
      }
    }
    group.add(instanced(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 6), steel, poleMats, false));
    group.add(instanced(new THREE.SphereGeometry(0.45, 8, 6), lampMat, headMats, false));
  }
  const lampGlowMat = new THREE.PointsMaterial({
    map: glowTexture(), color: 0xffc07a, size: 10, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lampGlowPositions, 3));
    const pts = new THREE.Points(geo, lampGlowMat);
    pts.frustumCulled = false;
    group.add(pts);
  }

  // --- aviation beacons -----------------------------------------------------
  const towerBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x550000, emissive: 0xff2211, emissiveIntensity: 1,
  });
  const midBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x550000, emissive: 0xff2211, emissiveIntensity: 1,
  });
  {
    const beaconGeom = new THREE.SphereGeometry(1.0, 10, 8);
    const mats = [];
    for (const side of [-1, 1])
      for (const zSide of [-1, 1])
        mats.push(composed(side * TOWER_X, TOWER_TOP + 3.6, zSide * CABLE_Z, 1, 1, 1));
    group.add(instanced(beaconGeom, towerBeaconMat, mats, false));
    for (const zSide of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), midBeaconMat);
      b.position.set(0, 73.6, zSide * CABLE_Z);
      group.add(b);
    }
  }

  function update(elapsed, state) {
    const lights = state?.lightsF ?? 0;
    lampMat.emissiveIntensity = 0.05 + lights * 4;
    lampGlowMat.opacity = lights * 0.85;
    towerBeaconMat.emissiveIntensity = 0.6 + lights * 3;
    midBeaconMat.emissiveIntensity =
      (Math.sin(elapsed * 2.5) > 0.1 ? 4 : 0.15) * (0.3 + lights);
    // floodlighting glow
    steel.emissiveIntensity = lights * 0.22;
    steelDark.emissiveIntensity = lights * 0.18;
    cableMat.emissiveIntensity = lights * 0.22;
    concrete.emissiveIntensity = lights * 0.09;
    roadMat.emissiveIntensity = lights * 0.05;
  }

  return { group, update };
}
