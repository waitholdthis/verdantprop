// Residences page — filtering, sorting, saved homes, grid/map views, URL-synced state
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const V = window.Verdant;
    const grid = document.querySelector('[data-listings]');
    const form = document.querySelector('[data-filters]');
    const count = document.querySelector('[data-count]');
    const savedCount = document.querySelector('[data-saved-count]');
    const wrap = document.querySelector('[data-lwrap]');
    const mapWrap = wrap && wrap.querySelector('.lmap-wrap');
    if (!grid || !form || !V) return;

    const all = await V.store.all();

    /* BAH match */
    const bahBar = document.querySelector('[data-bah-bar]');
    const bahOnlyEl = bahBar && bahBar.querySelector('[data-bah-only]');
    const bahNote = bahBar && bahBar.querySelector('[data-bah-note]');
    const syncBahNote = () => {
      if (!bahBar) return;
      const v = V.bah.get();
      bahOnlyEl.disabled = !v;
      if (!v) bahOnlyEl.checked = false;
      bahNote.innerHTML = v ? 'Your ' + V.bah.YEAR + ' BAH at Fort Bragg: <b>' + V.fmt.money(V.bah.rate()) + '/mo</b> (' + v.grade + (v.deps ? ', with dependents' : ', without dependents') + '). BAH is meant to cover rent <em>and</em> utilities.' : 'Choose your pay grade to see how every home compares. Nothing is sent anywhere; it stays on this device.';
    };
    if (bahBar && V.bah) {
      bahBar.querySelector('[data-bah-controls]').innerHTML = V.bah.picker('bah-list');
      V.bah.bind(bahBar);
      bahOnlyEl.addEventListener('change', () => render());
      document.addEventListener('verdant:bah', () => { syncBahNote(); render(); });
      syncBahNote();
    }
    const params = new URLSearchParams(location.search);
    [...form.elements].forEach((el) => {
      if (!el.name || !params.has(el.name)) return;
      if (el.type === 'checkbox') el.checked = params.get(el.name) === '1';
      else el.value = params.get(el.name);
    });
    let view = params.get('view') === 'map' ? 'map' : 'grid';
    let current = [];

    /* ---------- Map view ---------- */
    let L, map, pinLayer;
    const coords = new Map();
    let mapReady = null;
    const ensureMap = () => mapReady || (mapReady = (async () => {
      try { L = await V.geo.loadLeaflet(); } catch (e) { mapWrap.innerHTML = '<p class="ex-status" style="padding:2rem">The map couldn&rsquo;t load.</p>'; return false; }
      map = L.map(wrap.querySelector('[data-lmap]'), { scrollWheelZoom: true }).setView([35.0527, -78.8784], 12);
      V.geo.tiles(L).addTo(map);
      pinLayer = L.layerGroup().addTo(map);
      return true;
    })());
    const drawMap = async () => {
      if (view !== 'map' || !(await ensureMap())) return;
      setTimeout(() => map.invalidateSize(), 50);
      for (const l of current) if (!coords.has(l.id)) coords.set(l.id, await V.geo.locate(l).catch(() => null));
      // Group homes at (nearly) the same spot, e.g. units in one building.
      const groups = [];
      current.forEach((l) => {
        const c = coords.get(l.id);
        if (!c) return;
        const g = groups.find((x) => V.geo.miles(x.c, c) < 0.04);
        if (g) g.items.push(l); else groups.push({ c, items: [l] });
      });
      pinLayer.clearLayers();
      groups.forEach((g) => {
        const low = Math.min(...g.items.map((l) => l.price || Infinity));
        const label = (isFinite(low) ? V.fmt.money(low) : 'Call') + (g.items.length > 1 ? '+ &middot; ' + g.items.length + ' homes' : '');
        const icon = L.divIcon({ className: 'ppin', html: '<span>' + label + '</span>', iconSize: null, iconAnchor: [0, 0] });
        const popup = '<div class="ppop">' + g.items.map((l) =>
          '<a href="property.html?id=' + encodeURIComponent(l.id) + '"><strong>' + V.esc(V.fmt.price(l)) + (l.price ? V.fmt.per(l) : '') + '</strong><span>' + V.esc(l.address) + '</span><small>' + V.fmt.num(l.beds) + ' bd &middot; ' + V.fmt.num(l.baths) + ' ba &middot; ' + V.fmt.num(l.sqft) + ' sq ft</small></a>'
        ).join('') + '</div>';
        L.marker([g.c.lat, g.c.lng], { icon, title: g.items.map((l) => l.address).join(', ') }).bindPopup(popup, { closeButton: false, minWidth: 220 }).addTo(pinLayer);
      });
      if (groups.length === 1) map.setView([groups[0].c.lat, groups[0].c.lng], 15);
      else if (groups.length) map.fitBounds(groups.map((g) => [g.c.lat, g.c.lng]), { padding: [60, 60], maxZoom: 15 });
    };
    const setView = (v) => {
      view = v;
      form.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      wrap.classList.toggle('is-map', v === 'map');
      mapWrap.hidden = v !== 'map';
      syncURL();
      drawMap();
    };
    form.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

    /* ---------- Filtering ---------- */
    const syncURL = () => {
      const f = Object.fromEntries(new FormData(form));
      const next = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v && !(k === 'beds' && v === '0') && !(k === 'sort' && v === 'featured')) next.set(k, v); });
      if (view === 'map') next.set('view', 'map');
      history.replaceState(null, '', next.toString() ? '?' + next : location.pathname);
    };

    const render = async () => {
      const f = Object.fromEntries(new FormData(form));
      const q = (f.q || '').trim().toLowerCase();
      const savedIds = V.saved.list();
      if (savedCount) savedCount.textContent = savedIds.length ? '(' + savedIds.length + ')' : '';
      const bahOnly = bahOnlyEl && bahOnlyEl.checked && V.bah && V.bah.get();
      let list = all.filter((l) => {
        if (bahOnly) { const m = V.bah.match(l); if (!m || !m.fits) return false; }
        if (f.saved && !savedIds.includes(l.id)) return false;
        if (f.type && l.type !== f.type) return false;
        if (f.kind && l.propertyType !== f.kind) return false;
        if (Number(f.beds) && Number(l.beds || 0) < Number(f.beds)) return false;
        if (f.max && Number(l.price || 0) > Number(f.max)) return false;
        if (q && ![l.title, l.address, l.city, l.neighborhood, l.zip].join(' ').toLowerCase().includes(q)) return false;
        return true;
      });
      const rank = { available: 0, coming: 1, pending: 2, leased: 3, sold: 3 };
      const sorters = {
        featured: (a, b) => (rank[a.status] || 0) - (rank[b.status] || 0),
        'price-asc': (a, b) => (a.price || 0) - (b.price || 0),
        'price-desc': (a, b) => (b.price || 0) - (a.price || 0),
        newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        size: (a, b) => (b.sqft || 0) - (a.sqft || 0)
      };
      list = list.slice().sort(sorters[f.sort] || sorters.featured);
      current = list;

      count.textContent = list.length;
      if (!list.length) {
        grid.innerHTML = f.saved
          ? '<div class="empty">' + V.leaf() + '<h3>No saved homes yet.</h3><p>Tap the heart on any home to keep it here for later.</p></div>'
          : '<div class="empty">' + V.leaf() + '<h3>No homes match&mdash;yet.</h3><p>Try widening your filters, or tell us what you need and we&rsquo;ll reach out when it opens.</p><a class="btn" href="contact.html?about=upcoming%20rentals">Get notified ' + V.icon.arrow + '</a></div>';
      } else {
        grid.innerHTML = (await Promise.all(list.map((l) => V.card(l)))).join('');
        grid.querySelectorAll('.card').forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--d', Math.min(i, 6) * 0.06 + 's'); });
        window.VerdantReveal && window.VerdantReveal(grid);
      }
      syncURL();
      drawMap();
    };

    let t;
    form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 160); });
    form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
    document.addEventListener('verdant:saved', () => {
      if (form.elements.saved.checked) render();
      else if (savedCount) { const n = V.saved.list().length; savedCount.textContent = n ? '(' + n + ')' : ''; }
    });
    await render();
    setView(view);
  });
})();
