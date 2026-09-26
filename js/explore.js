/*
 * Neighborhood explorer + travel times for a property.
 * Data: OpenStreetMap places (Overpass), drive times (OSRM), geocoding (Nominatim).
 * All free and keyless; results are cached per visitor to stay polite to these services.
 */
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;

  const OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const OSRM = 'https://router.project-osrm.org';
  const RADIUS = 2400; // meters (~1.5 mi)
  const DEST_KEY = 'verdant:destinations';
  const WEEK = 7 * 24 * 3600 * 1000;

  const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICONS = {
    highlights: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    dining: svg('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7h3"/>'),
    shopping: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
    schools: svg('<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2V11M21.5 9v5"/>'),
    parks: svg('<path d="M12 21v-6M7.5 15h9L12 3z"/><path d="M9 11h6"/>'),
    health: svg('<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>'),
    base: svg('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-5h6v5M4 20h16"/>'),
    plane: svg('<path d="M10.5 13.5 3 11l1-2 8 1 4-5.5c.6-.8 1.8-1 2.5-.3.7.7.5 1.9-.3 2.5L13 11l1 8-2 1-2.5-7.5"/>'),
    downtown: svg('<path d="M3 21h18M5 21V11h14v10M8 11V8h8v3M12 8V4M10 15h4v6h-4z"/>'),
    hospital: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>'),
    mall: svg('<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5h16M9.5 20v-5h5v5"/>'),
    pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>')
  };

  const CATS = [
    { key: 'dining', label: 'Dining', match: (t) => /^(restaurant|cafe|fast_food|ice_cream|bakery)$/.test(t.amenity || t.shop) },
    { key: 'shopping', label: 'Groceries & shopping', match: (t) => !!t.shop && t.shop !== 'bakery' },
    { key: 'schools', label: 'Schools', match: (t) => /^(school|kindergarten|college|university|childcare)$/.test(t.amenity) },
    { key: 'parks', label: 'Parks & fitness', match: (t) => !!t.leisure },
    { key: 'health', label: 'Health', match: (t) => /^(hospital|clinic|pharmacy|doctors|dentist)$/.test(t.amenity) }
  ];

  // Destinations that matter to people living in Fayetteville.
  const PRESETS = [
    { name: 'Fort Bragg', sub: 'Womack Army Medical Center', icon: 'base', lat: 35.1459947, lng: -79.0024331 },
    { name: 'Pope Army Airfield', sub: 'Fort Bragg', icon: 'plane', lat: 35.1734655, lng: -79.0180408 },
    { name: 'Downtown Fayetteville', sub: 'Market House', icon: 'downtown', lat: 35.0525691, lng: -78.8783039 },
    { name: 'Cape Fear Valley Medical Center', sub: 'Owen Drive', icon: 'hospital', lat: 35.0313519, lng: -78.9335603 },
    { name: 'Cross Creek Mall', sub: 'Shopping', icon: 'mall', lat: 35.0696897, lng: -78.9598355 },
    { name: 'Fayetteville Regional Airport', sub: 'FAY', icon: 'plane', lat: 34.9906914, lng: -78.8871044 }
  ];

  // Places OpenStreetMap still lists but that have closed (verified, with source + date).
  // Matched by name within ~150 m, so a new business at the same spot still shows.
  const CLOSED = [
    { name: "Pierro's Italian Bistro", lat: 35.13816, lng: -78.87441, note: 'Ramsey St location closed (moved to Hay St) — Yelp, checked 2026-09-26' },
    { name: 'Duck Donuts', lat: 35.13046, lng: -78.87906, note: 'Closed 2024-12-24 — BizFayetteville, checked 2026-09-26' }
  ];
  const norm = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isClosed = (p) => CLOSED.some((c) => norm(c.name) === norm(p.name) && V.geo.miles(c, p) < 0.1);
  // Hide closed places and any the agent hid for this listing.
  const visiblePlaces = (items, hidden) => {
    const h = new Set((hidden || []).map(norm));
    return items.filter((p) => !isClosed(p) && !h.has(norm(p.name)));
  };

  const TYPE_LABEL = {
    fast_food: 'Fast food', cafe: 'Café', ice_cream: 'Ice cream', supermarket: 'Supermarket', convenience: 'Convenience store',
    department_store: 'Department store', variety_store: 'Variety store', mall: 'Shopping center', kindergarten: 'Preschool',
    childcare: 'Childcare', fitness_centre: 'Fitness center', sports_centre: 'Sports center', nature_reserve: 'Nature preserve',
    swimming_pool: 'Pool', golf_course: 'Golf course', doctors: 'Doctor', greengrocer: 'Produce market'
  };
  const pretty = (v) => TYPE_LABEL[v] || (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : 'Place');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  };

  async function fetchPlaces(c, opts) {
    // Coordinates are interpolated into the query, so accept only real numbers.
    c = { lat: Number(c.lat), lng: Number(c.lng) };
    if (!isFinite(c.lat) || !isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) throw new Error('Invalid coordinates');
    const key = 'verdant:poi:' + c.lat.toFixed(4) + ',' + c.lng.toFixed(4);
    const cached = store.get(key);
    if (cached && Date.now() - cached.t < WEEK && !(opts && opts.fresh)) return cached.items;
    const around = 'around:' + RADIUS + ',' + c.lat + ',' + c.lng;
    const q = '[out:json][timeout:25];(' +
      'nwr(' + around + ')[amenity~"^(restaurant|cafe|fast_food|ice_cream|school|kindergarten|college|university|childcare|hospital|clinic|pharmacy|doctors|dentist)$"][name];' +
      'nwr(' + around + ')[shop~"^(supermarket|convenience|mall|department_store|greengrocer|bakery|hardware|variety_store)$"][name];' +
      'nwr(' + around + ')[leisure~"^(park|fitness_centre|sports_centre|playground|nature_reserve|swimming_pool|golf_course)$"][name];' +
      ');out center 400;';
    let lastErr;
    for (const ep of OVERPASS) {
      try {
        const ctrl = new AbortController();
        // The timeout covers the whole download, so a server that stalls mid-response falls through to the next.
        const timer = setTimeout(() => ctrl.abort(), 20000);
        let json;
        try {
          const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          json = await res.json();
        } finally { clearTimeout(timer); }
        const seen = new Set();
        const items = json.elements.map((e) => {
          const t = e.tags || {};
          const lat = e.lat != null ? e.lat : e.center && e.center.lat;
          const lng = e.lon != null ? e.lon : e.center && e.center.lon;
          const cat = CATS.find((k) => k.match(t));
          if (!cat || lat == null) return null;
          const id = t.name + '|' + cat.key;
          if (seen.has(id)) return null;
          seen.add(id);
          return { name: t.name, cat: cat.key, type: pretty(t.amenity || t.shop || t.leisure), lat, lng, mi: V.geo.miles(c, { lat, lng }) };
        }).filter(Boolean).sort((a, b) => a.mi - b.mi);
        store.set(key, { t: Date.now(), items });
        return items;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Places unavailable');
  }

  async function driveTimes(origin, dests) {
    if (!dests.length) return [];
    const coords = [origin, ...dests].map((d) => d.lng.toFixed(6) + ',' + d.lat.toFixed(6)).join(';');
    const res = await fetch(OSRM + '/table/v1/driving/' + coords + '?sources=0&annotations=duration,distance');
    if (!res.ok) throw new Error('Routing unavailable');
    const j = await res.json();
    if (j.code !== 'Ok') throw new Error(j.message || 'Routing unavailable');
    return dests.map((_, i) => ({ sec: j.durations[0][i + 1], m: j.distances[0][i + 1] }));
  }

  async function routeLine(a, b) {
    const res = await fetch(OSRM + '/route/v1/driving/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson');
    const j = await res.json();
    if (j.code !== 'Ok' || !j.routes.length) throw new Error('No route');
    return j.routes[0].geometry.coordinates.map(([x, y]) => [y, x]);
  }

  const fmtMin = (sec) => (sec == null ? '—' : sec < 3600 ? Math.max(1, Math.round(sec / 60)) + ' min' : Math.floor(sec / 3600) + ' hr ' + Math.round((sec % 3600) / 60) + ' min');
  const fmtMi = (m) => (m == null ? '' : (m / 1609.34).toFixed(m < 16093 ? 1 : 0) + ' mi');
  const fmtDist = (mi) => (mi < 0.1 ? '< 0.1 mi' : mi.toFixed(1) + ' mi');

  function markup(l) {
    const area = [l.neighborhood && l.neighborhood !== l.city ? l.neighborhood : '', l.zip].filter(Boolean).join(' · ');
    return '' +
      '<h2>The <em style="color:var(--forest)">neighborhood</em></h2>' +
      '<p class="ex-lede">Explore what&rsquo;s around ' + esc(l.address) + (area ? ' <span class="ex-area">' + esc(area) + '</span>' : '') + '. Tap a category to see nearby places on the map.</p>' +
      '<div class="ex" data-ex>' +
        '<div class="ex-chips" role="tablist" aria-label="Place categories">' +
          [{ key: 'highlights', label: 'Highlights' }].concat(CATS).map((k, i) =>
            '<button type="button" role="tab" class="ex-chip" data-cat="' + k.key + '" aria-selected="' + (i === 0) + '">' + ICONS[k.key] + '<span>' + esc(k.label) + '</span><b data-count="' + k.key + '"></b></button>'
          ).join('') +
        '</div>' +
        '<div class="ex-body">' +
          '<div class="ex-map-wrap">' +
            '<div class="ex-map" data-map role="region" aria-label="Neighborhood map"></div>' +
            '<div class="ex-map-actions">' +
              '<button type="button" class="ex-btn" data-expand aria-label="Expand map">' + V.icon.expand + '</button>' +
            '</div>' +
            '<div class="ex-map-links">' +
              '<a class="ex-pill" data-streetview target="_blank" rel="noopener">' + V.icon.street + 'Street View</a>' +
              '<a class="ex-pill" data-directions target="_blank" rel="noopener">' + V.icon.car + 'Directions</a>' +
            '</div>' +
          '</div>' +
          '<ol class="ex-list" data-list role="list"><li class="ex-status">Loading nearby places&hellip;</li></ol>' +
        '</div>' +
        '<div class="tt">' +
          '<div class="tt-head"><h3>Travel times</h3><span class="caps">Estimated drive, typical traffic not included</span></div>' +
          '<ul class="tt-list" data-tt role="list"></ul>' +
          '<form class="tt-add" data-tt-add>' +
            '<label class="sr-only" for="tt-input">Add a destination</label>' +
            V.icon.car +
            '<input id="tt-input" name="q" placeholder="Add a destination: your unit, school, or workplace" autocomplete="off" />' +
            '<button type="submit" class="btn btn--sm">Add</button>' +
          '</form>' +
          '<p class="tt-msg" data-tt-msg role="status" aria-live="polite"></p>' +
        '</div>' +
        '<p class="ex-credit">Places &copy; OpenStreetMap contributors. Drive times via OSRM. Distances are approximate; verify school assignments with Cumberland County Schools.</p>' +
      '</div>';
  }

  async function mount(section, l, home) {
    section.innerHTML = markup(l);
    const root = section.querySelector('[data-ex]');
    const listEl = root.querySelector('[data-list]');
    const ttEl = root.querySelector('[data-tt]');
    const ttMsg = root.querySelector('[data-tt-msg]');
    root.querySelector('[data-streetview]').href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + home.lat + ',' + home.lng;
    root.querySelector('[data-directions]').href = 'https://www.google.com/maps/dir/?api=1&destination=' + home.lat + ',' + home.lng;

    let L, map, placeLayer, routeLayer;
    let places = [];
    let cat = 'highlights';
    const markers = new Map();

    const visible = () => {
      if (cat !== 'highlights') return places.filter((p) => p.cat === cat).slice(0, 25);
      return CATS.flatMap((k) => places.filter((p) => p.cat === k.key).slice(0, 2)).sort((a, b) => a.mi - b.mi);
    };

    const icon = (p, on) => L.divIcon({ className: 'pin' + (on ? ' on' : ''), html: '<span>' + ICONS[p.cat] + '</span>', iconSize: [32, 32], iconAnchor: [16, 16] });

    const select = (i, pan) => {
      const shown = visible();
      listEl.querySelectorAll('.ex-item').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === i));
      markers.forEach((m, j) => m.setIcon(icon(shown[j], j === i)));
      const m = markers.get(i);
      if (m) { m.setZIndexOffset(1000); m.openPopup(); if (pan) map.panTo(m.getLatLng()); }
    };

    const draw = () => {
      const shown = visible();
      listEl.innerHTML = shown.length
        ? shown.map((p, i) => '<li><button type="button" class="ex-item" data-i="' + i + '"><span class="ex-ico">' + ICONS[p.cat] + '</span><span class="ex-name"><strong>' + esc(p.name) + '</strong><small>' + esc(p.type) + '</small></span><span class="ex-dist">' + fmtDist(p.mi) + '</span></button></li>').join('')
        : '<li class="ex-status">No ' + esc((CATS.find((k) => k.key === cat) || {}).label || 'places').toLowerCase() + ' found within 1.5 miles.</li>';
      if (!map) return;
      placeLayer.clearLayers();
      markers.clear();
      shown.forEach((p, i) => {
        const m = L.marker([p.lat, p.lng], { icon: icon(p, false), title: p.name, keyboard: false })
          .bindPopup('<strong>' + esc(p.name) + '</strong><br><span>' + esc(p.type) + ' &middot; ' + fmtDist(p.mi) + '</span>', { closeButton: false, offset: [0, -10] })
          .on('click', () => select(i, false));
        placeLayer.addLayer(m);
        markers.set(i, m);
      });
      const pts = shown.map((p) => [p.lat, p.lng]).concat([[home.lat, home.lng]]);
      if (shown.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
      else map.setView([home.lat, home.lng], 15);
    };

    root.querySelector('.ex-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      if (routeLayer) routeLayer.clearLayers();
      draw();
    });
    listEl.addEventListener('click', (e) => { const b = e.target.closest('.ex-item'); if (b) select(Number(b.dataset.i), true); });

    const expandBtn = root.querySelector('[data-expand]');
    expandBtn.addEventListener('click', () => {
      const on = root.classList.toggle('ex--full');
      document.body.style.overflow = on ? 'hidden' : '';
      expandBtn.setAttribute('aria-label', on ? 'Close full-screen map' : 'Expand map');
      if (map) setTimeout(() => map.invalidateSize(), 60);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('ex--full')) expandBtn.click(); });

    /* Map */
    try {
      L = await V.geo.loadLeaflet();
      map = L.map(root.querySelector('[data-map]'), { scrollWheelZoom: false, zoomControl: true }).setView([home.lat, home.lng], 15);
      V.geo.tiles(L).addTo(map);
      L.marker([home.lat, home.lng], { icon: V.geo.homeIcon(L), zIndexOffset: 2000, title: l.address }).addTo(map).bindPopup('<strong>' + esc(l.address) + '</strong>', { closeButton: false, offset: [0, -40] });
      placeLayer = L.layerGroup().addTo(map);
      routeLayer = L.layerGroup().addTo(map);
      map.on('click', () => map.scrollWheelZoom.enable());
    } catch (e) {
      root.querySelector('[data-map]').innerHTML = '<p class="ex-status" style="padding:2rem">The map couldn&rsquo;t load. Check your connection and refresh.</p>';
    }

    /* Places */
    const stored = Array.isArray(l.nearby) && l.nearby.length
      ? Promise.resolve(l.nearby.map((p) => Object.assign({}, p, { mi: V.geo.miles(home, p) })).sort((a, b) => a.mi - b.mi))
      : fetchPlaces(home);
    stored.then((all) => visiblePlaces(all, l.nearbyHidden)).then((items) => {
      places = items;
      CATS.forEach((k) => { const n = places.filter((p) => p.cat === k.key).length; const b = root.querySelector('[data-count="' + k.key + '"]'); if (b) b.textContent = n || ''; });
      draw();
    }).catch(() => {
      listEl.innerHTML = '<li class="ex-status">Nearby places are unavailable right now. <button type="button" class="link-arrow" data-retry>Try again</button></li>';
      listEl.querySelector('[data-retry]').addEventListener('click', () => mount(section, l, home));
    });

    /* Travel times */
    const custom = () => store.get(DEST_KEY) || [];
    const drawTimes = async () => {
      const dests = PRESETS.map((p) => Object.assign({ preset: true }, p)).concat(custom().map((d) => Object.assign({ icon: 'pin' }, d)));
      ttEl.innerHTML = dests.map((d, i) =>
        '<li class="tt-row"><span class="ex-ico">' + ICONS[d.icon] + '</span>' +
        '<span class="ex-name"><strong>' + esc(d.name) + '</strong><small>' + esc(d.sub || '') + '</small></span>' +
        '<span class="tt-time" data-time="' + i + '"><b>&hellip;</b><small></small></span>' +
        '<span class="tt-acts"><button type="button" class="ex-btn ex-btn--sm" data-route="' + i + '" aria-label="Show route to ' + esc(d.name) + '">' + V.icon.car + '</button>' +
        (d.preset ? '' : '<button type="button" class="ex-btn ex-btn--sm" data-remove="' + (i - PRESETS.length) + '" aria-label="Remove ' + esc(d.name) + '">&times;</button>') +
        '</span></li>'
      ).join('');
      ttEl.onclick = async (e) => {
        const r = e.target.closest('[data-route]');
        const x = e.target.closest('[data-remove]');
        if (x) { const c = custom(); c.splice(Number(x.dataset.remove), 1); store.set(DEST_KEY, c); drawTimes(); return; }
        if (!r || !map) return;
        const d = dests[Number(r.dataset.route)];
        ttEl.querySelectorAll('.tt-row').forEach((row, j) => row.classList.toggle('on', j === Number(r.dataset.route)));
        try {
          const line = await routeLine(home, d);
          routeLayer.clearLayers();
          L.polyline(line, { color: '#0b231b', weight: 7, opacity: .25 }).addTo(routeLayer);
          L.polyline(line, { color: '#b08d57', weight: 4 }).addTo(routeLayer);
          L.marker([d.lat, d.lng], { icon: L.divIcon({ className: 'pin on', html: '<span>' + ICONS[d.icon] + '</span>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(routeLayer).bindPopup('<strong>' + esc(d.name) + '</strong>', { closeButton: false }).openPopup();
          map.fitBounds(line, { padding: [40, 40] });
          section.querySelector('.ex-map-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) { ttMsg.textContent = 'Couldn’t draw that route right now.'; }
      };
      try {
        const times = await driveTimes(home, dests);
        times.forEach((t, i) => {
          const cell = ttEl.querySelector('[data-time="' + i + '"]');
          if (cell) cell.innerHTML = '<b>' + fmtMin(t.sec) + '</b><small>' + fmtMi(t.m) + '</small>';
        });
      } catch (e) {
        ttEl.querySelectorAll('[data-time]').forEach((c, i) => { c.innerHTML = '<b>' + fmtDist(V.geo.miles(home, dests[i])) + '</b><small>straight line</small>'; });
      }
    };
    drawTimes();

    root.querySelector('[data-tt-add]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = e.target.elements.q;
      const q = input.value.trim();
      if (!q) return;
      ttMsg.textContent = 'Finding “' + q + '”…';
      try {
        const hit = await V.geo.geocode(/,|\bnc\b/i.test(q) ? q : q + ', NC');
        if (!hit) { ttMsg.textContent = 'We couldn’t find that place. Try adding a street or city.'; return; }
        const c = custom();
        c.push({ name: q, sub: hit.label.split(',').slice(1, 3).join(',').trim(), lat: hit.lat, lng: hit.lng });
        store.set(DEST_KEY, c.slice(-6));
        input.value = '';
        ttMsg.textContent = 'Added. Your destinations are remembered on every home you view.';
        drawTimes();
      } catch (err) { ttMsg.textContent = 'Search is unavailable right now. Please try again shortly.'; }
    });
  }

  window.VerdantExplore = {
    // Mounts lazily, when the section approaches the viewport.
    lazy(section, l, home) {
      if (!('IntersectionObserver' in window)) return mount(section, l, home);
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { io.disconnect(); mount(section, l, home); }
      }, { rootMargin: '600px 0px' });
      io.observe(section);
    },
    PRESETS,
    CATS: CATS.map((k) => ({ key: k.key, label: k.label })),
    isClosed,
    // Used by the admin to snapshot nearby places onto a listing at save time.
    async snapshot(c) {
      const items = visiblePlaces(await fetchPlaces(c, { fresh: true }));
      return CATS.flatMap((k) => items.filter((p) => p.cat === k.key).slice(0, 25))
        .map((p) => ({ name: p.name, cat: p.cat, type: p.type, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }));
    }
  };
})();
