/*
 * BAH match: compares each rental's rent to the visitor's Basic Allowance for Housing.
 *
 * 2026 rates for Military Housing Area NC182 (Fort Bragg / Fayetteville, NC), effective
 * January 1, 2026. Cross-checked against CollegeRecon, MilMultiplier, and VeteranPCS on
 * 2026-09-26. Rates change every January 1: update RATES and YEAR from the DoD BAH
 * calculator (travel.dod.mil) each year.
 */
(function () {
  'use strict';
  const V = window.Verdant;
  const YEAR = 2026;
  const MHA = 'NC182';
  // [with dependents, without dependents], monthly USD
  const RATES = {
    'E-1': [1722, 1341], 'E-2': [1722, 1341], 'E-3': [1722, 1341], 'E-4': [1722, 1341],
    'E-5': [1806, 1527], 'E-6': [2049, 1638], 'E-7': [2094, 1722], 'E-8': [2142, 1860], 'E-9': [2244, 1923],
    'W-1': [2067, 1707], 'W-2': [2112, 1857], 'W-3': [2178, 1935], 'W-4': [2271, 2052], 'W-5': [2391, 2103],
    'O-1E': [2097, 1803], 'O-2E': [2166, 1908], 'O-3E': [2289, 2040],
    'O-1': [1842, 1635], 'O-2': [2046, 1782], 'O-3': [2175, 1956], 'O-4': [2427, 2088], 'O-5': [2610, 2109], 'O-6': [2628, 2154], 'O-7': [2646, 2190]
  };
  const GROUPS = [
    ['Enlisted', ['E-1', 'E-2', 'E-3', 'E-4', 'E-5', 'E-6', 'E-7', 'E-8', 'E-9']],
    ['Warrant officer', ['W-1', 'W-2', 'W-3', 'W-4', 'W-5']],
    ['Officer', ['O-1', 'O-2', 'O-3', 'O-4', 'O-5', 'O-6', 'O-7']],
    ['Prior-enlisted officer', ['O-1E', 'O-2E', 'O-3E']]
  ];
  const KEY = 'verdant:bah';

  const bah = {
    YEAR, MHA,
    get() {
      try { const v = JSON.parse(localStorage.getItem(KEY)); return v && RATES[v.grade] ? v : null; } catch (e) { return null; }
    },
    set(v) {
      try { if (v && RATES[v.grade]) localStorage.setItem(KEY, JSON.stringify({ grade: v.grade, deps: !!v.deps })); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
      document.dispatchEvent(new CustomEvent('verdant:bah', { detail: bah.get() }));
    },
    rate(v) { v = v || bah.get(); return v && RATES[v.grade] ? RATES[v.grade][v.deps ? 0 : 1] : null; },
    // Monthly rent a listing can be compared against BAH, or null (sales, annual/per-sq-ft leases).
    monthly(l) {
      if (!l || !l.price || l.type === 'sale') return null;
      if (l.type === 'lease' && l.priceUnit && l.priceUnit !== 'mo') return null;
      return Number(l.price);
    },
    // { fits, diff } where diff = BAH − rent (positive means money left over).
    match(l, v) {
      const rate = bah.rate(v), rent = bah.monthly(l);
      if (rate == null || rent == null) return null;
      return { fits: rent <= rate, diff: rate - rent, rate, rent };
    },
    // Grade <select> options, grouped.
    options(selected) {
      return '<option value="">Pay grade</option>' + GROUPS.map(([label, grades]) =>
        '<optgroup label="' + label + '">' + grades.map((g) => '<option value="' + g + '"' + (g === selected ? ' selected' : '') + '>' + g + '</option>').join('') + '</optgroup>').join('');
    },
    // Compact result line used on cards.
    badge(l) {
      const m = bah.match(l);
      if (!m) return '';
      return m.fits
        ? '<p class="bah-line bah-line--fit">' + V.icon.shield + 'Within your BAH &middot; <b>' + V.fmt.money(m.diff) + '/mo</b> to spare</p>'
        : '<p class="bah-line bah-line--over">' + V.fmt.money(-m.diff) + '/mo over your BAH</p>';
    },
    // Reusable picker: grade + dependents. `onChange` runs after the saved choice changes.
    picker(id) {
      const v = bah.get() || {};
      return '<div class="bah-picker">' +
        '<label class="sr-only" for="' + id + '-grade">Pay grade</label>' +
        '<select id="' + id + '-grade" data-bah-grade>' + bah.options(v.grade) + '</select>' +
        '<label class="bah-deps"><input type="checkbox" data-bah-deps' + (v.deps !== false ? ' checked' : '') + '> With dependents</label>' +
      '</div>';
    },
    bind(root) {
      const g = root.querySelector('[data-bah-grade]'), d = root.querySelector('[data-bah-deps]');
      if (!g) return;
      const sync = () => bah.set(g.value ? { grade: g.value, deps: d.checked } : null);
      g.addEventListener('change', sync);
      d.addEventListener('change', () => { if (g.value) sync(); });
      document.addEventListener('verdant:bah', (e) => {
        const v = e.detail || {};
        if (g.value !== (v.grade || '')) g.value = v.grade || '';
        if (v.grade) d.checked = !!v.deps;
      });
    }
  };

  V.bah = bah;
})();
