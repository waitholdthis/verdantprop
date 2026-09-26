/*
 * Rental scam checker. Runs entirely in the browser: the pasted text is never sent anywhere.
 * Compares an ad against Verdant's real listings and contact details, and flags the
 * warning signs the FTC and NC Attorney General list for rental scams.
 */
(function () {
  'use strict';
  const V = window.Verdant;
  const esc = V.esc;
  const OFFICIAL = {
    phones: ['9109226519'],
    emails: ['verdantprop1@gmail.com'],
    domains: ['verdantprop.com', 'waitholdthis.github.io', 'doorloop.com']
  };

  // [pattern, severity (3 = serious, 2 = warning, 1 = caution), plain-language reason]
  const SIGNS = [
    [/\b(wire|wiring)\b.{0,30}\b(money|deposit|funds|payment|transfer)|western union|moneygram/i, 3, 'Asks you to wire money. Legitimate landlords don’t take deposits by wire transfer.'],
    [/\b(zelle|cash ?app|venmo|paypal friends|apple cash|chime)\b/i, 3, 'Asks for payment through a cash app. These payments are nearly impossible to reverse.'],
    [/gift ?cards?|itunes|google play card|steam card|bitcoin|crypto|\bbtc\b|\busdt\b/i, 3, 'Mentions gift cards or cryptocurrency. No real landlord accepts these.'],
    [/(out of|outside) (the )?(country|state|town)|overseas|missionary|mission trip|deployed|working abroad|currently in (africa|europe|london|nigeria)/i, 3, 'Says the owner is away and can’t meet you. This is the most common Fort Bragg rental scam story.'],
    [/(mail|ship|send|fedex|ups)\b.{0,25}\bkeys?\b|keys?\b.{0,25}\b(mail|ship|fedex|ups)|lockbox code after/i, 3, 'Offers to mail the keys or send a lockbox code after payment.'],
    [/(can(no|')?t|unable to|not able to) (show|meet|let you (in|inside))|drive by|look (at it )?from (the )?outside|see (it )?from outside/i, 2, 'Discourages a real walk-through. Always tour inside before paying anything.'],
    [/(deposit|payment|money).{0,40}(before|prior to).{0,20}(see|view|tour|show|meet)|(hold|reserve|secure) (the |this )?(home|house|unit|place|property)/i, 2, 'Wants a deposit to hold the home before you’ve seen it or signed a lease.'],
    [/no (credit|background)( check)?|no application( fee)?|no lease needed|no paperwork/i, 2, 'Skips credit checks or a lease. Real property managers screen every applicant.'],
    [/\b(urgent|act fast|asap|immediately|first come|today only|many (people|applicants) (are )?interested|won'?t last)\b/i, 1, 'Pressures you to decide fast.'],
    [/text (me )?only|(only|just) (text|email)|don'?t call|can'?t (talk|call)/i, 1, 'Won’t talk on the phone.'],
    [/god bless|kindly|dearest|honest (and|&) god ?fearing/i, 1, 'Unusual, overly formal wording often seen in scam messages.']
  ];

  const digits = (s) => String(s).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function extract(text) {
    const phones = [...new Set((text.match(/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || []).map(digits).filter((d) => d.length === 10))];
    const emails = [...new Set((text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map((e) => e.toLowerCase()))];
    const urls = [...new Set((text.match(/\bhttps?:\/\/[^\s<>"']+|\b[\w-]+\.(com|net|org|co|io|info|biz)\b[^\s<>"']*/gi) || []))];
    const prices = [...new Set((text.match(/\$\s?\d{1,3}(,\d{3})+|\$\s?\d{3,6}|\b\d{3,4}(?=\s?(\/\s?mo|per month|a month|monthly|\/month))/gi) || [])
      .map((p) => Number(p.replace(/[^\d]/g, ''))).filter((n) => n >= 300 && n < 20000))];
    // Prices explicitly marked as monthly rent are the ones to compare with our listing price.
    const monthly = [...new Set((text.match(/\$?\s?\d{1,3}(,\d{3})*\s?(\/\s?mo(nth)?\b|per month|a month|monthly)/gi) || [])
      .map((p) => Number(p.replace(/[^\d]/g, ''))).filter((n) => n >= 300 && n < 20000))];
    return { phones, emails, urls, prices, monthly };
  }

  // Find Verdant listings mentioned in the text (house number + street name).
  function matchListings(text, listings) {
    const t = ' ' + norm(text) + ' ';
    return listings.filter((l) => {
      const a = norm(l.address);
      const m = a.match(/^(\d+)\s+([a-z]+)/);
      if (!m) return false;
      return t.includes(' ' + m[1] + ' ' + m[2]) || (l.title && t.includes(' ' + norm(l.title) + ' ') && t.includes(' ' + m[1] + ' '));
    });
  }

  function check(text, listings) {
    const found = extract(text);
    const matches = matchListings(text, listings);
    const flags = [];
    SIGNS.forEach(([re, sev, why]) => { const m = text.match(re); if (m) flags.push({ sev, why, quote: m[0] }); });
    const mentionsVerdant = /verdant|jennifer tapia|jenn tapia/i.test(text);
    const foreignPhones = found.phones.filter((p) => !OFFICIAL.phones.includes(p));
    const foreignEmails = found.emails.filter((e) => !OFFICIAL.emails.includes(e));

    if (matches.length) {
      const official = Math.min(...matches.map((l) => Number(l.price) || Infinity));
      const low = (found.monthly.length ? found.monthly : found.prices).filter((p) => isFinite(official) && p < official * 0.85);
      if (low.length) flags.push({ sev: 3, why: 'The ad’s price (' + V.fmt.money(Math.min(...low)) + ') is well below our real price (' + V.fmt.money(official) + '). Too-good-to-be-true pricing is a classic sign of a copied listing.' });
      if (foreignPhones.length) flags.push({ sev: 3, why: 'The phone number in the ad isn’t Verdant’s. Our only number is (910) 922-6519.', quote: foreignPhones.map((p) => '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6)).join(', ') });
      if (foreignEmails.length) flags.push({ sev: 3, why: 'The email address in the ad isn’t Verdant’s. We use verdantprop1@gmail.com.', quote: foreignEmails.join(', ') });
    } else if (mentionsVerdant && (foreignPhones.length || foreignEmails.length)) {
      flags.push({ sev: 3, why: 'The ad uses Verdant’s name but different contact details. Someone may be impersonating us.' });
    }

    const score = flags.reduce((s, f) => s + f.sev, 0);
    const serious = flags.some((f) => f.sev === 3);
    const level = serious || score >= 4 ? 'high' : score >= 2 ? 'caution' : matches.length ? 'match' : 'unknown';
    return { level, flags: flags.sort((a, b) => b.sev - a.sev), matches, found, mentionsVerdant };
  }

  async function render(out, res) {
    const titles = {
      high: ['Warning: this looks like a scam', 'We found serious red flags. Don’t send money or personal information.'],
      caution: ['Be careful with this one', 'Some warning signs showed up. Verify everything in person before paying.'],
      match: ['This matches a real Verdant listing', 'We didn’t spot red flags. To be certain, contact us only through the details below.'],
      unknown: ['This isn’t one of our listings', 'We didn’t spot obvious red flags, but it isn’t a Verdant home, so we can’t vouch for it.']
    };
    const [title, sub] = titles[res.level];
    const cards = res.matches.length ? (await Promise.all(res.matches.map((l) => V.card(l)))).join('') : '';
    out.innerHTML =
      '<div class="vr-verdict vr-verdict--' + res.level + '">' +
        '<p class="vr-verdict-t">' + esc(title) + '</p><p>' + esc(sub) + '</p>' +
      '</div>' +
      (res.flags.length ? '<h3 class="vr-h">What we found</h3><ul class="vr-flags" role="list">' + res.flags.map((f) =>
        '<li class="vr-flag vr-flag--' + f.sev + '"><span class="vr-sev">' + (f.sev === 3 ? 'Red flag' : f.sev === 2 ? 'Warning' : 'Caution') + '</span><p>' + esc(f.why) + (f.quote ? ' <q>' + esc(f.quote.slice(0, 80)) + '</q>' : '') + '</p></li>').join('') + '</ul>' : '') +
      (cards ? '<h3 class="vr-h">The real listing</h3><div class="grid-listings vr-cards">' + cards + '</div>' : '') +
      '<div class="vr-next"><h3 class="vr-h">Verify it with a person</h3><p>Call <a href="tel:+19109226519">(910) 922-6519</a> or email <a href="mailto:verdantprop1@gmail.com">verdantprop1@gmail.com</a>. We’ll confirm whether a home is ours in minutes.</p>' +
      (res.level === 'high' ? '<p>Report scams to the <a href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener">FTC</a> and the <a href="https://ncdoj.gov/file-a-complaint/" target="_blank" rel="noopener">NC Attorney General</a>, and flag the ad on the site where you found it.</p>' : '') +
      '</div>';
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-verify]');
    if (!form) return;
    const out = document.querySelector('[data-verify-out]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = form.elements.ad.value.trim();
      if (text.length < 8) { form.elements.ad.focus(); return; }
      const listings = await V.store.all({ includeDrafts: false });
      await render(out, check(text, listings));
    });
    form.querySelector('[data-verify-clear]').addEventListener('click', () => { form.elements.ad.value = ''; out.hidden = true; form.elements.ad.focus(); });
  });

  window.VerdantVerify = { check, extract };
})();
