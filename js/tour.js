/*
 * 360° walk-through tours built on Pannellum (https://pannellum.org, MIT).
 *
 * A listing's tour lives in `listing.pano`:
 *   { first: 'sceneId', scenes: [{ id, room, ref, yaw, pitch, hfov, hotspots: [{ to, yaw, pitch }] }] }
 * `ref` is a photo reference resolved through Verdant.store (idb: or https:).
 * Scene order doubles as the order of the auto-playing "video" tour.
 */
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.7/';
  let loading = null;

  // Load Pannellum on demand, pinned to exact file fingerprints (Subresource Integrity).
  function load() {
    if (window.pannellum) return Promise.resolve(window.pannellum);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = CDN + 'pannellum.min.css';
      css.integrity = 'sha512-u/VRICwgDQnX/Ur1tH5doLGjzO7MjtErYqdHBTfBJ19jjIr0nXL7xoRi5fnki7xVNu62PXYYu/p51IToRK86GA==';
      css.crossOrigin = 'anonymous';
      css.referrerPolicy = 'no-referrer';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = CDN + 'pannellum.min.js';
      s.integrity = 'sha512-w1JcBp1X4hcUHeqYK60h2FrUc9pOnYQ4wthMepcuB+E1ljWOX3+5eJlbsmgECqk+tinrVcElmCiG52nV98aLcQ==';
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = () => resolve(window.pannellum);
      s.onerror = () => { loading = null; reject(new Error('The 3D viewer could not load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  const scenesOf = (pano) => (pano && Array.isArray(pano.scenes) ? pano.scenes.filter((s) => s && s.id && s.ref) : []);
  const has = (l) => scenesOf(l && l.pano).length > 0;
  const roomName = (s, i) => (s.room && s.room.trim()) || 'Room ' + (i + 1);

  const DOOR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';

  // Builds a hotspot bubble with the room name as plain text (never HTML).
  function doorTooltip(div, label) {
    div.classList.add('pn-door');
    const ring = document.createElement('span');
    ring.className = 'pn-door-ring';
    ring.innerHTML = DOOR_ICON;
    const text = document.createElement('span');
    text.className = 'pn-door-label';
    text.textContent = label;
    div.appendChild(ring);
    div.appendChild(text);
  }

  // Pannellum config for a tour. `urls` maps scene id -> resolved image URL.
  function config(pano, urls, opts) {
    const scenes = scenesOf(pano);
    const byId = Object.fromEntries(scenes.map((s, i) => [s.id, roomName(s, i)]));
    const cfg = {
      default: Object.assign({
        firstScene: opts && opts.first && byId[opts.first] ? opts.first : (byId[pano.first] ? pano.first : scenes[0].id),
        autoLoad: true,
        sceneFadeDuration: 900,
        showControls: true,
        compass: false,
        mouseZoom: 'fullscreenonly',
        hfov: 100, minHfov: 50, maxHfov: 120,
        strings: { loadingLabel: 'Loading room…', bylineLabel: '' }
      }, opts && opts.defaults),
      scenes: {}
    };
    scenes.forEach((s) => {
      cfg.scenes[s.id] = {
        type: 'equirectangular',
        panorama: urls[s.id],
        yaw: Number(s.yaw) || 0,
        pitch: Number(s.pitch) || 0,
        hfov: Number(s.hfov) || 100,
        hotSpots: (s.hotspots || []).filter((h) => byId[h.to]).map((h) => ({
          type: 'scene', sceneId: h.to,
          yaw: Number(h.yaw) || 0, pitch: Number(h.pitch) || 0,
          cssClass: 'pn-door-base',
          createTooltipFunc: doorTooltip, createTooltipArgs: byId[h.to],
          targetYaw: 'sameAzimuth'
        }))
      };
    });
    return cfg;
  }

  async function resolveUrls(pano) {
    const out = {};
    for (const s of scenesOf(pano)) out[s.id] = await V.store.resolve(s.ref);
    return out;
  }

  /* ---------- Public viewer (property page) ---------- */
  async function mount(frame, l, rail) {
    const scenes = scenesOf(l.pano);
    frame.innerHTML = '<div class="pn-stage"><p class="ex-status" style="padding:2rem;color:var(--on-dark-muted)">Loading 3D tour…</p></div>';
    let pn;
    try { pn = await load(); } catch (e) { frame.innerHTML = '<p class="ex-status" style="padding:2rem;color:var(--on-dark-muted)">The 3D tour couldn&rsquo;t load. Check your connection and try again.</p>'; return; }
    const urls = await resolveUrls(l.pano);
    const stage = document.createElement('div');
    stage.className = 'pn-stage';
    const viewerEl = document.createElement('div');
    viewerEl.className = 'pn-viewer';
    stage.appendChild(viewerEl);
    stage.insertAdjacentHTML('beforeend',
      '<p class="pn-room" data-pn-room aria-live="polite"></p>' +
      '<div class="pn-actions">' +
        '<button type="button" class="pn-btn" data-pn-play aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg><span>Play tour</span></button>' +
        '<button type="button" class="pn-btn" data-pn-gyro hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M3 9.5c-1 1.5-1 3.5 0 5M21 9.5c1 1.5 1 3.5 0 5"/></svg><span>Move phone</span></button>' +
      '</div>' +
      '<p class="pn-hint" data-pn-hint>Drag to look around &middot; tap the arrows to walk between rooms</p>');
    frame.innerHTML = '';
    frame.appendChild(stage);

    const viewer = pn.viewer(viewerEl, config(l.pano, urls));
    const roomEl = stage.querySelector('[data-pn-room]');
    const playBtn = stage.querySelector('[data-pn-play]');
    const gyroBtn = stage.querySelector('[data-pn-gyro]');
    const hint = stage.querySelector('[data-pn-hint]');
    const nameOf = (id) => { const i = scenes.findIndex((s) => s.id === id); return i < 0 ? '' : roomName(scenes[i], i); };

    if (rail) {
      rail.innerHTML = scenes.length > 1 ? scenes.map((s, i) => '<button type="button" role="tab" class="reel-room-tab" data-pn-go="' + esc(s.id) + '" aria-selected="false">' + esc(roomName(s, i)) + '</button>').join('') : '';
      rail.addEventListener('click', (e) => { const b = e.target.closest('[data-pn-go]'); if (b) { stopTour(); viewer.loadScene(b.dataset.pnGo); } });
    }
    const sync = () => {
      const id = viewer.getScene();
      roomEl.textContent = nameOf(id);
      if (rail) rail.querySelectorAll('[data-pn-go]').forEach((b) => { const on = b.dataset.pnGo === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    };
    viewer.on('load', sync);
    viewer.on('scenechange', sync);
    ['mousedown', 'touchstart'].forEach((ev) => viewer.on(ev, () => { hint.classList.add('gone'); if (playing) stopTour(); }));

    /* Auto-play: pan slowly around each room, then walk to the next — a hands-free "video" tour. */
    let playing = false, timer = null, step = 0;
    const order = scenes.map((s) => s.id);
    const DWELL = 9000;
    const next = () => {
      if (!playing) return;
      step++;
      if (step >= order.length) { stopTour(); viewer.loadScene(order[0]); return; }
      viewer.loadScene(order[step]);
      viewer.on('load', function once() { viewer.off('load', once); if (playing) { viewer.startAutoRotate(-6); timer = setTimeout(next, DWELL); } });
    };
    function startTour() {
      playing = true;
      playBtn.setAttribute('aria-pressed', 'true');
      playBtn.querySelector('span').textContent = 'Pause tour';
      hint.classList.add('gone');
      step = Math.max(0, order.indexOf(viewer.getScene()));
      // From the last room, play from the beginning instead of ending immediately.
      if (step === order.length - 1 && order.length > 1) { step = -1; next(); return; }
      viewer.startAutoRotate(-6);
      timer = setTimeout(next, DWELL);
    }
    function stopTour() {
      playing = false;
      clearTimeout(timer);
      viewer.stopAutoRotate();
      playBtn.setAttribute('aria-pressed', 'false');
      playBtn.querySelector('span').textContent = 'Play tour';
    }
    playBtn.addEventListener('click', () => (playing ? stopTour() : startTour()));
    if (scenes.length < 2) playBtn.querySelector('span').textContent = 'Auto-rotate';

    if (window.matchMedia('(pointer: coarse)').matches && typeof viewer.isOrientationSupported === 'function') {
      setTimeout(() => { if (viewer.isOrientationSupported()) gyroBtn.hidden = false; }, 1200);
      let gyro = false;
      gyroBtn.addEventListener('click', () => {
        gyro = !gyro;
        if (gyro) viewer.startOrientation(); else viewer.stopOrientation();
        gyroBtn.classList.toggle('on', gyro);
      });
    }
    return viewer;
  }

  window.VerdantTour = { load, config, mount, has, scenesOf, roomName, resolveUrls };
})();
