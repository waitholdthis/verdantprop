/*
 * Verdant listings store.
 *
 * Public pages and the admin both read through this module. Today it merges
 * the shipped seed (data/listings.js) with anything saved from admin.html in
 * this browser's IndexedDB. To go live across devices, replace `adapter`
 * with a hosted one (Supabase, Firebase, etc.) exposing the same methods.
 */
(function () {
  'use strict';

  const DB_NAME = 'verdant';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('listings')) db.createObjectStore('listings', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const out = fn(store);
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const adapter = {
    async listLocal() {
      try { return (await tx('listings', 'readonly', (s) => s.getAll())) || []; }
      catch (e) { return []; }
    },
    putListing: (l) => tx('listings', 'readwrite', (s) => s.put(l)),
    deleteListing: (id) => tx('listings', 'readwrite', (s) => s.delete(id)),
    putMedia: (rec) => tx('media', 'readwrite', (s) => s.put(rec)),
    getMedia: (id) => tx('media', 'readonly', (s) => s.get(id)),
    deleteMedia: (id) => tx('media', 'readwrite', (s) => s.delete(id))
  };

  function sanitizePano(p, httpsUrl, str) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.scenes)) return null;
    const idOk = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
    const angle = (v, lim) => { const n = Number(v); return isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0; };
    const scenes = p.scenes.filter((sc) => sc && idOk(sc.id) && httpsUrl(sc.ref)).slice(0, 40).map((sc) => ({
      id: sc.id, room: str(sc.room, 40), ref: httpsUrl(sc.ref),
      yaw: angle(sc.yaw, 180), pitch: angle(sc.pitch, 90), hfov: Math.max(40, Math.min(120, Number(sc.hfov) || 100)),
      hotspots: Array.isArray(sc.hotspots) ? sc.hotspots.filter((h) => h && idOk(h.to)).slice(0, 20).map((h) => ({ to: h.to, yaw: angle(h.yaw, 180), pitch: angle(h.pitch, 90) })) : []
    }));
    const ids = new Set(scenes.map((sc) => sc.id));
    scenes.forEach((sc) => { sc.hotspots = sc.hotspots.filter((h) => ids.has(h.to) && h.to !== sc.id); });
    if (!scenes.length) return null;
    return { first: ids.has(p.first) ? p.first : scenes[0].id, scenes };
  }

  // Imported files are untrusted: keep only known fields, coerce types, and allow only https media.
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[\w-]{1,80}$/.test(raw.id)) return null;
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max || 200) : '');
    const num = (v) => (v === null || v === '' || v === undefined || !isFinite(Number(v)) ? null : Number(v));
    const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
    const httpsUrl = (v) => (typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v.slice(0, 2000) : '');
    const lat = num(raw.lat), lng = num(raw.lng);
    const photos = Array.isArray(raw.photos) ? raw.photos.map(httpsUrl).filter(Boolean).slice(0, 80) : [];
    const rooms = {};
    if (raw.rooms && typeof raw.rooms === 'object') photos.forEach((p) => { const r = str(raw.rooms[p], 40).trim(); if (r) rooms[p] = r; });
    return {
      id: raw.id,
      title: str(raw.title), address: str(raw.address), city: str(raw.city, 80), state: str(raw.state, 2).toUpperCase(), zip: str(raw.zip, 10),
      neighborhood: str(raw.neighborhood, 80),
      type: oneOf(raw.type, ['rent', 'lease', 'sale'], 'rent'),
      propertyType: oneOf(raw.propertyType, ['', 'house', 'townhome', 'apartment', 'condo', 'duplex', 'commercial', 'office', 'retail', 'land'], ''),
      priceUnit: oneOf(raw.priceUnit, ['', 'mo', 'yr', 'sfyr'], ''),
      status: oneOf(raw.status, ['available', 'coming', 'pending', 'leased', 'sold'], 'available'),
      price: num(raw.price), beds: num(raw.beds), baths: num(raw.baths), sqft: num(raw.sqft), deposit: num(raw.deposit),
      available: /^\d{4}-\d{2}-\d{2}$/.test(raw.available || '') ? raw.available : '',
      leaseTerm: str(raw.leaseTerm, 80), pets: str(raw.pets, 120), parking: str(raw.parking, 120),
      description: str(raw.description, 8000),
      features: Array.isArray(raw.features) ? raw.features.map((f) => str(f, 120)).filter(Boolean).slice(0, 60) : [],
      photos, rooms,
      video: raw.video && httpsUrl(raw.video.url) ? { url: httpsUrl(raw.video.url) } : null,
      tour: raw.tour && httpsUrl(raw.tour.url) ? { url: httpsUrl(raw.tour.url) } : null,
      lat: lat !== null && Math.abs(lat) <= 90 ? lat : null,
      lng: lng !== null && Math.abs(lng) <= 180 ? lng : null,
      nearby: Array.isArray(raw.nearby) ? raw.nearby.filter((p) => p && isFinite(p.lat) && isFinite(p.lng)).slice(0, 200).map((p) => ({
        name: str(p.name, 120), cat: oneOf(p.cat, ['dining', 'shopping', 'schools', 'parks', 'health'], 'parks'), type: str(p.type, 60), lat: Number(p.lat), lng: Number(p.lng)
      })) : [],
      pano: sanitizePano(raw.pano, httpsUrl, str),
      featured: raw.featured === true,
      published: raw.published !== false,
      createdAt: num(raw.createdAt) || Date.now(),
      updatedAt: Date.now()
    };
  }

  const seed = () => (window.VERDANT_SEED || []).map((l) => Object.assign({ source: 'seed' }, l));

  const uid = (prefix) => (prefix || 'l') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const store = {
    async all({ includeDrafts = false } = {}) {
      const map = new Map(seed().map((l) => [l.id, l]));
      (await adapter.listLocal()).forEach((l) => map.set(l.id, l));
      let list = [...map.values()].filter((l) => !l.deleted);
      if (!includeDrafts) list = list.filter((l) => l.published !== false);
      return list.sort((a, b) => (b.featured === true) - (a.featured === true) || (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    async get(id) {
      const list = await store.all({ includeDrafts: true });
      return list.find((l) => l.id === id) || null;
    },
    async save(listing) {
      const l = Object.assign({}, listing);
      if (!l.id) { l.id = uid('home'); l.createdAt = Date.now(); }
      l.updatedAt = Date.now();
      delete l.source;
      await adapter.putListing(l);
      return l;
    },
    async remove(id) {
      const existing = await store.get(id);
      if (!existing) return;
      const panoRefs = existing.pano && Array.isArray(existing.pano.scenes) ? existing.pano.scenes.map((sc) => sc.ref) : [];
      const refs = [...(existing.photos || []), existing.video && existing.video.ref, ...panoRefs].filter(Boolean);
      await Promise.all(refs.filter((r) => String(r).startsWith('idb:')).map((r) => adapter.deleteMedia(r.slice(4)).catch(() => {})));
      const isSeed = seed().some((l) => l.id === id);
      if (isSeed) await adapter.putListing({ id, deleted: true, updatedAt: Date.now() });
      else await adapter.deleteListing(id);
    },
    async putMedia(blob, name) {
      const id = uid('m');
      await adapter.putMedia({ id, blob, type: blob.type, name: name || '', size: blob.size });
      return 'idb:' + id;
    },
    async deleteMedia(ref) {
      if (String(ref).startsWith('idb:')) await adapter.deleteMedia(ref.slice(4)).catch(() => {});
    },
    _urls: new Map(),
    async resolve(ref) {
      if (!ref) return '';
      if (!String(ref).startsWith('idb:')) return ref;
      if (store._urls.has(ref)) return store._urls.get(ref);
      const rec = await adapter.getMedia(ref.slice(4)).catch(() => null);
      if (!rec) return '';
      const url = URL.createObjectURL(rec.blob);
      store._urls.set(ref, url);
      return url;
    },
    async exportJSON() {
      const list = await store.all({ includeDrafts: true });
      return JSON.stringify(list.map((l) => {
        const c = Object.assign({}, l);
        delete c.source;
        c.photos = (c.photos || []).filter((p) => !String(p).startsWith('idb:'));
        if (c.pano && Array.isArray(c.pano.scenes)) {
          const scenes = c.pano.scenes.filter((sc) => !String(sc.ref).startsWith('idb:'));
          c.pano = scenes.length ? Object.assign({}, c.pano, { scenes }) : null;
        }
        c.rooms = Object.fromEntries(Object.entries(c.rooms || {}).filter(([p]) => c.photos.includes(p)));
        if (c.video && c.video.ref && String(c.video.ref).startsWith('idb:')) c.video = null;
        return c;
      }), null, 2);
    },
    async importJSON(text) {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Expected a JSON array of listings');
      let n = 0;
      for (const raw of arr) {
        const l = sanitize(raw);
        if (l) { await adapter.putListing(l); n++; }
      }
      return n;
    }
  };

  /* ---------- Formatting ---------- */
  const LISTING_TYPES = { sale: 'For sale', rent: 'For rent', lease: 'For lease' };
  const PROPERTY_TYPES = { house: 'House', townhome: 'Townhome', apartment: 'Apartment', condo: 'Condo', duplex: 'Duplex / multi-family', commercial: 'Commercial building', office: 'Office', retail: 'Retail', land: 'Land' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n || n === 0) && n !== '' ? '$' + Number(n).toLocaleString('en-US') : '';
  const fmt = {
    money,
    price(l) { return l.price ? money(l.price) : 'Call'; },
    per(l) { return l.type === 'sale' ? '' : ({ mo: '/mo', yr: '/yr', sfyr: '/sq ft/yr' })[l.priceUnit] || '/mo'; },
    // Listing type: what the visitor can do with the property.
    type(l) { return LISTING_TYPES[l.type] || LISTING_TYPES.rent; },
    priceLabel(l) {
      if (l.type === 'sale') return 'List price';
      if (l.type === 'lease') return ({ yr: 'Annual lease rate', sfyr: 'Lease rate per sq ft / year' })[l.priceUnit] || 'Monthly lease rate';
      return 'Monthly rent';
    },
    kind(l) { return PROPERTY_TYPES[l.propertyType] || ''; },
    num(n) { return n || n === 0 ? Number(n).toLocaleString('en-US') : '—'; },
    status(s) { return ({ available: 'Available', pending: 'Application pending', leased: 'Leased', sold: 'Sold', coming: 'Coming soon' })[s] || 'Available'; },
    fullAddress(l) { return [l.address, [l.city, l.state].filter(Boolean).join(', '), l.zip].filter(Boolean).join(', '); },
    date(d) { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  };

  /* ---------- Embeds: video + 3D walk-throughs ---------- */
  const embed = {
    video(url) {
      if (!url) return null;
      let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
      if (m) return { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1' };
      m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (m) return { kind: 'vimeo', src: 'https://player.vimeo.com/video/' + m[1] + '?dnt=1' };
      if (/^https:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: 'file', src: url };
      return null;
    },
    tour(url) {
      if (!url || !/^https:\/\//i.test(url)) return null;
      let host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
      let src = url;
      let provider = host;
      if (/matterport\.com$/.test(host)) {
        provider = 'Matterport';
        const m = url.match(/[?&]m=([\w]+)/);
        if (m) src = 'https://my.matterport.com/show/?m=' + m[1] + '&play=1&qs=1&brand=0';
      } else if (/kuula\.co$/.test(host)) provider = 'Kuula';
      else if (/zillow\.com$/.test(host)) provider = 'Zillow 3D Home';
      else if (/youriguide\.com$/.test(host)) provider = 'iGUIDE';
      else if (/cloudpano\.com$/.test(host)) provider = 'CloudPano';
      else if (/teliportme|momento360|roundme|3dvista/.test(host)) provider = '360° tour';
      return { src, provider };
    }
  };

  /* ---------- Icons ---------- */
  const icon = {
    arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6"/></svg>',
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2.8 20 7v10l-8 4.2L4 17V7z"/><path d="M4 7l8 4.2L20 7M12 11.2V21"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3.5 8h3.3l1.7-2.5h7l1.7 2.5h3.3v11h-17z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20.3s-7.8-4.6-7.8-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.8 2.5c0 5.8-7.8 10.4-7.8 10.4z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V20h14v-7.5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 16.5v-4l2-5.2A1.5 1.5 0 0 1 7.4 6.3h9.2a1.5 1.5 0 0 1 1.4 1l2 5.2v4"/><path d="M3.5 12.5h17v4h-17z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
    street: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 8v6M9 21l3-7 3 7M8.5 11h7"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>'
  };
  const leaf = (cls) => '<svg class="leaf ' + (cls || '') + '" viewBox="0 0 48 58" aria-hidden="true"><use href="#leaf"/></svg>';

  /* ---------- Shared card renderer ---------- */
  async function card(l, opts = {}) {
    const cover = await store.resolve((l.photos || [])[0]);
    const tags = [];
    tags.push('<span class="tag tag--' + esc(LISTING_TYPES[l.type] ? l.type : 'rent') + '">' + esc(fmt.type(l)) + '</span>');
    if (l.status && l.status !== 'available') tags.push('<span class="tag tag--' + (l.status === 'pending' || l.status === 'coming' ? 'pending' : 'leased') + '">' + esc(fmt.status(l.status)) + '</span>');
    if ((l.tour && l.tour.url) || (l.pano && l.pano.scenes && l.pano.scenes.length)) tags.push('<span class="tag tag--dark">' + icon.cube + '3D tour</span>');
    if (l.video && (l.video.url || l.video.ref)) tags.push('<span class="tag tag--dark">' + icon.play + 'Video</span>');
    const href = opts.href || ('property.html?id=' + encodeURIComponent(l.id));
    const media = cover
      ? '<img src="' + esc(cover) + '" alt="' + esc(l.address) + '" loading="lazy" decoding="async">'
      : '<div class="ph">' + leaf() + '<span>Photography coming soon</span></div>';
    return (
      '<article class="card" data-cursor="View">' +
        '<div class="card-media">' + media +
          '<div class="card-tags">' + tags.join('') + '</div>' +
          (opts.noLink ? '' : '<button type="button" class="heart' + (saved.has(l.id) ? ' on' : '') + '" data-save="' + esc(l.id) + '" aria-pressed="' + saved.has(l.id) + '" aria-label="Save ' + esc(l.address) + '">' + icon.heart + '</button>') +
          '<p class="card-price">' + esc(fmt.price(l)) + (l.price ? '<small>' + fmt.per(l) + '</small>' : '') + '</p>' +
        '</div>' +
        '<div class="card-body">' +
          (fmt.kind(l) ? '<p class="card-kind">' + esc(fmt.kind(l)) + '</p>' : '') +
          '<h3 class="card-title">' + esc(l.title || l.address) + '</h3>' +
          '<p class="card-addr">' + esc(fmt.fullAddress(l)) + '</p>' +
          '<p class="card-facts"><span><b>' + fmt.num(l.beds) + '</b> Bed</span><span><b>' + fmt.num(l.baths) + '</b> Bath</span><span><b>' + fmt.num(l.sqft) + '</b> Sq Ft</span></p>' +
        '</div>' +
        (opts.noLink ? '' : '<a class="card-link" href="' + href + '"><span class="sr-only">View ' + esc(l.address) + '</span></a>') +
      '</article>'
    );
  }

  /* ---------- Saved homes (per-visitor, this browser) ---------- */
  const SAVED_KEY = 'verdant:saved';
  const saved = {
    list() { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { return []; } },
    has(id) { return saved.list().includes(id); },
    toggle(id) {
      const s = saved.list();
      const i = s.indexOf(id);
      if (i === -1) s.push(id); else s.splice(i, 1);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
      document.dispatchEvent(new CustomEvent('verdant:saved', { detail: { id, on: i === -1 } }));
      return i === -1;
    }
  };
  // One delegated handler powers every heart button on the site.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-save]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const on = saved.toggle(b.dataset.save);
    document.querySelectorAll('[data-save="' + CSS.escape(b.dataset.save) + '"]').forEach((x) => {
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    });
  });

  /* ---------- Geography: geocoding, distances, map library ---------- */
  const GEO_CACHE = 'verdant:geo:';
  const geo = {
    // Nominatim (OpenStreetMap). Biased toward the Fayetteville area.
    async geocode(q) {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=-79.45,35.45,-78.55,34.75&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Geocoding failed');
      const [hit] = await res.json();
      return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name } : null;
    },
    // Coordinates for a listing: stored ones, else a cached or fresh geocode.
    async locate(l) {
      if (l.lat && l.lng) return { lat: Number(l.lat), lng: Number(l.lng) };
      const q = fmt.fullAddress(l);
      if (!q) return null;
      try { const c = JSON.parse(localStorage.getItem(GEO_CACHE + q)); if (c) return c; } catch (e) { /* ignore */ }
      const hit = await geo.geocode(q).catch(() => null);
      if (hit) { try { localStorage.setItem(GEO_CACHE + q, JSON.stringify({ lat: hit.lat, lng: hit.lng })); } catch (e) { /* ignore */ } }
      return hit;
    },
    miles(a, b) {
      const R = 3958.8, rad = Math.PI / 180;
      const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    },
    _leaflet: null,
    loadLeaflet() {
      if (window.L) return Promise.resolve(window.L);
      if (geo._leaflet) return geo._leaflet;
      geo._leaflet = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        css.integrity = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==';
        css.crossOrigin = 'anonymous';
        css.referrerPolicy = 'no-referrer';
        document.head.appendChild(css);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        // Integrity hash: the browser refuses the file if the CDN ever serves altered code.
        s.integrity = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==';
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.onload = () => resolve(window.L);
        s.onerror = () => reject(new Error('Map library failed to load'));
        document.head.appendChild(s);
      });
      return geo._leaflet;
    },
    tiles(L) {
      // OpenStreetMap standard tiles: keyless with attribution, fine for a low-traffic site.
      // For heavy traffic, swap in a hosted provider (MapTiler, Stadia) here.
      return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
    },
    homeIcon(L) {
      return L.divIcon({ className: 'pin-home', html: '<span>' + leaf() + '</span>', iconSize: [44, 52], iconAnchor: [22, 50] });
    }
  };

  fmt.LISTING_TYPES = LISTING_TYPES;
  fmt.PROPERTY_TYPES = PROPERTY_TYPES;

  window.Verdant = { store, fmt, embed, icon, leaf, esc, card, uid, saved, geo };
})();
