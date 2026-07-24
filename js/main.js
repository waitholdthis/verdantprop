// Verdant Properties — premium behavior
document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) { year.textContent = new Date().getFullYear(); }

  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mobileNav = document.getElementById('primary-nav');
  const navLinks = mobileNav ? mobileNav.querySelectorAll('a') : [];

  const open = () => {
    mobileNav.hidden = false;
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
  };
  const close = () => {
    mobileNav.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  };

  navToggle && navToggle.addEventListener('click', () => (mobileNav.hidden ? open() : close()));
  navLinks.forEach((link) => link.addEventListener('click', () => { if (!mobileNav.hidden) close(); }));

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach((el) => observer.observe(el));

  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const out = {};
      data.forEach((value, key) => (out[key] = value));
      console.info('Verdant contact submission:', out);
      alert('Thanks — this is a demo form. Wire it to your backend or form service to go live.');
    });
  }
});
