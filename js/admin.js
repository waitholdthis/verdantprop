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
      [count((l) => (l.tour && l.tour.url) || (window.VerdantTour && VerdantTour.has(l))), 'With 3D tours']
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
        if ((l.tour && l.tour.url) || (window.VerdantTour && VerdantTour.has(l))) badges.push('<span class="ad-badge">3D</span>');
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
    const state = { rooms: Object.assign({}, l.rooms), photos: (l.photos || []).slice(), features: (l.features || []).slice(), videoRef: l.video && l.video.ref || null, added: new Set() };

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
        '<li class="ad-photo" data-i="' + i + '">' +
          '<div class="ad-photo-img" draggable="true">' +
            '<img src="' + esc(u) + '" alt="Photo ' + (i + 1) + '">' +
            (i === 0 ? '<span class="tag tag--brass cover">Cover</span>' : '') +
            '<div class="ctrl">' +
              (i > 0 ? '<button type="button" data-act="cover" title="Make cover" aria-label="Make photo ' + (i + 1) + ' the cover">' + ic.star + '</button><button type="button" data-act="left" title="Move earlier" aria-label="Move photo ' + (i + 1) + ' earlier">' + ic.left + '</button>' : '') +
              '<button type="button" data-act="remove" title="Remove" aria-label="Remove photo ' + (i + 1) + '">' + ic.x + '</button>' +
            '</div>' +
          '</div>' +
          '<input class="ad-room" data-room list="room-list" maxlength="40" placeholder="Room" aria-label="Room shown in photo ' + (i + 1) + '" value="' + esc(state.rooms[state.photos[i]] || '') + '">' +
        '</li>'
      ).join('');
      updatePreview();
    };

    photoList.addEventListener('input', (e) => {
      if (!e.target.matches('[data-room]')) return;
      const ref = state.photos[Number(e.target.closest('.ad-photo').dataset.i)];
      const v = e.target.value.trim();
      if (v) state.rooms[ref] = v; else delete state.rooms[ref];
      changed();
    });
    photoList.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.closest('.ad-photo').dataset.i);
      if (b.dataset.act === 'remove') {
        const [ref] = state.photos.splice(i, 1);
        delete state.rooms[ref];
        if (state.added.has(ref)) { await V.store.deleteMedia(ref); state.added.delete(ref); }
      } else if (b.dataset.act === 'cover') state.photos.unshift(state.photos.splice(i, 1)[0]);
      else if (b.dataset.act === 'left' && i > 0) [state.photos[i - 1], state.photos[i]] = [state.photos[i], state.photos[i - 1]];
      changed(); drawPhotos();
    });
    photoList.addEventListener('dragstart', (e) => { const li = e.target.closest('.ad-photo'); if (!li || !e.target.closest('.ad-photo-img')) return; dragFrom = Number(li.dataset.i); li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
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

    /* 360° tour builder (Pannellum) */
    const T = window.VerdantTour;
    const pano = { scenes: JSON.parse(JSON.stringify((l.pano && l.pano.scenes) || [])), first: (l.pano && l.pano.first) || null };
    const panoAdded = new Set();
    const tourModeBox = view.querySelector('[data-tour-mode]');
    const tourUrlBox = view.querySelector('[data-tour-url]');
    const tourPanoBox = view.querySelector('[data-tour-pano]');
    const sceneList = view.querySelector('[data-pano-scenes]');
    const editor = view.querySelector('[data-pano-editor]');
    const viewEl = view.querySelector('[data-pano-view]');
    const editingEl = view.querySelector('[data-pano-editing]');
    const doorTo = view.querySelector('[data-pano-door-to]');
    const doorList = view.querySelector('[data-pano-doors]');
    const panoMsg = view.querySelector('[data-pano-msg]');
    let pv = null;
    let current = null;
    const initialMode = pano.scenes.length ? 'pano' : (l.tour && l.tour.url) ? 'url' : 'none';
    form.querySelectorAll('input[name="tourMode"]').forEach((r) => { r.checked = r.value === initialMode; });
    const tourMode = () => form.querySelector('input[name="tourMode"]:checked').value;
    const syncTourMode = () => {
      const m = tourMode();
      tourUrlBox.hidden = m !== 'url';
      tourPanoBox.hidden = m !== 'pano';
      if (m === 'pano' && pano.scenes.length && !pv) openScene(current || pano.first || pano.scenes[0].id);
    };
    tourModeBox.addEventListener('change', () => { changed(); syncTourMode(); });

    const nameOf = (id) => { const i = pano.scenes.findIndex((s) => s.id === id); return i < 0 ? '' : T.roomName(pano.scenes[i], i); };

    const drawScenes = async () => {
      if (!pano.scenes.length) { sceneList.innerHTML = ''; editor.hidden = true; if (pv) { pv.destroy(); pv = null; } return; }
      if (!pano.scenes.some((s) => s.id === pano.first)) pano.first = pano.scenes[0].id;
      const urls = await T.resolveUrls(pano);
      sceneList.innerHTML = pano.scenes.map((s, i) =>
        '<li class="ad-scene' + (s.id === current ? ' on' : '') + '" data-scene="' + esc(s.id) + '">' +
          '<button type="button" class="ad-scene-thumb" data-scene-open aria-label="Edit ' + esc(T.roomName(s, i)) + '"><img src="' + esc(urls[s.id]) + '" alt=""><span>' + (i + 1) + '</span></button>' +
          '<input class="ad-room" data-scene-room list="room-list" maxlength="40" placeholder="Room name" aria-label="Room name for 360 photo ' + (i + 1) + '" value="' + esc(s.room || '') + '">' +
          '<div class="ad-scene-meta">' +
            '<label class="ad-start"><input type="radio" name="panoFirst" value="' + esc(s.id) + '"' + (s.id === pano.first ? ' checked' : '') + '> Tour starts here</label>' +
            '<span class="ad-hint">' + (s.hotspots || []).length + ' door' + ((s.hotspots || []).length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="ad-scene-acts">' +
            (i > 0 ? '<button type="button" class="ad-icon-btn" data-scene-up title="Move earlier" aria-label="Move ' + esc(T.roomName(s, i)) + ' earlier">' + ic.left + '</button>' : '') +
            '<button type="button" class="ad-icon-btn ad-icon-btn--danger" data-scene-del title="Remove" aria-label="Remove ' + esc(T.roomName(s, i)) + '">' + ic.trash + '</button>' +
          '</div>' +
        '</li>').join('');
    };

    const drawDoors = () => {
      const s = pano.scenes.find((x) => x.id === current);
      if (!s) return;
      editingEl.textContent = 'Editing: ' + nameOf(s.id);
      const others = pano.scenes.filter((x) => x.id !== s.id);
      doorTo.innerHTML = others.length ? others.map((x) => '<option value="' + esc(x.id) + '">To ' + esc(nameOf(x.id)) + '</option>').join('') : '<option value="">Add another room first</option>';
      doorTo.disabled = !others.length;
      view.querySelector('[data-pano-add-door]').disabled = !others.length;
      doorList.innerHTML = (s.hotspots || []).map((h, k) =>
        '<li><span>Door to <b>' + esc(nameOf(h.to)) + '</b></span><button type="button" class="ad-link-btn" data-door-look="' + k + '">Show</button><button type="button" class="ad-link-btn" data-door-move="' + k + '" title="Move this door to the crosshair">Move here</button><button type="button" class="ad-link-btn" data-door-del="' + k + '">Remove</button></li>').join('');
    };

    // Rebuild the preview viewer (cheap: panoramas are cached as blob URLs).
    async function openScene(id, keepView) {
      current = id;
      const s = pano.scenes.find((x) => x.id === id);
      if (!s) return;
      editor.hidden = false;
      let pn;
      try { pn = await T.load(); } catch (e) { panoMsg.textContent = 'The 360° viewer could not load. Check your connection.'; return; }
      const view0 = keepView && pv ? { yaw: pv.getYaw(), pitch: pv.getPitch(), hfov: pv.getHfov() } : null;
      if (pv) { pv.destroy(); pv = null; }
      const urls = await T.resolveUrls(pano);
      pv = pn.viewer(viewEl, T.config(pano, urls, { first: id, defaults: { mouseZoom: true } }));
      pv.on('scenechange', (sid) => { current = sid; drawDoors(); sceneList.querySelectorAll('.ad-scene').forEach((li) => li.classList.toggle('on', li.dataset.scene === sid)); });
      if (view0) pv.on('load', function once() { pv.off('load', once); pv.lookAt(view0.pitch, view0.yaw, view0.hfov, false); });
      sceneList.querySelectorAll('.ad-scene').forEach((li) => li.classList.toggle('on', li.dataset.scene === id));
      drawDoors();
    }

    // Resize large panoramas so they fit in phone GPU memory (4096px is the safe limit).
    async function preparePano(file) {
      const bmp = await createImageBitmap(file);
      const ratio = bmp.width / bmp.height;
      const w = Math.min(4096, bmp.width);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.round(w / ratio);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return { blob, ratio };
    }
    const addPanos = async (files) => {
      const imgs = [...files].filter((f) => /^image\//.test(f.type));
      if (!imgs.length) return;
      let skipped = 0;
      panoMsg.textContent = 'Preparing ' + imgs.length + (imgs.length === 1 ? ' photo…' : ' photos…');
      for (const f of imgs) {
        let prepared;
        try { prepared = await preparePano(f); } catch (e) { skipped++; continue; }
        if (Math.abs(prepared.ratio - 2) > 0.15) { skipped++; continue; }
        const ref = await V.store.putMedia(prepared.blob, f.name);
        panoAdded.add(ref);
        const guess = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\b(img|pano|dsc|r0|\d{3,})\b/gi, '').trim();
        pano.scenes.push({ id: V.uid('sc'), room: guess.length > 2 && guess.length < 40 ? guess.charAt(0).toUpperCase() + guess.slice(1) : '', ref, yaw: 0, pitch: 0, hfov: 100, hotspots: [] });
      }
      changed();
      await drawScenes();
      if (pano.scenes.length) await openScene(current && pano.scenes.some((s) => s.id === current) ? current : pano.scenes[pano.scenes.length - 1].id);
      panoMsg.textContent = skipped
        ? skipped + (skipped === 1 ? ' photo was' : ' photos were') + ' skipped: 360° photos must be about twice as wide as they are tall (2:1).'
        : 'Drag the preview until the crosshair is on a doorway, then add a door.';
      toast(skipped ? 'Some photos were not 360° panoramas' : '360° photos added');
    };
    const panoInput = view.querySelector('[data-pano-input]');
    const panoDrop = view.querySelector('[data-pano-drop]');
    panoInput.addEventListener('change', () => { addPanos(panoInput.files); panoInput.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => panoDrop.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); panoDrop.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach((ev) => panoDrop.addEventListener(ev, () => panoDrop.classList.remove('over')));
    panoDrop.addEventListener('drop', (e) => { e.preventDefault(); addPanos(e.dataTransfer.files); });

    sceneList.addEventListener('input', (e) => {
      if (!e.target.matches('[data-scene-room]')) return;
      const s = pano.scenes.find((x) => x.id === e.target.closest('.ad-scene').dataset.scene);
      s.room = e.target.value.trim();
      changed();
      if (s.id === current) drawDoors();
    });
    sceneList.addEventListener('change', (e) => {
      if (e.target.name === 'panoFirst') { pano.first = e.target.value; changed(); }
      if (e.target.matches('[data-scene-room]')) openScene(current, true); // refresh door labels
    });
    sceneList.addEventListener('click', async (e) => {
      const li = e.target.closest('.ad-scene');
      if (!li) return;
      const id = li.dataset.scene;
      const i = pano.scenes.findIndex((x) => x.id === id);
      if (e.target.closest('[data-scene-open]')) { openScene(id); return; }
      if (e.target.closest('[data-scene-up]') && i > 0) {
        [pano.scenes[i - 1], pano.scenes[i]] = [pano.scenes[i], pano.scenes[i - 1]];
        changed(); await drawScenes(); return;
      }
      if (e.target.closest('[data-scene-del]')) {
        if (!confirm('Remove this room from the tour? Doors leading to it will be removed too.')) return;
        const [gone] = pano.scenes.splice(i, 1);
        pano.scenes.forEach((s) => { s.hotspots = (s.hotspots || []).filter((h) => h.to !== gone.id); });
        if (panoAdded.has(gone.ref)) { await V.store.deleteMedia(gone.ref); panoAdded.delete(gone.ref); }
        if (current === gone.id) current = null;
        changed(); await drawScenes();
        if (pano.scenes.length) openScene(current || pano.scenes[0].id);
      }
    });

    // Doors go exactly where the crosshair points (clamped so they never float at the ceiling).
    const aim = () => ({ yaw: +pv.getYaw().toFixed(2), pitch: +Math.max(-45, Math.min(25, pv.getPitch())).toFixed(2) });
    const angleGap = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
    // Two doors closer than ~14° overlap on screen.
    const nearDoor = (s, spot, skip) => (s.hotspots || []).find((h, k) => k !== skip && angleGap(h.yaw, spot.yaw) < 14 && Math.abs(h.pitch - spot.pitch) < 14);

    view.querySelector('[data-pano-setview]').addEventListener('click', () => {
      const s = pano.scenes.find((x) => x.id === current);
      if (!s || !pv) return;
      s.yaw = +pv.getYaw().toFixed(2); s.pitch = +pv.getPitch().toFixed(2); s.hfov = +pv.getHfov().toFixed(1);
      changed();
      toast('Starting angle saved for ' + nameOf(s.id));
    });
    view.querySelector('[data-pano-add-door]').addEventListener('click', () => {
      const s = pano.scenes.find((x) => x.id === current);
      if (!s || !pv || !doorTo.value) return;
      s.hotspots = s.hotspots || [];
      const spot = aim();
      const clash = nearDoor(s, spot, -1);
      if (clash) { panoMsg.textContent = 'There’s already a door to ' + nameOf(clash.to) + ' at the crosshair. Turn toward a different doorway, or use “Move here” on a door in the list.'; toast('Turn toward a different doorway first'); return; }
      s.hotspots.push(Object.assign({ to: doorTo.value }, spot));
      changed();
      drawScenes();
      openScene(current, true);
      panoMsg.textContent = 'Drag the preview until the crosshair is on a doorway, then add a door.'; toast('Door to ' + nameOf(doorTo.value) + ' added');
    });
    doorList.addEventListener('click', (e) => {
      const s = pano.scenes.find((x) => x.id === current);
      const del = e.target.closest('[data-door-del]');
      const look = e.target.closest('[data-door-look]');
      if (del) { s.hotspots.splice(Number(del.dataset.doorDel), 1); changed(); drawScenes(); openScene(current, true); }
      if (look && pv) { const h = s.hotspots[Number(look.dataset.doorLook)]; pv.lookAt(h.pitch, h.yaw, 90, 800); }
      const move = e.target.closest('[data-door-move]');
      if (move && pv) {
        const k = Number(move.dataset.doorMove);
        const spot = aim();
        const clash = nearDoor(s, spot, k);
        if (clash) { toast('That spot already has a door to ' + nameOf(clash.to)); return; }
        Object.assign(s.hotspots[k], spot);
        changed(); openScene(current, true);
        panoMsg.textContent = 'Drag the preview until the crosshair is on a doorway, then add a door.'; toast('Door to ' + nameOf(s.hotspots[k].to) + ' moved');
      }
    });

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

    /* Nearby places (OpenStreetMap snapshot) */
    const nb = { items: (l.nearby || []).slice(), hidden: new Set(l.nearbyHidden || []), refreshed: false };
    const nbList = view.querySelector('[data-nb-list]');
    const nbStatus = view.querySelector('[data-nb-status]');
    const drawNearby = () => {
      const X = window.VerdantExplore;
      if (!nb.items.length) { nbList.innerHTML = '<p class="ad-hint">No places saved yet. They’re collected when you save the listing, or click Refresh.</p>'; return; }
      nbList.innerHTML = X.CATS.map((c) => {
        const items = nb.items.filter((p) => p.cat === c.key);
        if (!items.length) return '';
        return '<fieldset><legend>' + esc(c.label) + '</legend>' + items.map((p) => {
          const closed = X.isClosed(p);
          return '<label class="ad-nb-item' + (closed ? ' is-closed' : '') + '"><input type="checkbox" data-nb-name="' + esc(p.name) + '"' + (!closed && !nb.hidden.has(p.name) ? ' checked' : '') + (closed ? ' disabled' : '') + '> <span>' + esc(p.name) + '</span>' + (closed ? '<em>Closed</em>' : '') + '</label>';
        }).join('') + '</fieldset>';
      }).join('');
    };
    nbList.addEventListener('change', (e) => {
      const n = e.target.dataset.nbName;
      if (!n) return;
      if (e.target.checked) nb.hidden.delete(n); else nb.hidden.add(n);
      changed();
    });
    view.querySelector('[data-nb-refresh]').addEventListener('click', async (e) => {
      const btn = e.currentTarget; // currentTarget is cleared once the click finishes
      const lat = Number(form.elements.lat.value), lng = Number(form.elements.lng.value);
      if (!lat || !lng) { nbStatus.textContent = 'Place the map pin first.'; return; }
      btn.disabled = true;
      nbStatus.textContent = 'Getting the latest places from OpenStreetMap…';
      const snap = await window.VerdantExplore.snapshot({ lat, lng }).catch(() => null);
      btn.disabled = false;
      if (!snap) { nbStatus.textContent = 'OpenStreetMap didn’t respond. Try again in a minute.'; return; }
      nb.items = snap; nb.refreshed = true;
      nbStatus.textContent = 'Updated: ' + snap.length + ' places. Uncheck any that have closed, then save.';
      changed(); drawNearby();
    });

    /* Google Street View */
    const svState = { custom: l.streetView && !l.streetView.off && isFinite(l.streetView.lat) ? l.streetView : null };
    const svStatus = view.querySelector('[data-sv-status]');
    const svPrev = view.querySelector('[data-sv-preview]');
    const svBody = view.querySelector('[data-sv-body]');
    form.elements.svOn.checked = !(l.streetView && l.streetView.off);
    let svTimer;
    const drawSV = () => {
      const on = form.elements.svOn.checked;
      svBody.hidden = !on;
      if (!on) { svPrev.innerHTML = ''; return; }
      const text = form.elements.svLink.value.trim();
      const parsed = text ? V.streetView.parse(text) : null;
      if (text && !parsed) {
        svStatus.textContent = /goo\.gl|maps\.app/.test(text)
          ? 'Short share links can’t be read. Open the link, then copy the full address from your browser’s address bar.'
          : 'That doesn’t look like a Street View link. Follow the steps below.';
        return;
      }
      const lat = Number(form.elements.lat.value), lng = Number(form.elements.lng.value);
      const v = parsed || svState.custom || (lat && lng ? { lat, lng, heading: 0, pitch: 0, fov: 75 } : null);
      if (!v) { svStatus.textContent = 'Place the map pin first; Street View starts from there.'; svPrev.hidden = true; return; }
      svStatus.innerHTML = parsed ? 'Link read: facing ' + Math.round(v.heading) + '&deg;. Save to use this view.'
        : svState.custom ? 'Using your saved angle (facing ' + Math.round(v.heading) + '&deg;). <button type="button" class="ad-link-btn" data-sv-reset>Reset to map pin</button>'
        : 'Showing the street nearest the map pin, facing north. Paste a link to aim it at the home.';
      const src = V.streetView.embed(v);
      if (svPrev.dataset.src !== src) {
        svPrev.dataset.src = src;
        svPrev.innerHTML = '<iframe src="' + esc(src) + '" title="Street View preview" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
      }
      svPrev.hidden = false;
    };
    form.elements.svLink.addEventListener('input', () => { clearTimeout(svTimer); svTimer = setTimeout(drawSV, 400); });
    form.elements.svOn.addEventListener('change', drawSV);
    view.querySelector('.ad-sv').addEventListener('click', (e) => { if (e.target.closest('[data-sv-reset]')) { svState.custom = null; changed(); drawSV(); } });

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
        rooms: Object.fromEntries(state.photos.filter((p) => state.rooms[p]).map((p) => [p, state.rooms[p]])),
        video: mode === 'url' && vUrl ? { url: vUrl } : mode === 'file' && state.videoRef ? { ref: state.videoRef } : null,
        tour: tourMode() === 'url' && tUrl ? { url: tUrl } : null,
        pano: tourMode() === 'pano' && pano.scenes.length ? JSON.parse(JSON.stringify({ first: pano.first || pano.scenes[0].id, scenes: pano.scenes })) : null,
        lat: num(f.lat.value), lng: num(f.lng.value),
        nearby: nb.items.slice(),
        nearbyHidden: [...nb.hidden],
        streetView: !f.svOn.checked ? { off: true } : (V.streetView.parse(f.svLink.value) || svState.custom || null),
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
      if (d.lat && d.lng && window.VerdantExplore && !nb.refreshed && (moved || !nb.items.length)) {
        toast('Saving and mapping nearby places…');
        const snap = await Promise.race([
          window.VerdantExplore.snapshot({ lat: d.lat, lng: d.lng }).catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 30000))
        ]);
        if (snap && snap.length) { d.nearby = snap; nb.items = snap; drawNearby(); }
      }
      // Record drive times to each Fort Bragg gate (shown on cards and the property page).
      if (d.lat && d.lng && window.VerdantExplore && (moved || !(d.gates && d.gates.length))) {
        const gt = await Promise.race([window.VerdantExplore.gateTimes({ lat: d.lat, lng: d.lng }).catch(() => null), new Promise((r) => setTimeout(() => r(null), 20000))]);
        if (gt && gt.length) d.gates = gt;
      }
      // Record the FEMA flood zone for this location (kept with the listing, like nearby places).
      if (d.lat && d.lng && (moved || !d.flood)) {
        const fz = await Promise.race([V.flood.lookup(d.lat, d.lng).catch(() => null), new Promise((r) => setTimeout(() => r(null), 20000))]);
        if (fz) d.flood = fz;
      }
      // Drop a replaced uploaded video
      if (existing && existing.video && existing.video.ref && (!d.video || d.video.ref !== existing.video.ref)) await V.store.deleteMedia(existing.video.ref);
      const keptPano = new Set(((d.pano && d.pano.scenes) || []).map((sc) => sc.ref));
      const oldPano = ((existing && existing.pano && existing.pano.scenes) || []).map((sc) => sc.ref);
      const removed = ((existing && existing.photos) || []).filter((p) => !d.photos.includes(p)).concat(oldPano.filter((r) => !keptPano.has(r)), [...panoAdded].filter((r) => !keptPano.has(r)));
      await Promise.all(removed.map((p) => V.store.deleteMedia(p)));
      const saved = await V.store.save(d);
      dirty = false;
      state.added.clear();
      panoAdded.clear();
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
    await drawScenes();
    syncTourMode();
    drawSV();
    drawNearby();
    dirty = false;
    form.elements.address.focus({ preventScroll: true });
  }

  /* ---------- Export / import ---------- */
  document.querySelector('[data-export-bundle]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    toast('Packaging listings, photos, and tours…');
    try {
      const json = await V.store.exportBundle();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'verdant-publish-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Downloaded (' + (json.length / 1048576).toFixed(1) + ' MB). Put it in the project folder to publish.');
    } catch (err) { toast('Export failed: ' + err.message); }
    btn.disabled = false;
  });
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
