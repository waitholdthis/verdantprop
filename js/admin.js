// Verdant Listing Studio — create and manage listings with photos, video, and 3D tours
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;
  const view = document.querySelector('[data-view]');
  const toastEl = document.querySelector('[data-toast]');
  let dirty = false;

  const ic = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Router ---------- */
  const route = async () => {
    const h = location.hash.replace(/^#\/?/, '');
    document.querySelectorAll('.ad-nav a[data-route]').forEach((a) => a.classList.remove('on'));
    if (h.startsWith('edit/')) return renderEdit(decodeURIComponent(h.slice(5)));
    if (h === 'new') { document.querySelector('[data-route="new"]').classList.add('on'); return renderEdit(null); }
    document.querySelector('[data-route="list"]').classList.add('on');
    return renderList();
  };
  window.addEventListener('hashchange', () => {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    dirty = false;
    route();
  });

  /* ---------- List view ---------- */
  async function renderList() {
    view.innerHTML = document.getElementById('tpl-list').innerHTML;
    const list = await V.store.all({ includeDrafts: true });
    const count = (fn) => list.filter(fn).length;
    view.querySelector('[data-stats]').innerHTML = [
      [list.length, 'Total listings'],
      [count((l) => l.published !== false && (l.status || 'available') === 'available'), 'Live & available'],
      [count((l) => l.status === 'pending' || l.status === 'coming'), 'Pending / coming'],
      [count((l) => l.tour && l.tour.url), 'With 3D tours']
    ].map(([n, k]) => '<div class="ad-stat"><b>' + n + '</b><span>' + k + '</span></div>').join('');

    const rows = view.querySelector('[data-rows]');
    const search = view.querySelector('[data-search]');
    const statusF = view.querySelector('[data-status-filter]');

    const draw = async () => {
      const q = search.value.trim().toLowerCase();
      const sf = (statusF.querySelector('input:checked') || {}).value || '';
      const shown = list.filter((l) => {
        if (q && ![l.title, l.address, l.city, l.neighborhood].join(' ').toLowerCase().includes(q)) return false;
        if (sf === 'draft') return l.published === false;
        if (sf === 'leased') return l.status === 'leased' || l.status === 'sold';
        if (sf === 'pending') return l.status === 'pending' || l.status === 'coming';
        if (sf) return (l.status || 'available') === sf;
        return true;
      });
      if (!shown.length) {
        rows.innerHTML = '<div class="ad-empty">' + V.leaf() + '<h3 class="title title--sm">No listings here yet.</h3><a class="btn" href="#/new">Create a listing</a></div>';
        return;
      }
      const html = await Promise.all(shown.map(async (l) => {
        const cover = await V.store.resolve((l.photos || [])[0]);
        const badges = [];
        if (l.published === false) badges.push('<span class="ad-badge ad-badge--draft">Draft</span>');
        badges.push('<span class="ad-badge ad-badge--' + (V.fmt.LISTING_TYPES[l.type] ? l.type : 'rent') + '">' + esc(V.fmt.type(l)) + '</span>');
        if (V.fmt.kind(l)) badges.push('<span class="ad-badge ad-badge--draft">' + esc(V.fmt.kind(l)) + '</span>');
        const st = l.status || 'available';
        badges.push('<span class="ad-badge' + (st === 'pending' || st === 'coming' ? ' ad-badge--pending' : st === 'leased' || st === 'sold' ? ' ad-badge--leased' : '') + '">' + esc(V.fmt.status(st)) + '</span>');
        if (l.featured) badges.push('<span class="ad-badge">Featured</span>');
        if (l.tour && l.tour.url) badges.push('<span class="ad-badge">3D</span>');
        if (l.video && (l.video.url || l.video.ref)) badges.push('<span class="ad-badge">Video</span>');
        return '<div class="ad-row">' +
          '<div class="ad-thumb">' + (cover ? '<img src="' + esc(cover) + '" alt="">' : '<div class="ph">' + V.leaf() + '</div>') + '</div>' +
          '<div><h3>' + esc(l.title || l.address || 'Untitled') + '</h3><p class="sub">' + esc(V.fmt.fullAddress(l)) + '</p><div class="ad-badges">' + badges.join('') + '</div></div>' +
          '<div class="col"><span class="k">Price</span><span class="v">' + esc(V.fmt.price(l)) + (l.price ? V.fmt.per(l) : '') + '</span></div>' +
          '<div class="col"><span class="k">Beds / Baths</span><span class="v">' + V.fmt.num(l.beds) + ' / ' + V.fmt.num(l.baths) + '</span></div>' +
          '<div class="col"><span class="k">Photos</span><span class="v">' + (l.photos || []).length + '</span></div>' +
          '<div class="ad-actions">' +
            '<a class="ad-icon-btn" href="#/edit/' + encodeURIComponent(l.id) + '" title="Edit" aria-label="Edit ' + esc(l.address) + '">' + ic.edit + '</a>' +
            '<a class="ad-icon-btn" href="property.html?id=' + encodeURIComponent(l.id) + '&preview=1" target="_blank" rel="noopener" title="View on site" aria-label="View ' + esc(l.address) + ' on site">' + ic.eye + '</a>' +
            '<button class="ad-icon-btn" type="button" data-dup="' + esc(l.id) + '" title="Duplicate" aria-label="Duplicate ' + esc(l.address) + '">' + ic.copy + '</button>' +
            '<button class="ad-icon-btn ad-icon-btn--danger" type="button" data-del="' + esc(l.id) + '" title="Delete" aria-label="Delete ' + esc(l.address) + '">' + ic.trash + '</button>' +
          '</div></div>';
      }));
      rows.innerHTML = html.join('');
    };

    rows.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      const dup = e.target.closest('[data-dup]');
      if (del) {
        const l = list.find((x) => x.id === del.dataset.del);
        if (!confirm('Delete ' + (l ? l.address : 'this listing') + '? Its photos and video will be removed too.')) return;
        await V.store.remove(del.dataset.del);
        toast('Listing deleted');
        renderList();
      }
      if (dup) {
        const l = list.find((x) => x.id === dup.dataset.dup);
        if (!l) return;
        // Media blobs are shared by reference, so the copy starts without them.
        const copy = Object.assign({}, l, { id: null, title: (l.title || l.address) + ' (copy)', photos: (l.photos || []).filter((p) => !String(p).startsWith('idb:')), video: l.video && l.video.url ? l.video : null, published: false });
        const saved = await V.store.save(copy);
        toast('Duplicated as a draft');
        location.hash = '#/edit/' + encodeURIComponent(saved.id);
      }
    });
    search.addEventListener('input', draw);
    statusF.addEventListener('change', draw);
    draw();
  }

  /* ---------- Image optimization ---------- */
  async function optimize(file) {
    if (!/^image\//.test(file.type) || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const max = 2400;
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
      return blob && blob.size < file.size ? blob : file;
    } catch (e) { return file; }
  }

  /* ---------- Editor ---------- */
  async function renderEdit(id) {
    const existing = id ? await V.store.get(id) : null;
    if (id && !existing) { toast('Listing not found'); location.hash = '#/'; return; }
    view.innerHTML = document.getElementById('tpl-edit').innerHTML;
    const form = view.querySelector('[data-form]');
    const l = existing ? JSON.parse(JSON.stringify(existing)) : { type: 'rent', status: 'available', city: 'Fayetteville', state: 'NC', published: true, featured: false, photos: [], features: [] };
    const state = { photos: (l.photos || []).slice(), features: (l.features || []).slice(), videoRef: l.video && l.video.ref || null, added: new Set() };

    view.querySelector('[data-edit-title]').innerHTML = existing ? esc(l.title || l.address) : 'New <em>listing</em>';
    if (existing) view.querySelector('[data-delete]').hidden = false;

    // Fill fields
    ['title', 'address', 'city', 'state', 'zip', 'neighborhood', 'price', 'status', 'beds', 'baths', 'sqft', 'available', 'deposit', 'leaseTerm', 'pets', 'parking', 'description', 'propertyType', 'priceUnit'].forEach((k) => {
      const el = form.elements[k];
      if (el && l[k] != null) el.value = l[k];
    });
    form.querySelectorAll('input[name="type"]').forEach((r) => { r.checked = r.value === (l.type || 'rent'); });
    if (!form.elements.priceUnit.value) form.elements.priceUnit.value = 'mo';
    form.elements.published.checked = l.published !== false;
    form.elements.featured.checked = !!l.featured;
    form.elements.videoUrl.value = (l.video && l.video.url) || '';
    form.elements.tourUrl.value = (l.tour && l.tour.url) || '';
    const vMode = state.videoRef ? 'file' : (l.video && l.video.url) ? 'url' : 'url';
    form.querySelectorAll('input[name="videoMode"]').forEach((r) => { r.checked = r.value === vMode; });

    const priceLabel = view.querySelector('[data-price-label]');
    const typeHint = view.querySelector('[data-type-hint]');
    const unitField = view.querySelector('[data-unit-field]');
    const HINTS = {
      rent: 'Residential rentals: houses, townhomes, and apartments rented month to month or on a standard lease.',
      lease: 'Longer-term or commercial leases: offices, retail, and buildings. Choose how the rate is quoted.',
      sale: 'Properties for purchase. Shows a mortgage estimate on the listing page.'
    };
    const syncType = () => {
      const t = form.querySelector('input[name="type"]:checked').value;
      unitField.hidden = t !== 'lease';
      typeHint.textContent = HINTS[t];
      const unit = form.elements.priceUnit.value;
      priceLabel.textContent = t === 'sale' ? 'List price ($)' : t === 'lease' ? ({ yr: 'Annual lease rate ($)', sfyr: 'Rate per sq ft / year ($)' })[unit] || 'Monthly lease rate ($)' : 'Monthly rent ($)';
    };
    syncType();

    /* Features */
    const tagsBox = view.querySelector('[data-tags]');
    const tagInput = view.querySelector('[data-tag-input]');
    const drawTags = () => {
      tagsBox.querySelectorAll('.ad-tag').forEach((t) => t.remove());
      state.features.forEach((f, i) => {
        const t = document.createElement('span');
        t.className = 'ad-tag';
        t.innerHTML = esc(f) + '<button type="button" aria-label="Remove ' + esc(f) + '">&times;</button>';
        t.querySelector('button').addEventListener('click', () => { state.features.splice(i, 1); drawTags(); changed(); });
        tagsBox.insertBefore(t, tagInput);
      });
    };
    tagInput.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.value.trim()) {
        e.preventDefault();
        tagInput.value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => { if (!state.features.includes(s)) state.features.push(s); });
        tagInput.value = '';
        drawTags(); changed();
      } else if (e.key === 'Backspace' && !tagInput.value && state.features.length) {
        state.features.pop(); drawTags(); changed();
      }
    });
    drawTags();

    /* Photos */
    const photoList = view.querySelector('[data-photos]');
    const photoCount = view.querySelector('[data-photo-count]');
    const drop = view.querySelector('[data-drop]');
    const photoInput = view.querySelector('[data-photo-input]');
    let dragFrom = null;

    const drawPhotos = async () => {
      photoCount.textContent = state.photos.length + (state.photos.length === 1 ? ' photo' : ' photos');
      const urls = await Promise.all(state.photos.map((p) => V.store.resolve(p)));
      photoList.innerHTML = urls.map((u, i) =>
        '<li class="ad-photo" draggable="true" data-i="' + i + '">' +
          '<img src="' + esc(u) + '" alt="Photo ' + (i + 1) + '">' +
          (i === 0 ? '<span class="tag tag--brass cover">Cover</span>' : '') +
          '<div class="ctrl">' +
            (i > 0 ? '<button type="button" data-act="cover" title="Make cover" aria-label="Make photo ' + (i + 1) + ' the cover">' + ic.star + '</button><button type="button" data-act="left" title="Move earlier" aria-label="Move photo ' + (i + 1) + ' earlier">' + ic.left + '</button>' : '') +
            '<button type="button" data-act="remove" title="Remove" aria-label="Remove photo ' + (i + 1) + '">' + ic.x + '</button>' +
          '</div></li>'
      ).join('');
      updatePreview();
    };

    photoList.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.closest('.ad-photo').dataset.i);
      if (b.dataset.act === 'remove') {
        const [ref] = state.photos.splice(i, 1);
        if (state.added.has(ref)) { await V.store.deleteMedia(ref); state.added.delete(ref); }
      } else if (b.dataset.act === 'cover') state.photos.unshift(state.photos.splice(i, 1)[0]);
      else if (b.dataset.act === 'left' && i > 0) [state.photos[i - 1], state.photos[i]] = [state.photos[i], state.photos[i - 1]];
      changed(); drawPhotos();
    });
    photoList.addEventListener('dragstart', (e) => { const li = e.target.closest('.ad-photo'); if (!li) return; dragFrom = Number(li.dataset.i); li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    photoList.addEventListener('dragend', () => { photoList.querySelectorAll('.ad-photo').forEach((li) => li.classList.remove('dragging', 'drop-target')); dragFrom = null; });
    photoList.addEventListener('dragover', (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      photoList.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
      const li = e.target.closest('.ad-photo');
      if (li) li.classList.add('drop-target');
    });
    photoList.addEventListener('drop', (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      const li = e.target.closest('.ad-photo');
      if (!li) return;
      const to = Number(li.dataset.i);
      const [moved] = state.photos.splice(dragFrom, 1);
      state.photos.splice(to, 0, moved);
      dragFrom = null;
      changed(); drawPhotos();
    });

    const addPhotos = async (files) => {
      const imgs = [...files].filter((f) => /^image\//.test(f.type));
      if (!imgs.length) return;
      const placeholders = imgs.map(() => { const li = document.createElement('li'); li.className = 'ad-photo busy'; photoList.appendChild(li); return li; });
      for (let i = 0; i < imgs.length; i++) {
        const blob = await optimize(imgs[i]);
        const ref = await V.store.putMedia(blob, imgs[i].name);
        state.added.add(ref);
        state.photos.push(ref);
        placeholders[i].remove();
      }
      changed();
      await drawPhotos();
      toast(imgs.length + (imgs.length === 1 ? ' photo added' : ' photos added'));
    };
    photoInput.addEventListener('change', () => { addPhotos(photoInput.files); photoInput.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); });

    /* Video */
    const vUrlBox = view.querySelector('[data-video-url]');
    const vFileBox = view.querySelector('[data-video-file]');
    const vPrev = view.querySelector('[data-video-preview]');
    const vInput = view.querySelector('[data-video-input]');
    const drawVideo = async () => {
      const mode = form.querySelector('input[name="videoMode"]:checked').value;
      vUrlBox.hidden = mode !== 'url';
      vFileBox.hidden = mode !== 'file';
      let inner = '';
      if (mode === 'url') {
        const e = V.embed.video(form.elements.videoUrl.value.trim());
        if (e && e.kind === 'file') inner = '<video src="' + esc(e.src) + '" controls playsinline preload="metadata"></video>';
        else if (e) inner = '<iframe src="' + esc(e.src) + '" title="Video preview" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>';
      } else if (mode === 'file' && state.videoRef) {
        inner = '<video src="' + esc(await V.store.resolve(state.videoRef)) + '" controls playsinline preload="metadata"></video>';
      }
      vPrev.innerHTML = inner;
      vPrev.hidden = !inner;
      updatePreview();
    };
    view.querySelector('[data-video-mode]').addEventListener('change', () => { changed(); drawVideo(); });
    form.elements.videoUrl.addEventListener('input', drawVideo);
    vInput.addEventListener('change', async () => {
      const f = vInput.files[0];
      if (!f) return;
      if (f.size > 500 * 1024 * 1024 && !confirm('This video is ' + Math.round(f.size / 1048576) + ' MB. Large files are slow for visitors—consider YouTube or Vimeo. Upload anyway?')) return;
      if (state.videoRef && state.added.has(state.videoRef)) await V.store.deleteMedia(state.videoRef);
      state.videoRef = await V.store.putMedia(f, f.name);
      state.added.add(state.videoRef);
      vInput.value = '';
      changed(); drawVideo();
      toast('Video added');
    });

    /* 3D tour */
    const tStatus = view.querySelector('[data-tour-status]');
    const tPrev = view.querySelector('[data-tour-preview]');
    let tourTimer;
    const drawTour = () => {
      const url = form.elements.tourUrl.value.trim();
      const t = V.embed.tour(url);
      if (!url) { tStatus.textContent = ''; tPrev.hidden = true; tPrev.innerHTML = ''; }
      else if (!t) { tStatus.textContent = 'Paste a full https:// link to the tour.'; tPrev.hidden = true; tPrev.innerHTML = ''; }
      else {
        tStatus.innerHTML = 'Detected: <strong style="color:var(--forest);font-weight:500">' + esc(t.provider) + '</strong>. If the preview stays blank, the provider may block embedding&mdash;use its &ldquo;embed&rdquo; or &ldquo;share&rdquo; link instead.';
        if (tPrev.dataset.src !== t.src) {
          tPrev.dataset.src = t.src;
          tPrev.innerHTML = '<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation" referrerpolicy="strict-origin-when-cross-origin" src="' + esc(t.src) + '" title="3D tour preview" allow="fullscreen; xr-spatial-tracking" allowfullscreen></iframe>';
        }
        tPrev.hidden = false;
      }
      updatePreview();
    };
    form.elements.tourUrl.addEventListener('input', () => { clearTimeout(tourTimer); tourTimer = setTimeout(drawTour, 500); });

    /* Map location */
    const geoStatus = view.querySelector('[data-geo-status]');
    const geoMapEl = view.querySelector('[data-geo-map]');
    const geoState = { address: l.lat ? V.fmt.fullAddress(l) : '', moved: false };
    let gL, gMap, gPin;
    const setCoords = (lat, lng) => {
      form.elements.lat.value = lat ? Number(lat).toFixed(7) : '';
      form.elements.lng.value = lng ? Number(lng).toFixed(7) : '';
      geoStatus.textContent = lat ? 'Pinned at ' + Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5) : 'Not located yet';
    };
    const placePin = async (lat, lng) => {
      try { gL = gL || await V.geo.loadLeaflet(); } catch (e) { geoMapEl.textContent = 'Map unavailable offline.'; return; }
      if (!gMap && !geoMapEl._leaflet_id) {
        gMap = gL.map(geoMapEl, { scrollWheelZoom: false }).setView([lat || 35.0527, lng || -78.8784], lat ? 17 : 12);
        V.geo.tiles(gL).addTo(gMap);
      }
      if (!gMap) return;
      if (!lat) return;
      if (!gPin) {
        gPin = gL.marker([lat, lng], { draggable: true, icon: V.geo.homeIcon(gL) }).addTo(gMap);
        gPin.on('dragend', () => { const p = gPin.getLatLng(); geoState.moved = true; setCoords(p.lat, p.lng); changed(); });
      } else gPin.setLatLng([lat, lng]);
      gMap.setView([lat, lng], 17);
    };
    const findOnMap = async () => {
      const q = V.fmt.fullAddress(collect());
      if (!form.elements.address.value.trim()) { geoStatus.textContent = 'Add a street address first'; return false; }
      geoStatus.textContent = 'Looking up address…';
      const hit = await V.geo.geocode(q).catch(() => null);
      if (!hit) { geoStatus.textContent = 'Address not found. Place the pin by dragging it.'; await placePin(35.0527, -78.8784); return false; }
      geoState.address = q;
      geoState.moved = false;
      setCoords(hit.lat, hit.lng);
      await placePin(hit.lat, hit.lng);
      changed();
      return true;
    };
    view.querySelector('[data-geo-find]').addEventListener('click', findOnMap);
    setCoords(l.lat, l.lng);
    placePin(l.lat && Number(l.lat), l.lng && Number(l.lng));

    /* Collect + preview */
    const collect = () => {
      const f = form.elements;
      const num = (v) => (v === '' || v == null ? null : Number(v));
      const mode = form.querySelector('input[name="videoMode"]:checked').value;
      const vUrl = f.videoUrl.value.trim();
      const tUrl = f.tourUrl.value.trim();
      return Object.assign({}, existing || {}, {
        id: existing ? existing.id : null,
        title: f.title.value.trim(),
        address: f.address.value.trim(),
        city: f.city.value.trim(), state: f.state.value.trim().toUpperCase(), zip: f.zip.value.trim(),
        neighborhood: f.neighborhood.value.trim(),
        type: form.querySelector('input[name="type"]:checked').value,
        propertyType: f.propertyType.value,
        priceUnit: form.querySelector('input[name="type"]:checked').value === 'lease' ? f.priceUnit.value : '',
        status: f.status.value,
        price: num(f.price.value), beds: num(f.beds.value), baths: num(f.baths.value), sqft: num(f.sqft.value),
        available: f.available.value, deposit: num(f.deposit.value),
        leaseTerm: f.leaseTerm.value.trim(), pets: f.pets.value.trim(), parking: f.parking.value.trim(),
        description: f.description.value.trim(),
        features: state.features.slice(),
        photos: state.photos.slice(),
        video: mode === 'url' && vUrl ? { url: vUrl } : mode === 'file' && state.videoRef ? { ref: state.videoRef } : null,
        tour: tUrl ? { url: tUrl } : null,
        lat: num(f.lat.value), lng: num(f.lng.value),
        published: f.published.checked,
        featured: f.featured.checked
      });
    };
    const previewBox = view.querySelector('[data-preview]');
    let pvTimer;
    function updatePreview() {
      clearTimeout(pvTimer);
      pvTimer = setTimeout(async () => {
        const d = collect();
        if (!d.address) d.address = '123 Your Street';
        previewBox.innerHTML = await V.card(d, { noLink: true });
      }, 120);
    }
    function changed() { dirty = true; updatePreview(); }
    form.addEventListener('input', (e) => { if (e.target.name === 'type') syncType(); if (e.target !== tagInput) changed(); });
    form.addEventListener('change', (e) => { if (e.target.name === 'type' || e.target.name === 'priceUnit') syncType(); });

    /* Save / delete / preview */
    const save = async () => {
      let d = collect();
      if (!d.address) { form.elements.address.focus(); form.elements.address.reportValidity(); toast('Add a street address to save'); return null; }
      // Locate new or re-addressed homes automatically unless the pin was placed by hand.
      if ((!d.lat || geoState.address !== V.fmt.fullAddress(d)) && !geoState.moved) {
        await Promise.race([findOnMap(), new Promise((r) => setTimeout(r, 5000))]);
        d = collect();
      }
      // Snapshot nearby places so visitors never wait on (or depend on) the live places service.
      const moved = !existing || d.lat !== Number(existing.lat) || d.lng !== Number(existing.lng);
      if (d.lat && d.lng && window.VerdantExplore && (moved || !(existing && existing.nearby && existing.nearby.length))) {
        toast('Saving and mapping nearby places…');
        const snap = await Promise.race([
          window.VerdantExplore.snapshot({ lat: d.lat, lng: d.lng }).catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 30000))
        ]);
        if (snap && snap.length) d.nearby = snap;
      }
      // Drop a replaced uploaded video
      if (existing && existing.video && existing.video.ref && (!d.video || d.video.ref !== existing.video.ref)) await V.store.deleteMedia(existing.video.ref);
      const removed = ((existing && existing.photos) || []).filter((p) => !d.photos.includes(p));
      await Promise.all(removed.map((p) => V.store.deleteMedia(p)));
      const saved = await V.store.save(d);
      dirty = false;
      state.added.clear();
      return saved;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saved = await save();
      if (!saved) return;
      toast(saved.published ? 'Saved & visible on the site' : 'Saved as a draft');
      if (!existing) location.hash = '#/edit/' + encodeURIComponent(saved.id);
      else view.querySelector('[data-edit-title]').textContent = saved.title || saved.address;
    });
    view.querySelector('[data-view-live]').addEventListener('click', async () => {
      const w = window.open('', '_blank');
      const saved = (dirty || !existing) ? await save() : existing;
      if (!saved) { if (w) w.close(); return; }
      const url = 'property.html?id=' + encodeURIComponent(saved.id) + '&preview=1';
      if (w) w.location = url; else location.href = url;
      if (!existing) location.hash = '#/edit/' + encodeURIComponent(saved.id);
    });
    view.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm('Delete this listing? Its photos and video will be removed too.')) return;
      await V.store.remove(existing.id);
      dirty = false;
      toast('Listing deleted');
      location.hash = '#/';
    });

    await drawPhotos();
    await drawVideo();
    drawTour();
    dirty = false;
    form.elements.address.focus({ preventScroll: true });
  }

  /* ---------- Export / import ---------- */
  document.querySelector('[data-export]').addEventListener('click', async () => {
    const json = await V.store.exportJSON();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'verdant-listings-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Exported listing details (uploaded media stays on this device)');
  });
  document.querySelector('[data-import]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { const n = await V.store.importJSON(await f.text()); toast('Imported ' + n + ' listings'); route(); }
    catch (err) { toast('Import failed: ' + err.message); }
    e.target.value = '';
  });

  route();
})();
