/*
 * Floor plans drawn from structured data, so rooms can link to their photos and 3D tour.
 *
 * listing.plan = {
 *   illustrative: true,            // true when the layout is inferred, not measured
 *   w, h,                          // plan extent in feet (or arbitrary units when illustrative)
 *   rooms:   [{ id, label, x, y, w, h, photos: 'Photo room label', scene: 'Tour room name', outdoor }],
 *   doors:   [{ x, y, len, dir: 'h'|'v', kind: 'door'|'opening'|'exterior' }],
 *   windows: [{ x, y, len, dir }],
 *   fixtures:[{ type: 'fireplace'|'counter'|'closet', x, y, w, h }]
 * }
 */
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;
  const PAD = 3;

  // 12.5 -> 12'6"
  const ft = (v) => { const f = Math.floor(v + 1e-6), i = Math.round((v - f) * 12); return i === 12 ? (f + 1) + "'" : f + "'" + (i ? i + '"' : ''); };

  // Bounding box of everything drawn (door swings included), so the public view can crop to it.
  function bounds(plan) {
    const xs = [], ys = [];
    const add = (x, y) => { xs.push(x); ys.push(y); };
    plan.rooms.concat(plan.fixtures || []).forEach((o) => { add(o.x, o.y); add(o.x + o.w, o.y + o.h); });
    (plan.doors || []).concat(plan.windows || []).forEach((o) => { add(o.x - (o.len || 0), o.y - (o.len || 0)); add(o.x + (o.len || 0), o.y + (o.len || 0)); });
    if (!xs.length) return null;
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  // opts.fit crops to the drawing (public page); the editor keeps the full plan area.
  function svg(plan, opts) {
    const b = opts && opts.fit ? bounds(plan) : null;
    const ox = b ? b.x0 : 0, oy = b ? b.y1 : plan.h;
    const W = (b ? b.x1 - b.x0 : plan.w) + PAD * 2, H = (b ? b.y1 - b.y0 : plan.h) + PAD * 2;
    const X = (x) => x - ox + PAD;
    const Y = (y) => oy - y + PAD; // plan y grows "up" (toward the back of the home)
    const rect = (r, cls, extra) => '<rect class="' + cls + '" x="' + X(r.x) + '" y="' + Y(r.y + r.h) + '" width="' + r.w + '" height="' + r.h + '"' + (extra || '') + '/>';
    let out = '<svg class="fp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Floor plan"><defs>' +
      '<pattern id="fp-deck" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><path d="M0 0H1.2" stroke="currentColor" stroke-width=".08"/></pattern></defs>';
    plan.rooms.filter((r) => r.outdoor).forEach((r) => { out += rect(r, 'fp-out', ' fill="url(#fp-deck)"'); });
    plan.rooms.filter((r) => !r.outdoor).forEach((r) => { out += rect(r, 'fp-floor'); });
    (plan.fixtures || []).forEach((f) => {
      if (f.type === 'counter') out += rect(f, 'fp-counter');
      if (f.type === 'closet') out += rect(f, 'fp-closet');
      if (f.type === 'fireplace') out += rect(f, 'fp-fire') + '<path class="fp-fire-mark" d="M' + (X(f.x) + f.w * 0.25) + ' ' + Y(f.y + f.h * 0.2) + 'l' + f.w * 0.25 + ' -' + f.h * 0.6 + 'l' + f.w * 0.25 + ' ' + f.h * 0.6 + '"/>';
    });
    // Walls: outline every indoor room; shared walls overlap into one line.
    plan.rooms.filter((r) => !r.outdoor).forEach((r) => { out += rect(r, 'fp-wall'); });
    // Openings and doors are painted over the walls in the floor color.
    (plan.doors || []).forEach((d) => {
      const x = X(d.x), y = Y(d.y);
      const gap = d.dir === 'h' ? '<line class="fp-gap" x1="' + x + '" y1="' + y + '" x2="' + (x + d.len) + '" y2="' + y + '"/>' : '<line class="fp-gap" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - d.len) + '"/>';
      out += gap;
      if (d.kind !== 'opening') {
        const swing = d.dir === 'h'
          ? '<path class="fp-swing' + (d.kind === 'exterior' ? ' is-ext' : '') + '" d="M' + x + ' ' + y + 'v' + (-(d.flip ? -1 : 1) * d.len) + 'A' + d.len + ' ' + d.len + ' 0 0 ' + (d.flip ? 0 : 1) + ' ' + (x + d.len) + ' ' + y + '"/>'
          : '<path class="fp-swing' + (d.kind === 'exterior' ? ' is-ext' : '') + '" d="M' + x + ' ' + y + 'h' + ((d.flip ? -1 : 1) * d.len) + 'A' + d.len + ' ' + d.len + ' 0 0 ' + (d.flip ? 1 : 0) + ' ' + x + ' ' + (y - d.len) + '"/>';
        out += swing;
      }
    });
    (plan.windows || []).forEach((w) => {
      const x = X(w.x), y = Y(w.y);
      out += w.dir === 'h'
        ? '<line class="fp-win" x1="' + x + '" y1="' + y + '" x2="' + (x + w.len) + '" y2="' + y + '"/>'
        : '<line class="fp-win" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - w.len) + '"/>';
    });
    // Interactive room hit areas + labels on top.
    plan.rooms.forEach((r) => {
      const cx = X(r.x + r.w / 2), cy = Y(r.y + r.h / 2);
      const size = Math.max(0.9, Math.min(1.5, Math.min(r.w, r.h) / 6));
      out += '<g class="fp-room' + (r.photos || r.scene ? ' is-link' : '') + '" data-room="' + esc(r.id) + '" tabindex="' + (r.photos || r.scene ? 0 : -1) + '" role="' + (r.photos || r.scene ? 'button' : 'presentation') + '" aria-label="' + esc(r.label) + '">' +
        rect(r, 'fp-hit') +
        '<text class="fp-label" x="' + cx + '" y="' + cy + '" font-size="' + size + '">' + esc(r.label) + '</text>' +
        (!plan.illustrative && !r.outdoor && r.label ? '<text class="fp-dim" x="' + cx + '" y="' + (cy + size * 1.3) + '" font-size="' + size * 0.72 + '">' + ft(r.w) + ' &times; ' + ft(r.h) + '</text>' : '') + '</g>';
    });
    return out + '</svg>';
  }

  // Section on the property page. `actions` = { photos(roomLabel), tour(sceneName) }.
  async function mount(section, l, actions) {
    const plan = l.plan;
    if (plan.image) {
      const src = await V.store.resolve(plan.image);
      section.innerHTML = '<h2>Floor <em style="color:var(--forest)">plan</em></h2><div class="fp-canvas fp-canvas--img reveal is-in"><img src="' + esc(src) + '" alt="Floor plan of ' + esc(l.address) + '" loading="lazy"></div>' +
        (plan.illustrative ? '<p class="fp-note mt-1"><b>Not to scale.</b> Please verify dimensions in person.</p>' : '');
      return;
    }
    section.innerHTML = '<h2>Floor <em style="color:var(--forest)">plan</em></h2>' +
      '<div class="fp reveal is-in">' +
        '<div class="fp-canvas">' + svg(plan, { fit: true }) + '</div>' +
        '<div class="fp-side">' +
          '<p class="fp-hint">Tap a room to see its photos' + (V.fmt && l.pano ? ' or step inside it in 3D' : '') + '.</p>' +
          '<div class="fp-pick" data-fp-pick hidden><p class="fp-pick-t" data-fp-name></p><div class="row"><button type="button" class="btn btn--sm" data-fp-photos>View photos</button><button type="button" class="btn btn--ghost btn--sm" data-fp-tour>Step inside in 3D</button></div></div>' +
          (plan.illustrative ? '<p class="fp-note"><b>Illustrative layout, not to scale.</b> Drawn from the listing photos and 3D tour to show how the rooms connect. Room sizes and wall positions are approximate; the home is about ' + V.fmt.num(l.sqft) + ' sq ft. Please verify dimensions in person.</p>' : '') +
        '</div>' +
      '</div>';
    const pick = section.querySelector('[data-fp-pick]');
    const nameEl = section.querySelector('[data-fp-name]');
    const bPhotos = section.querySelector('[data-fp-photos]');
    const bTour = section.querySelector('[data-fp-tour]');
    let current = null;
    const choose = (g) => {
      const r = plan.rooms.find((x) => x.id === g.dataset.room);
      if (!r || !(r.photos || r.scene)) return;
      current = r;
      section.querySelectorAll('.fp-room').forEach((x) => x.classList.toggle('on', x === g));
      nameEl.textContent = r.label;
      bPhotos.hidden = !(r.photos && actions.hasPhotos(r.photos));
      bTour.hidden = !(r.scene && actions.hasScene(r.scene));
      pick.hidden = false;
    };
    section.querySelectorAll('.fp-room.is-link').forEach((g) => {
      g.addEventListener('click', () => choose(g));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(g); } });
    });
    bPhotos.addEventListener('click', () => current && actions.photos(current.photos));
    bTour.addEventListener('click', () => current && actions.tour(current.scene));
  }

  window.VerdantPlan = { svg, mount, ft };
})();
