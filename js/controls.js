// Free-fly camera: pointer-lock mouse look (with drag fallback) + WASD keys.
import * as THREE from 'three';

export function createFlyControls(camera, dom, onActiveChange) {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  euler.setFromQuaternion(camera.quaternion);
  const keys = new Set();
  const vel = new THREE.Vector3();
  let speed = 70;
  let locked = false;
  let dragging = false;

  const notify = () => onActiveChange?.(locked || dragging);

  function look(dx, dy) {
    euler.y -= dx * 0.0021;
    euler.x = THREE.MathUtils.clamp(euler.x - dy * 0.0021, -1.55, 1.55);
    camera.quaternion.setFromEuler(euler);
  }

  dom.addEventListener('click', () => {
    if (!locked) dom.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === dom;
    notify();
  });
  document.addEventListener('pointerlockerror', () => { locked = false; notify(); });

  document.addEventListener('mousemove', (e) => {
    if (locked || dragging) look(e.movementX, e.movementY);
  });
  dom.addEventListener('mousedown', () => {
    if (!locked) { dragging = true; notify(); }
  });
  window.addEventListener('mouseup', () => { dragging = false; notify(); });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    speed = THREE.MathUtils.clamp(speed * (e.deltaY > 0 ? 0.88 : 1.14), 4, 1500);
  }, { passive: false });

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();

  function update(dt) {
    wish.set(0, 0, 0);
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);
    if (keys.has('Space') || keys.has('KeyE')) wish.y += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ')) wish.y -= 1;
    const boost = keys.has('ControlLeft') || keys.has('KeyF') ? 3.2 : 1;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed * boost);
    vel.lerp(wish, 1 - Math.exp(-dt * 4.5));
    camera.position.addScaledVector(vel, dt);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.5, 4500);
  }

  return { update, get speed() { return speed; } };
}
