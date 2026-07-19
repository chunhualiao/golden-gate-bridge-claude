// Wires the HTML control panel to the scene.
export function initUI({ env, traffic, sun, renderer }) {
  const $ = (id) => document.getElementById(id);
  const timeSlider = $('time');
  const fogSlider = $('fog');
  const timeLabel = $('time-label');
  const fogLabel = $('fog-label');

  function fmtTime(h) {
    const hh = Math.floor(h) % 24;
    const mm = Math.floor((h % 1) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function applyTime() {
    const h = parseFloat(timeSlider.value);
    env.setTime(h);
    timeLabel.textContent = fmtTime(h);
  }
  function applyFog() {
    const f = parseFloat(fogSlider.value);
    env.setFog(f);
    fogLabel.textContent = `${Math.round(f * 100)}%`;
  }

  timeSlider.addEventListener('input', applyTime);
  fogSlider.addEventListener('input', applyFog);
  // don't let a focused slider eat WASD/arrow keys afterwards
  for (const el of [timeSlider, fogSlider]) {
    el.addEventListener('pointerup', () => el.blur());
  }

  $('toggle-traffic').addEventListener('change', (e) => {
    traffic.group.visible = e.target.checked;
  });
  $('toggle-shadows').addEventListener('change', (e) => {
    sun.castShadow = e.target.checked;
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      timeSlider.value = btn.dataset.time;
      fogSlider.value = btn.dataset.fog;
      applyTime();
      applyFog();
      btn.blur();
    });
  });

  applyTime();
  applyFog();
}
