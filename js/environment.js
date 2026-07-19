// Sky, sun/moon lighting, ocean, terrain, fog and the distant city.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { fbm, waterNormalsTexture, windowsTexture, fogBankTexture } from './textures.js';

const { MathUtils } = THREE;

// Shared terrain height field. Bridge runs along X; the strait is in between.
export function terrainHeight(x, z) {
  const d = Math.abs(x);
  const shore = MathUtils.smoothstep(d, 830, 1000);
  if (shore <= 0) return -28;
  const n = fbm(x * 0.0012 + 7.3, z * 0.0012 + 3.1, 4);
  const marin = x < 0 ? 1.45 : 1.0;
  const inland = Math.min((d - 830) / 500, 1);
  const decay = MathUtils.clamp(1 - (d - 2000) / 1600, 0.3, 1);
  let h = -28 + shore * (68 + 150 * inland * inland * decay * marin) * (0.55 + 0.9 * n);
  // keep a low corridor under the roadway so the approaches meet the land
  if (d > 900) {
    const cap = 34 + (d - 950) * 0.07;
    const w = MathUtils.smoothstep(Math.abs(z), 60, 170);
    h = MathUtils.lerp(Math.min(h, cap), h, w);
  }
  return Math.min(h, 310);
}

export function buildEnvironment(scene, renderer) {
  const state = { hours: 10.5, fogS: 0.12, dayF: 1, nightF: 0, lightsF: 0 };

  // --- sky + lights ---------------------------------------------------------
  const sky = new Sky();
  sky.scale.setScalar(30000);
  scene.add(sky);
  const skyU = sky.material.uniforms;

  const sunDir = new THREE.Vector3(0, 1, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -1350; sc.right = 1350; sc.top = 420; sc.bottom = -120;
  sc.near = 1; sc.far = 5000;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 1.5;
  sun.target.position.set(0, 60, 0);
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight(0x93a8c8, 0);
  moon.position.set(-1400, 1200, -900);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xbfd7e8, 0x46503e, 0.4);
  scene.add(hemi);

  // env-map from the sky for PBR reflections (regenerated as the sun moves)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sceneEnv = new THREE.Scene();
  let envRT = null, lastEnvHours = -99;
  function updateEnvMap() {
    sceneEnv.add(sky);
    const rt = pmrem.fromScene(sceneEnv);
    scene.add(sky);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.25;
  }

  // --- ocean ---------------------------------------------------------------
  const water = new Water(new THREE.PlaneGeometry(30000, 30000), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: waterNormalsTexture(),
    sunDirection: sunDir.clone(),
    sunColor: 0xffffff,
    waterColor: 0x08343a,
    distortionScale: 3.0,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  const waterU = water.material.uniforms;
  waterU.size.value = 3;
  waterU.distortionScale.value = 2.2;

  // --- terrain -------------------------------------------------------------
  {
    const geo = new THREE.PlaneGeometry(14000, 14000, 200, 200);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    const sand = new THREE.Color(0x83755a);
    const grass = new THREE.Color(0x44562f);
    const golden = new THREE.Color(0x7d6f3e);
    const rock = new THREE.Color(0x635e55);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
      if (h < 2) col.copy(sand);
      else col.copy(grass).lerp(golden, fbm(x * 0.004, z * 0.004, 3));
      const ny = nor.getY(i);
      if (ny < 0.66) col.lerp(rock, MathUtils.clamp((0.66 - ny) / 0.25, 0, 1));
      const shade = 0.8 + 0.28 * fbm(x * 0.02 + 3, z * 0.02, 2);
      colors[i * 3] = col.r * shade;
      colors[i * 3 + 1] = col.g * shade;
      colors[i * 3 + 2] = col.b * shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);
  }

  // --- distant city skyline -------------------------------------------------
  const skylineMat = new THREE.MeshStandardMaterial({
    color: 0x39404b,
    emissiveMap: windowsTexture(),
    emissive: 0xffc37e,
    emissiveIntensity: 0,
    roughness: 0.9,
  });
  {
    const cityGroup = new THREE.Group();
    let seed = 4242;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 55; i++) {
      const gx = 2450 + rand() * 1400;
      const gz = -1700 - rand() * 1500;
      const w = 30 + rand() * 55;
      const dgz = 30 + rand() * 55;
      const h = 50 + rand() * rand() * 240;
      const base = terrainHeight(gx, gz) - 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dgz), skylineMat);
      b.position.set(gx, base + h / 2, gz);
      cityGroup.add(b);
    }
    scene.add(cityGroup);
  }

  // --- stars ---------------------------------------------------------------
  const starsMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 22, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false, vertexColors: true,
  });
  const stars = (() => {
    const N = 2400, posArr = new Float32Array(N * 3), colArr = new Float32Array(N * 3);
    let seed = 777;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      v.set(rand() * 2 - 1, rand() * 0.95 + 0.05, rand() * 2 - 1).normalize().multiplyScalar(13500);
      posArr.set([v.x, v.y, v.z], i * 3);
      const b = 0.35 + rand() * 0.65;
      const warm = rand() < 0.2;
      colArr.set([b, b * (warm ? 0.85 : 0.95), b * (warm ? 0.7 : 1)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const p = new THREE.Points(g, starsMat);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  })();

  // --- fog ------------------------------------------------------------------
  scene.fog = new THREE.FogExp2(0xcfd8dd, 0.00007);

  // whiteout dome so heavy fog also swallows the sky shader
  const fogDome = new THREE.Mesh(
    new THREE.SphereGeometry(9200, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xcfd8dd, side: THREE.BackSide, transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    })
  );
  fogDome.renderOrder = 2;
  scene.add(fogDome);

  // drifting low fog banks
  const bankTex = fogBankTexture();
  const banks = [];
  {
    let seed = 999;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 8; i++) {
      const m = new THREE.SpriteMaterial({
        map: bankTex, color: 0xffffff, transparent: true,
        opacity: 0, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(1400 + rand() * 900, 200 + rand() * 120, 1);
      s.position.set(-650 + rand() * 1300, 55 + rand() * 60, -900 + rand() * 1800);
      s.userData.speed = 6 + rand() * 8;
      s.userData.fade = 0.55 + rand() * 0.45;
      scene.add(s);
      banks.push(s);
    }
  }

  // --- atmosphere state machine --------------------------------------------
  const fogColor = new THREE.Color();
  const dayFog = new THREE.Color(0xcdd6dd);
  const nightFog = new THREE.Color(0x10141c);
  const duskFog = new THREE.Color(0xe0b98e);
  const sunWarm = new THREE.Color(0xffd2a0);
  const sunWhite = new THREE.Color(0xfff4e6);
  const waterDay = new THREE.Color(0x07333a);
  const waterNight = new THREE.Color(0x04121c);

  function apply() {
    const { hours, fogS } = state;
    const elev = Math.sin(((hours - 6) / 12) * Math.PI) * 62;
    const az = 180 + (hours - 12) * 15;
    const phi = MathUtils.degToRad(90 - elev);
    const theta = MathUtils.degToRad(az);
    sunDir.setFromSphericalCoords(1, phi, theta);

    const dayF = MathUtils.smoothstep(elev, -3, 14);
    const nightF = 1 - MathUtils.smoothstep(elev, -14, -1);
    const lightsF = 1 - MathUtils.smoothstep(elev, -4, 7);
    const glow = elev > -6 ? Math.exp(-((elev - 3) ** 2) / 70) : 0;
    state.dayF = dayF; state.nightF = nightF; state.lightsF = lightsF; state.elev = elev;

    skyU.sunPosition.value.copy(sunDir);
    skyU.turbidity.value = 5 + fogS * 10;
    skyU.rayleigh.value = 1.5 + glow * 0.9;
    skyU.mieCoefficient.value = 0.004 + glow * 0.022;
    skyU.mieDirectionalG.value = 0.82;

    sun.position.copy(sunDir).multiplyScalar(2200).add(sun.target.position);
    sun.intensity = 3.2 * dayF * (1 - fogS * 0.55);
    sun.color.copy(sunWarm).lerp(sunWhite, MathUtils.clamp(elev / 32, 0, 1));
    moon.intensity = 0.5 * nightF;
    hemi.intensity = 0.03 + 0.17 * dayF;
    renderer.toneMappingExposure = 0.42 + 0.2 * dayF - fogS * 0.07;

    fogColor.copy(nightFog).lerp(dayFog, dayF).lerp(duskFog, glow * 0.55);
    scene.fog.color.copy(fogColor);
    scene.fog.density = 0.00006 + Math.pow(fogS, 1.7) * 0.0038;
    fogDome.material.color.copy(fogColor);
    fogDome.material.opacity = MathUtils.smoothstep(fogS, 0.25, 1) * 0.96;

    waterU.sunDirection.value.copy(sunDir);
    waterU.waterColor.value.copy(waterNight).lerp(waterDay, dayF);

    starsMat.opacity = nightF * Math.max(0, 1 - fogS * 1.6);
    skylineMat.emissiveIntensity = lightsF * 2.2;

    if (Math.abs(hours - lastEnvHours) > 0.33) {
      lastEnvHours = hours;
      updateEnvMap();
    }
  }

  function setTime(hours) { state.hours = hours; apply(); }
  function setFog(s) { state.fogS = s; apply(); }

  function update(dt, camera, elapsed) {
    waterU.time.value += dt * 0.55;
    fogDome.position.copy(camera.position);
    stars.rotation.y += dt * 0.004;
    const bankTarget = state.fogS > 0.12 ? Math.min((state.fogS - 0.12) * 1.3, 1) * 0.42 : 0;
    for (const b of banks) {
      b.position.z += b.userData.speed * dt;
      if (b.position.z > 950) b.position.z = -950;
      b.material.opacity += (bankTarget * b.userData.fade - b.material.opacity) * Math.min(dt * 2, 1);
      b.material.color.copy(fogColor).multiplyScalar(1.06);
    }
  }

  apply();
  return { state, setTime, setFog, update, terrainHeight, sun };
}
