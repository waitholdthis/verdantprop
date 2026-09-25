// Verdant Properties — site interactions
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

    /* ---------- Header ---------- */
    const header = document.querySelector('.site-header');
    const hasHero = !!document.querySelector('.hero, .page-hero--dark, .lost');
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (header) {
        header.classList.toggle('is-solid', !hasHero || y > 40);
        header.classList.toggle('is-compact', y > 40);
        header.classList.toggle('is-hidden', y > 700 && y > lastY && !document.body.classList.contains('nav-open'));
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------- Mobile menu ---------- */
    const toggle = document.querySelector('[data-nav-toggle]');
    const menu = document.getElementById('menu');
    const setMenu = (open) => {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.toggleAttribute('inert', !open);
    };
    if (toggle && menu) {
      menu.setAttribute('inert', '');
      toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
      menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setMenu(false); });
    }

    /* ---------- Split headings into words ---------- */
    document.querySelectorAll('[data-split]').forEach((el) => {
      let i = 0;
      const walk = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const w = document.createElement('span');
              w.className = 'w';
              const inner = document.createElement('span');
              inner.style.setProperty('--i', i++);
              inner.textContent = part;
              w.appendChild(inner);
              frag.appendChild(w);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
        });
      };
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      walk(el);
      [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
      el.classList.add('splitw');
    });

    /* ---------- Reveal on scroll ---------- */
    window.VerdantReveal = (root) => {
      const els = (root || document).querySelectorAll('.reveal:not(.is-in), .reveal-mask:not(.is-in), .splitw:not(.is-in), .step:not(.is-in)');
      if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
      // A fully clipped element never reports as intersecting, so masks watch their parent.
      const targets = new Map();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          (targets.get(en.target) || []).forEach((el) => el.classList.add('is-in'));
          io.unobserve(en.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      els.forEach((el) => {
        const t = el.classList.contains('reveal-mask') ? el.parentElement : el;
        if (!targets.has(t)) targets.set(t, []);
        targets.get(t).push(el);
        io.observe(t);
      });
    };
    window.VerdantReveal();

    /* ---------- Manifesto: words brighten as you scroll ---------- */
    const scrub = document.querySelector('[data-scrub]');
    if (scrub) {
      const wrap = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const s = document.createElement('span'); s.className = 'mw'; s.textContent = part; frag.appendChild(s);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) wrap(child);
        });
      };
      wrap(scrub);
      const words = scrub.querySelectorAll('.mw');
      if (reduced) words.forEach((w) => w.classList.add('on'));
      else {
        const update = () => {
          const r = scrub.getBoundingClientRect();
          const vh = window.innerHeight;
          const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
          const n = Math.round(p * words.length);
          words.forEach((w, idx) => w.classList.toggle('on', idx < n));
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
      }
    }

    /* ---------- Parallax ---------- */
    const para = [...document.querySelectorAll('[data-parallax]')];
    if (para.length && !reduced) {
      let ticking = false;
      const run = () => {
        para.forEach((el) => {
          const r = el.parentElement.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return;
          const speed = parseFloat(el.dataset.parallax) || 0.15;
          el.style.translate = '0 ' + (-r.top * speed).toFixed(1) + 'px';
        });
        ticking = false;
      };
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
      run();
    }

    /* ---------- Rail controls ---------- */
    document.querySelectorAll('[data-rail-for]').forEach((ctrl) => {
      const rail = document.getElementById(ctrl.dataset.railFor);
      if (!rail) return;
      ctrl.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => {
        const card = rail.firstElementChild;
        const step = card ? card.getBoundingClientRect().width + 24 : 400;
        rail.scrollBy({ left: b.dataset.dir === 'next' ? step : -step, behavior: reduced ? 'auto' : 'smooth' });
      }));
    });

    /* ---------- Cursor chip ---------- */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const chip = document.createElement('div');
      chip.className = 'cursor-chip';
      chip.setAttribute('aria-hidden', 'true');
      document.body.appendChild(chip);
      document.addEventListener('pointermove', (e) => {
        chip.style.setProperty('--x', e.clientX + 'px');
        chip.style.setProperty('--y', e.clientY + 'px');
        const t = e.target.closest && e.target.closest('[data-cursor]');
        chip.classList.toggle('on', !!t);
        if (t) chip.textContent = t.dataset.cursor;
      }, { passive: true });
      document.addEventListener('pointerleave', () => chip.classList.remove('on'));
    }

    /* ---------- "Continue on your phone" QR (desktop only) ---------- */
    const desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('verdant:qr-dismissed') === '1'; } catch (e) { /* storage blocked */ }
    if (desktop.matches && !dismissed) {
      const qr = document.createElement('aside');
      qr.className = 'qr';
      qr.setAttribute('aria-label', 'Open this site on your phone');
      qr.innerHTML =
        '<div class="qr-card" id="qr-card" role="dialog" aria-labelledby="qr-title" hidden>' +
          '<button type="button" class="qr-close" data-qr-toggle aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
          '<p class="eyebrow eyebrow--plain">Take it with you</p>' +
          '<h2 class="qr-title" id="qr-title">Scan to open on your <em>phone</em></h2>' +
          '<div class="qr-code"><img src="assets/img/verdant-qr.png" width="512" height="512" alt="QR code linking to verdantprop.com" loading="lazy"></div>' +
          '<p class="qr-note">Point your phone&rsquo;s camera at the code to browse homes, save favorites, and call us on the go.</p>' +
        '</div>' +
        '<div class="qr-pill">' +
          '<button type="button" class="qr-open" data-qr-toggle aria-expanded="false" aria-controls="qr-card">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h2M20.5 14v2"/></svg>' +
            '<span>QR code</span>' +
          '</button>' +
          '<button type="button" class="qr-hide" data-qr-dismiss aria-label="Hide QR code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>' +
        '</div>';
      document.body.appendChild(qr);
      const card = qr.querySelector('.qr-card');
      const openBtn = qr.querySelector('.qr-open');
      const setOpen = (open) => {
        if (open) { card.hidden = false; requestAnimationFrame(() => qr.classList.add('is-open')); }
        else { qr.classList.remove('is-open'); setTimeout(() => { if (!qr.classList.contains('is-open')) card.hidden = true; }, 350); }
        openBtn.setAttribute('aria-expanded', String(open));
      };
      qr.querySelectorAll('[data-qr-toggle]').forEach((b) => b.addEventListener('click', () => setOpen(!qr.classList.contains('is-open'))));
      qr.querySelector('[data-qr-dismiss]').addEventListener('click', () => {
        qr.classList.add('is-gone');
        try { sessionStorage.setItem('verdant:qr-dismissed', '1'); } catch (e) { /* storage blocked */ }
        setTimeout(() => qr.remove(), 400);
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && qr.classList.contains('is-open')) { setOpen(false); openBtn.focus(); } });
      document.addEventListener('click', (e) => { if (qr.classList.contains('is-open') && !qr.contains(e.target)) setOpen(false); });
      // On pages with a full-screen hero, appear once the visitor starts exploring.
      const hero = document.querySelector('.hero');
      const showQr = () => qr.classList.toggle('is-shown', !hero || window.scrollY > window.innerHeight * 0.6);
      window.addEventListener('scroll', showQr, { passive: true });
      setTimeout(showQr, 600);
    }

    /* ---------- Featured listings on the home page ---------- */
    const featured = document.querySelector('[data-featured]');
    if (featured && window.Verdant) {
      Verdant.store.all().then(async (list) => {
        const picks = list.filter((l) => l.status !== 'leased' && l.status !== 'sold').slice(0, 8);
        if (!picks.length) {
          featured.outerHTML = '<div class="empty">' + Verdant.leaf() + '<h3>New homes are on the way.</h3><p>Join the list and we’ll reach out when the next one opens.</p><a class="btn" href="contact.html">Get notified ' + Verdant.icon.arrow + '</a></div>';
          return;
        }
        featured.innerHTML = (await Promise.all(picks.map((l) => Verdant.card(l)))).join('');
        featured.querySelectorAll('.card').forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--d', (i * 0.08) + 's'); });
        window.VerdantReveal(featured);
      });
    }

    /* ---------- Contact form → composes an email (no backend needed) ---------- */
    const form = document.querySelector('[data-contact-form]');
    if (form) {
      const params = new URLSearchParams(location.search);
      const about = params.get('about');
      if (about) {
        const msg = form.querySelector('[name="message"]');
        if (msg && !msg.value) msg.value = 'I’m interested in ' + about + '. ';
        const renter = form.querySelector('input[name="topic"][value="Renting a home"]');
        if (renter) renter.checked = true;
      }
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const status = form.querySelector('.form-status');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const d = new FormData(form);
        const name = [d.get('first'), d.get('last')].filter(Boolean).join(' ');
        const subject = 'Website inquiry — ' + (d.get('topic') || 'General') + ' — ' + name;
        const body = [
          'Name: ' + name,
          'Email: ' + (d.get('email') || ''),
          'Phone: ' + (d.get('phone') || ''),
          'Topic: ' + (d.get('topic') || ''),
          'Timeline: ' + (d.get('timeline') || ''),
          '',
          d.get('message') || ''
        ].join('\n');
        window.location.href = 'mailto:verdantprop1@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        if (status) status.textContent = 'Your email app is opening with your message ready to send. Prefer to talk? Call (910) 922-6519.';
      });
    }
  });
})();
