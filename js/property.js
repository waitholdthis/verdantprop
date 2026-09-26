// Property detail page — gallery, video, 3D walk-through, details
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;
  const SCHEDULER = 'https://calendar.app.google/aWUisd1YZVH4zqXaA';
  const listedAgo = (t) => {
    const d = Math.floor((Date.now() - t) / 86400000);
    return d < 1 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const mount = document.querySelector('[data-property]');
    if (!mount) return;
    const id = new URLSearchParams(location.search).get('id');
    const l = id ? await V.store.get(id) : null;

    if (!l || (l.published === false && !new URLSearchParams(location.search).has('preview'))) {
      mount.innerHTML =
        '<section class="page-hero"><div class="container">' +
        '<p class="eyebrow">Residence</p><h1 class="display display--lg" style="margin-top:1.4rem">This home isn&rsquo;t <em>listed</em> right now.</h1>' +
        '<p class="lede mt-2">It may have just been leased. Browse what&rsquo;s available, or tell us what you&rsquo;re looking for.</p>' +
        '<div class="row mt-3"><a class="btn" href="listings.html">View residences ' + V.icon.arrow + '</a><a class="btn btn--ghost" href="contact.html">Contact us</a></div>' +
        '</div></section>';
      document.body.classList.remove('has-mobile-bar');
      return;
    }

    document.title = (l.title && l.title !== l.address ? l.title + ' · ' : '') + l.address + ' | Verdant Properties';
    // Keep each photo paired with its room label, even if a photo fails to load.
    const media = (await Promise.all((l.photos || []).map(async (ref) => ({ src: await V.store.resolve(ref), room: ((l.rooms || {})[ref] || '').trim() })))).filter((m) => m.src);
    const photos = media.map((m) => m.src);
    const rooms = media.map((m) => m.room);
    // One jump tab per room, in the order rooms first appear: Kitchen (3), Living room (2)...
    const roomGroups = [];
    rooms.forEach((r, i) => { if (!r) return; const key = r.toLowerCase(); const g = roomGroups.find((x) => x.key === key); if (g) g.count++; else roomGroups.push({ key, room: r, start: i, count: 1 }); });
    const full = V.fmt.fullAddress(l);
    const inquireHref = 'contact.html?about=' + encodeURIComponent(l.address);
    const statusCls = l.status === 'pending' ? 'pending' : (l.status === 'leased' || l.status === 'sold') ? 'leased' : '';

    /* ---------- Gallery ---------- */
    let gallery;
    if (!photos.length) {
      gallery = '<div class="gallery-empty reveal"><div class="ph">' + V.leaf() + '<span>Photography coming soon</span></div></div>';
    } else {
      // Photo reel: one photo at a time, shown whole over a blurred copy of itself.
      const n = photos.length;
      const pad = (i) => String(i).padStart(2, '0');
      const chev = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="' + d + '"/></svg>';
      gallery = '<div class="reel' + (n === 1 ? ' reel--single' : '') + ' reveal" data-reel>' +
        '<div class="reel-stage">' +
          '<div class="reel-track" data-reel-track tabindex="0" role="region" aria-roledescription="carousel" aria-label="Photos of ' + esc(l.address) + '">' +
            photos.map((src, i) =>
              '<button type="button" class="reel-slide" data-open="' + i + '" aria-label="' + (rooms[i] ? esc(rooms[i]) + ', photo ' : 'Photo ') + (i + 1) + ' of ' + n + ', open full screen" data-cursor="Expand">' +
                '<img class="reel-bg" src="' + esc(src) + '" alt="" aria-hidden="true"' + (i > 1 ? ' loading="lazy"' : '') + '>' +
                '<img class="reel-img" src="' + esc(src) + '" alt="' + esc(rooms[i]) + '"' + (i > 1 ? ' loading="lazy"' : '') + ' decoding="async">' +
                (rooms[i] ? '<span class="reel-room">' + esc(rooms[i]) + '</span>' : '') +
              '</button>').join('') +
          '</div>' +
          (n > 1
            ? '<button type="button" class="reel-nav reel-nav--prev" data-reel-go="-1" aria-label="Previous photo">' + chev('M15 5l-7 7 7 7') + '</button>' +
              '<button type="button" class="reel-nav reel-nav--next" data-reel-go="1" aria-label="Next photo">' + chev('M9 5l7 7-7 7') + '</button>' +
              '<p class="reel-count" aria-live="polite"><b data-reel-cur>01</b><span>/ ' + pad(n) + '</span></p>'
            : '') +
          '<button type="button" class="reel-full" data-open-current aria-label="View photos full screen">' + V.icon.expand + '<span>Full screen</span></button>' +
        '</div>' +
        (roomGroups.length > 1 ? '<div class="reel-rooms" data-reel-rooms role="tablist" aria-label="Jump to a room">' +
          roomGroups.map((g, k) => '<button type="button" role="tab" class="reel-room-tab" data-reel-to="' + g.start + '" data-group="' + k + '" aria-selected="false">' + esc(g.room) + (g.count > 1 ? '<b>' + g.count + '</b>' : '') + '</button>').join('') +
        '</div>' : '') +
        (n > 1 ? '<div class="reel-thumbs" data-reel-thumbs role="tablist" aria-label="Choose a photo">' +
          photos.map((src, i) => '<button type="button" role="tab" class="reel-thumb' + (i ? '' : ' on') + '" data-reel-to="' + i + '" aria-label="' + (rooms[i] ? esc(rooms[i]) + ', photo ' : 'Photo ') + (i + 1) + '" title="' + esc(rooms[i]) + '" aria-selected="' + !i + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>').join('') +
        '</div>' : '') +
        '</div>';
    }

    /* ---------- Media sections ---------- */
    const tour = l.tour && V.embed.tour(l.tour.url);
    const hasPano = window.VerdantTour && VerdantTour.has(l);
    const panoRooms = hasPano ? VerdantTour.scenesOf(l.pano).length : 0;
    const tourHTML = hasPano
      ? '<section class="prop-section" id="tour"><h2>3D <em style="color:var(--forest)">walk-through</em></h2>' +
        '<div class="media-frame pn-frame reveal" data-pano>' +
        '<button type="button" class="tour-launch" data-cursor="Enter"><span class="orb">' + V.icon.cube + '</span><strong>Step inside</strong><span>360&deg; tour &middot; ' + panoRooms + (panoRooms === 1 ? ' room' : ' rooms') + '</span></button>' +
        '</div><div class="reel-rooms pn-rooms" data-pano-rooms role="tablist" aria-label="Rooms in the 3D tour"></div></section>'
      : tour
      ? '<section class="prop-section" id="tour"><h2>3D <em style="color:var(--forest)">walk-through</em></h2>' +
        '<div class="media-frame reveal" data-tour="' + esc(tour.src) + '">' +
        '<button type="button" class="tour-launch" data-cursor="Enter"><span class="orb">' + V.icon.cube + '</span><strong>Step inside</strong><span>Interactive tour &middot; ' + esc(tour.provider) + '</span></button>' +
        '</div></section>'
      : '';

    let videoHTML = '';
    if (l.video) {
      let inner = '';
      if (l.video.ref) {
        const src = await V.store.resolve(l.video.ref);
        if (src) inner = '<video src="' + esc(src) + '" controls playsinline preload="metadata"' + (photos[0] ? ' poster="' + esc(photos[0]) + '"' : '') + '></video>';
      } else if (l.video.url) {
        const e = V.embed.video(l.video.url);
        if (e && e.kind === 'file') inner = '<video src="' + esc(e.src) + '" controls playsinline preload="metadata"></video>';
        else if (e) inner = '<iframe src="' + esc(e.src) + '" title="Video tour of ' + esc(l.address) + '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
      }
      if (inner) videoHTML = '<section class="prop-section" id="video"><h2>Video <em style="color:var(--forest)">tour</em></h2><div class="media-frame reveal">' + inner + '</div></section>';
    }

    const features = (l.features || []).filter(Boolean);
    const details = [
      ['Listing type', V.fmt.type(l)],
      ['Property type', V.fmt.kind(l)],
      ['Status', V.fmt.status(l.status)],
      ['Available', V.fmt.date(l.available) || (l.status === 'available' ? 'Now' : '')],
      ['Lease term', l.leaseTerm],
      ['Deposit', l.deposit ? V.fmt.money(l.deposit) : ''],
      ['Pets', l.pets],
      ['Parking', l.parking],
      ['Neighborhood', l.neighborhood],
      ['Price per sq ft', l.price && l.sqft && l.priceUnit !== 'sfyr' ? '$' + (l.price / l.sqft).toFixed(2) + (l.type === 'sale' ? '' : V.fmt.per(l).replace('/', ' / ')) : ''],
      ['Listed', l.createdAt ? listedAgo(l.createdAt) : '']
    ].filter((d) => d[1]);

    const mortgageHTML = l.type === 'sale' && l.price
      ? '<section class="prop-section" id="payment"><h2>Estimated <em style="color:var(--forest)">payment</em></h2>' +
        '<form class="calc reveal" data-calc>' +
          '<div class="calc-out"><b data-calc-total>—</b><span>per month, principal &amp; interest</span></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label for="c-price">Home price ($)</label><input id="c-price" name="price" type="number" min="0" step="1000" value="' + Number(l.price) + '"></div>' +
            '<div class="field"><label for="c-down">Down payment (%)</label><input id="c-down" name="down" type="number" min="0" max="100" step="0.5" value="10"></div>' +
            '<div class="field"><label for="c-rate">Interest rate (%)</label><input id="c-rate" name="rate" type="number" min="0" max="20" step="0.05" value="6.5"></div>' +
            '<div class="field"><label for="c-term">Loan term</label><select id="c-term" name="term"><option value="30">30 years</option><option value="20">20 years</option><option value="15">15 years</option></select></div>' +
          '</div>' +
          '<p class="form-note mt-1">An estimate only&mdash;taxes, insurance, HOA, and mortgage insurance are not included. VA loans may require no down payment; ask your lender.</p>' +
        '</form></section>'
      : '';

    mount.innerHTML =
      '<section class="prop-head"><div class="container">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="listings.html">Residences</a><span aria-hidden="true">/</span><span aria-current="page">' + esc(l.address) + '</span></nav>' +
        '<div class="prop-title-row">' +
          '<div><p class="prop-type"><span class="tag tag--' + esc(V.fmt.LISTING_TYPES[l.type] ? l.type : 'rent') + '">' + esc(V.fmt.type(l)) + '</span>' + (V.fmt.kind(l) ? '<span class="caps">' + esc(V.fmt.kind(l)) + '</span>' : '') + '</p><h1 class="display" data-split>' + esc(l.title || l.address) + '</h1>' +
          '<p class="prop-addr">' + V.icon.pin + esc(full) + '</p></div>' +
          '<div class="prop-price reveal">' +
            '<div class="prop-acts"><button type="button" class="act' + (V.saved.has(l.id) ? ' on' : '') + '" data-save="' + esc(l.id) + '" aria-pressed="' + V.saved.has(l.id) + '">' + V.icon.heart + '<span>Save</span></button>' +
            '<button type="button" class="act" data-share>' + V.icon.share + '<span>Share</span></button></div><b>' + esc(V.fmt.price(l)) + (l.price ? '<small style="font-size:.4em;color:var(--muted)">' + V.fmt.per(l) + '</small>' : '') + '</b><span>' + esc(V.fmt.priceLabel(l)) + '</span></div>' +
        '</div>' +
      '</div></section>' +
      '<div class="container">' + gallery + '</div>' +
      '<section class="section" style="padding-top:clamp(2.5rem,5vw,4rem)"><div class="container prop-body">' +
        '<div>' +
          '<div class="prop-facts reveal">' +
            '<div><b>' + V.fmt.num(l.beds) + '</b><span>Bedrooms</span></div>' +
            '<div><b>' + V.fmt.num(l.baths) + '</b><span>Bathrooms</span></div>' +
            '<div><b>' + V.fmt.num(l.sqft) + '</b><span>Square feet</span></div>' +
            '<div><b>' + (tour || hasPano ? '3D' : photos.length || '—') + '</b><span>' + (tour || hasPano ? 'Walk-through' : 'Photos') + '</span></div>' +
          '</div>' +
          '<section class="prop-section"><h2>About this <em style="color:var(--forest)">home</em></h2><p class="prop-desc reveal">' + esc(l.description || 'Contact us for details about this home.') + '</p></section>' +
          tourHTML + videoHTML +
          (features.length ? '<section class="prop-section"><h2>Features</h2><ul class="feat-grid reveal" role="list">' + features.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul></section>' : '') +
          (details.length ? '<section class="prop-section"><h2>Details</h2><dl class="detail-table reveal">' + details.map((d) => '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>').join('') + '</dl></section>' : '') +
          mortgageHTML +
          '<section class="prop-section" id="neighborhood" data-explore style="min-height:32rem"></section>' +
        '</div>' +
        '<aside class="aside-card reveal" aria-label="Schedule or inquire">' +
          '<div class="status"><span class="dot ' + statusCls + '">' + esc(V.fmt.status(l.status)) + '</span><span class="caps" style="color:var(--muted)">' + esc(V.fmt.type(l)) + '</span></div>' +
          '<h3>Tour this home</h3>' +
          '<p>See it in person, or ask for a live video walk-through if you&rsquo;re relocating.</p>' +
          '<a class="btn btn--block" href="' + SCHEDULER + '" target="_blank" rel="noopener">Schedule a showing ' + V.icon.arrow + '</a>' +
          '<a class="btn btn--ghost btn--block" href="' + inquireHref + '">Ask a question</a>' +
          '<div class="verified">' + V.icon.shield + '<span><strong style="color:var(--ink);font-weight:500">Verified listing.</strong> Managed by Verdant Properties, NC Firm #C40094. We will never ask you to wire money or pay before touring.</span></div>' +
          '<div class="aside-agent"><img src="assets/img/jenn-tapia-avatar.webp" alt="" width="54" height="54" loading="lazy"><div><strong>Jennifer Tapia</strong><a href="tel:+19109226519">(910) 922-6519</a></div></div>' +
        '</aside>' +
      '</div></section>' +
      '<section class="section bg-bone" data-similar hidden aria-labelledby="similar-title"><div class="container">' +
        '<div class="head" style="margin-bottom:clamp(2rem,4vw,3rem)"><div><p class="eyebrow">Keep looking</p><h2 class="title title--sm mt-1" id="similar-title">Similar <em>homes</em></h2></div>' +
        '<div class="head-side"><a class="link-arrow" href="listings.html">All residences ' + V.icon.arrow + '</a></div></div>' +
        '<div class="grid-listings" data-similar-grid></div>' +
      '</div></section>' +
      '<div class="mobile-bar"><div><b>' + esc(V.fmt.price(l)) + '</b><span class="caps" style="color:var(--muted);margin-left:.3rem">' + V.fmt.per(l) + '</span></div><a class="btn btn--sm" href="' + SCHEDULER + '" target="_blank" rel="noopener">Schedule a showing</a></div>';

    // Split-word heading + reveal
    const h1 = mount.querySelector('[data-split]');
    if (h1) {
      h1.innerHTML = h1.textContent.split(/\s+/).map((w, i) => '<span class="w" aria-hidden="true"><span style="--i:' + i + '">' + esc(w) + '</span></span>').join(' ');
      h1.setAttribute('aria-label', l.title || l.address);
      h1.classList.add('splitw');
    }
    window.VerdantReveal && window.VerdantReveal(mount);

    /* ---------- Save + share ---------- */
    const shareBtn = mount.querySelector('[data-share]');
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const data = { title: document.title, text: (l.title || l.address) + ' — ' + V.fmt.price(l) + V.fmt.per(l), url: location.href.replace(/[?&]preview=1/, '') };
      if (navigator.share) { try { await navigator.share(data); } catch (e) { /* dismissed */ } return; }
      try { await navigator.clipboard.writeText(data.url); shareBtn.querySelector('span').textContent = 'Link copied'; setTimeout(() => { shareBtn.querySelector('span').textContent = 'Share'; }, 2200); }
      catch (e) { prompt('Copy this link:', data.url); }
    });

    /* ---------- Mortgage estimate (for-sale homes) ---------- */
    const calc = mount.querySelector('[data-calc]');
    if (calc) {
      const run = () => {
        const f = calc.elements;
        const P = Number(f.price.value) * (1 - Number(f.down.value) / 100);
        const r = Number(f.rate.value) / 100 / 12;
        const n = Number(f.term.value) * 12;
        const pay = r ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
        calc.querySelector('[data-calc-total]').textContent = isFinite(pay) && pay > 0 ? V.fmt.money(Math.round(pay)) : '—';
      };
      calc.addEventListener('input', run);
      calc.addEventListener('submit', (e) => e.preventDefault());
      run();
    }

    /* ---------- Neighborhood explorer ---------- */
    const exSection = mount.querySelector('[data-explore]');
    V.geo.locate(l).then((home) => {
      if (home && window.VerdantExplore) window.VerdantExplore.lazy(exSection, l, home);
      else exSection.innerHTML = '<h2>Location</h2><div class="map-frame"><iframe title="Map of ' + esc(full) + '" loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(full) + '&z=15&output=embed"></iframe></div>';
    });

    /* ---------- Similar homes ---------- */
    V.store.all().then(async (all) => {
      const others = all.filter((x) => x.id !== l.id && x.status !== 'leased' && x.status !== 'sold' && x.type === l.type)
        .map((x) => ({ x, score: Math.abs((x.price || 0) - (l.price || 0)) / 100 + Math.abs((x.beds || 0) - (l.beds || 0)) * 4 }))
        .sort((a, b) => a.score - b.score).slice(0, 3).map((o) => o.x);
      if (!others.length) return;
      const wrap = mount.querySelector('[data-similar]');
      wrap.querySelector('[data-similar-grid]').innerHTML = (await Promise.all(others.map((x) => V.card(x)))).join('');
      wrap.hidden = false;
    });

    /* ---------- 360° tour (Pannellum) loads on demand ---------- */
    const pf = mount.querySelector('[data-pano]');
    if (pf) pf.querySelector('.tour-launch').addEventListener('click', () => VerdantTour.mount(pf, l, mount.querySelector('[data-pano-rooms]')));

    /* ---------- 3D tour loads on demand ---------- */
    const tf = mount.querySelector('[data-tour]');
    if (tf) tf.querySelector('.tour-launch').addEventListener('click', () => {
      tf.innerHTML = '<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation" referrerpolicy="strict-origin-when-cross-origin" src="' + esc(tf.dataset.tour) + '" title="3D walk-through of ' + esc(l.address) + '" allow="fullscreen; xr-spatial-tracking; vr; gyroscope; accelerometer" allowfullscreen></iframe>';
    });

    /* ---------- Photo reel ---------- */
    const reel = mount.querySelector('[data-reel]');
    let reelIndex = 0;
    let reelGo = null;
    if (reel) {
      const track = reel.querySelector('[data-reel-track]');
      const slides = [...track.children];
      const thumbs = reel.querySelector('[data-reel-thumbs]');
      const cur = reel.querySelector('[data-reel-cur]');
      const roomBar = reel.querySelector('[data-reel-rooms]');
      const go = (i, smooth) => {
        i = Math.max(0, Math.min(slides.length - 1, i));
        track.scrollTo({ left: slides[i].offsetLeft, behavior: smooth === false || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      };
      const mark = (i) => {
        if (i === reelIndex && reel.dataset.ready) return;
        reel.dataset.ready = '1';
        reelIndex = i;
        if (cur) cur.textContent = String(i + 1).padStart(2, '0');
        reel.querySelectorAll('[data-reel-go="-1"]').forEach((b) => { b.disabled = i === 0; });
        reel.querySelectorAll('[data-reel-go="1"]').forEach((b) => { b.disabled = i === slides.length - 1; });
        if (roomBar) {
          roomBar.querySelectorAll('.reel-room-tab').forEach((t, k) => { const on = (rooms[i] || '').toLowerCase() === roomGroups[k].key; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); if (on) roomBar.scrollTo({ left: t.offsetLeft - (roomBar.clientWidth - t.clientWidth) / 2, behavior: 'smooth' }); });
        }
        if (thumbs) {
          thumbs.querySelectorAll('.reel-thumb').forEach((t, j) => { t.classList.toggle('on', j === i); t.setAttribute('aria-selected', String(j === i)); });
          const t = thumbs.children[i];
          // Scroll only the thumbnail strip, never the page.
          if (t) thumbs.scrollTo({ left: t.offsetLeft - (thumbs.clientWidth - t.clientWidth) / 2, behavior: 'smooth' });
        }
      };
      let raf;
      track.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => mark(Math.round(track.scrollLeft / track.clientWidth)));
      }, { passive: true });
      reel.querySelectorAll('[data-reel-go]').forEach((b) => b.addEventListener('click', () => go(reelIndex + Number(b.dataset.reelGo))));
      [thumbs, roomBar].forEach((bar) => bar && bar.addEventListener('click', (e) => { const t = e.target.closest('[data-reel-to]'); if (t) go(Number(t.dataset.reelTo)); }));
      track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(reelIndex + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(reelIndex - 1); }
      });
      window.addEventListener('resize', () => go(reelIndex, false));
      reelGo = go;
      mark(0);
    }

    /* ---------- Lightbox ---------- */
    const lb = document.querySelector('[data-lightbox]');
    if (!lb || !photos.length) return;
    const img = lb.querySelector('[data-lb-img]');
    const countEl = lb.querySelector('[data-lb-count]');
    const thumbs = lb.querySelector('[data-lb-thumbs]');
    thumbs.innerHTML = photos.map((src, i) => '<button type="button" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>').join('');
    let cur = 0;
    let lastFocus = null;
    const show = (i) => {
      cur = (i + photos.length) % photos.length;
      img.src = photos[cur];
      img.alt = (rooms[cur] ? rooms[cur] + ', ' : '') + 'photo ' + (cur + 1) + ' of ' + l.address;
      countEl.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(photos.length).padStart(2, '0') + (rooms[cur] ? '  ·  ' + rooms[cur].toUpperCase() : '');
      thumbs.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === cur));
      const t = thumbs.children[cur];
      if (t) t.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    const open = (i) => { lastFocus = document.activeElement; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('open')); document.body.style.overflow = 'hidden'; show(i); lb.querySelector('[data-lb-close]').focus(); };
    const close = () => { if (reelGo) reelGo(cur, false); lb.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { lb.hidden = true; }, 400); if (lastFocus) lastFocus.focus(); };
    mount.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.open))));
    mount.querySelectorAll('[data-open-current]').forEach((b) => b.addEventListener('click', () => open(reelIndex)));
    lb.querySelector('[data-lb-close]').addEventListener('click', close);
    lb.querySelectorAll('.lightbox-nav').forEach((b) => b.addEventListener('click', () => show(cur + (b.dataset.dir === 'next' ? 1 : -1))));
    thumbs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(Number(b.dataset.i)); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
    });
    let sx = null;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
  });
})();
