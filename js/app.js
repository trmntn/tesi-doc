(function () {
  const { SYMPTOMS, CATEGORIES, AGE_GROUPS, DISEASES, EMERGENCY_NUMBERS } = window.KKB_DATA;
  const C = window.Community;
  let main = document.getElementById('main');
  const symptomById = Object.fromEntries(SYMPTOMS.map(s => [s.id, s]));
  const diseaseById = Object.fromEntries(DISEASES.map(d => [d.id, d]));
  const AVATARS = ['🐻', '🦊', '🐰', '🦉', '🐢', '🐝', '🦔', '🐳', '🌻', '🌈', '🍀', '⭐'];

  /* ---------- Helfer ---------- */

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = s => String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  function highlight(text, terms) {
    let out = esc(text);
    if (!terms || !terms.length) return out;
    const re = new RegExp('(' + terms.map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return out.replace(re, '<mark>$1</mark>');
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(qs || '');
    return { parts, params };
  }

  function setQuery(params) {
    const { parts } = parseHash();
    const qs = params.toString();
    history.replaceState(null, '', '#/' + parts.join('/') + (qs ? '?' + qs : ''));
  }

  function timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
    return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } }

  /* ---------- Suche ---------- */

  function fieldsFor(d, scope) {
    const symptomLabels = d.symptoms.map(id => symptomById[id]?.label || '');
    const f = [];
    if (scope === 'alles' || scope === 'krankheit') {
      f.push([d.name, 10], [d.aliases.join(' '), 8], [d.summary, 3], [d.causes, 2]);
    }
    if (scope === 'alles' || scope === 'symptome') {
      f.push([symptomLabels.join(' '), 6], [d.signs.join(' '), 4]);
    }
    if (scope === 'alles' || scope === 'behandlung') {
      f.push([d.care.join(' '), 4], [d.treatment, 3], [d.prevention, 2]);
    }
    if (scope === 'alles') {
      f.push([d.doctor.join(' ') + ' ' + d.emergency.join(' '), 1], [d.kita, 1]);
    }
    return f.map(([t, w]) => [norm(t), w]);
  }

  function searchDiseases(query, scope = 'alles') {
    const terms = norm(query).split(/\s+/).filter(t => t.length > 1);
    if (!terms.length) return DISEASES.map(d => ({ d, score: 0 }));
    const results = [];
    for (const d of DISEASES) {
      const fields = fieldsFor(d, scope);
      let score = 0;
      let all = true;
      for (const t of terms) {
        let ts = 0;
        for (const [text, w] of fields) if (text.includes(t)) ts += w;
        if (!ts) { all = false; break; }
        score += ts;
      }
      if (all) results.push({ d, score });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /* ---------- Bausteine ---------- */

  function categoryTag(d) {
    const c = CATEGORIES[d.category];
    return `<span class="tag tag-${c.color}">${esc(c.label)}</span>`;
  }

  function contagiousTag(d) {
    if (d.contagious === true) return '<span class="tag tag-danger">ansteckend</span>';
    if (d.contagious === false) return '<span class="tag tag-sage">nicht ansteckend</span>';
    return '';
  }

  function diseaseCard(d, opts = {}) {
    const terms = opts.terms || [];
    const extra = opts.match
      ? `<div><small class="muted"><strong>${opts.match.count} von ${opts.match.total}</strong> gewählten Symptomen passen</small>
           <div class="match-bar" aria-hidden="true"><span style="width:${Math.round(opts.match.count / opts.match.total * 100)}%"></span></div></div>`
      : '';
    return `
      <a class="card disease-card" href="#/krankheit/${d.id}">
        <div class="row"><span class="emoji" aria-hidden="true">${d.emoji}</span><span class="spacer"></span>${contagiousTag(d)}</div>
        <h3>${highlight(d.name, terms)}</h3>
        <p>${highlight(d.summary, terms)}</p>
        ${extra}
        <div class="card-tags">${categoryTag(d)}</div>
      </a>`;
  }

  function emergencyBox() {
    return `
      <div class="emergency">
        <h3><span aria-hidden="true">🚑</span> Im Notfall</h3>
        <div class="emergency-list">
          ${EMERGENCY_NUMBERS.map(n => `
            <div class="emergency-item">
              ${/\d/.test(n.number) ? `<a href="tel:${n.number.replace(/\s/g, '')}"><strong>${esc(n.number)}</strong></a>` : `<strong>${esc(n.number)}</strong>`}
              <span>${esc(n.label)}</span>
              <small>${esc(n.note)}</small>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function disclaimer(text) {
    return `
      <div class="disclaimer" role="note">
        <span class="icon" aria-hidden="true">💛</span>
        <p>${text || '<strong>Kein medizinischer Rat.</strong> Diese Seite bietet allgemeine Informationen auf Basis gut recherchierter Webquellen. Sie kann keine Untersuchung ersetzen. Du kennst dein Kind am besten – wenn du dir Sorgen machst, ruf deine Kinderarztpraxis an.'}</p>
      </div>`;
  }

  function avatar(u, cls = '') {
    return `<span class="avatar ${cls}" aria-hidden="true">${esc(u?.avatar || '👤')}</span>`;
  }

  /* ---------- Seiten ---------- */

  function viewHome() {
    const quick = ['fieber', 'husten', 'ausschlag', 'durchfall', 'ohrenschmerzen', 'bellender-husten', 'mund-blaeschen', 'juckreiz'];
    const featured = ['fieber', 'magen-darm', 'hand-fuss-mund', 'pseudokrupp', 'mittelohrentzuendung', 'windpocken'].map(id => diseaseById[id]);
    const counts = {};
    DISEASES.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
    const icons = { atemwege: '🫁', bauch: '🍵', haut: '🌸', kinderkrankheit: '🧸', allgemein: '🍼' };

    main.innerHTML = `
      <section class="hero">
        <div class="container hero-grid">
          <div>
            <span class="eyebrow">💛 Für Eltern mit kleinen Kindern</span>
            <h1>Wenn die Kleinen krank sind, <em>bist du nicht allein.</em></h1>
            <p class="hero-lead">Verständliche Informationen zu ${DISEASES.length} häufigen Kinderkrankheiten – mit Tipps für zu Hause, klaren Warnzeichen und einer Community von Eltern, die das auch schon erlebt haben.</p>
            <form class="search-box" id="homeSearch" role="search">
              <span aria-hidden="true">🔎</span>
              <label class="sr-only" for="homeQ">Suche</label>
              <input id="homeQ" type="search" placeholder="z. B. Fieber, Bläschen im Mund, Wadenwickel …" autocomplete="off">
              <button class="btn" type="submit">Suchen</button>
            </form>
            <div class="search-scope" aria-label="Häufige Symptome">
              ${quick.map(id => `<a class="chip" href="#/symptome?s=${id}">${esc(symptomById[id].label)}</a>`).join('')}
            </div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div>
            <span class="hero-emoji" style="left:18%;top:22%">🧸</span>
            <span class="hero-emoji" style="left:56%;top:44%">🩹</span>
            <span class="hero-emoji" style="left:22%;top:62%">🌡️</span>
          </div>
        </div>
      </section>

      <section>
        <div class="container">${disclaimer()}</div>
      </section>

      <section>
        <div class="container">
          <div class="section-head">
            <div><h2>Wonach suchst du?</h2><p>Drei Wege, schnell die passende Information zu finden.</p></div>
          </div>
          <div class="grid grid-3">
            <a class="card disease-card" href="#/symptome">
              <span class="emoji" aria-hidden="true">🧩</span>
              <h3>Symptom-Finder</h3>
              <p>Wähle aus, was du bei deinem Kind beobachtest, und sieh, welche Krankheiten dazu passen könnten.</p>
            </a>
            <a class="card disease-card" href="#/bibliothek?scope=behandlung">
              <span class="emoji" aria-hidden="true">🫖</span>
              <h3>Was hilft zu Hause?</h3>
              <p>Durchsuche Pflegetipps und Behandlungshinweise – von Nasentropfen bis Trinklösung.</p>
            </a>
            <a class="card disease-card" href="#/community">
              <span class="emoji" aria-hidden="true">🤝</span>
              <h3>Erfahrungen teilen</h3>
              <p>Lies, wie andere Eltern eine Krankheit erlebt haben, und erzähl von deinen eigenen Erfahrungen.</p>
            </a>
          </div>
        </div>
      </section>

      <section>
        <div class="container">
          <div class="section-head"><div><h2>Themenbereiche</h2></div><a href="#/bibliothek">Alle ansehen →</a></div>
          <div class="grid grid-cats">
            ${Object.entries(CATEGORIES).map(([id, c]) => `
              <a class="cat-tile bg-${c.color}" href="#/bibliothek?cat=${id}">
                <span style="font-size:1.8rem" aria-hidden="true">${icons[id]}</span>
                ${esc(c.label)}
                <span>${counts[id] || 0} Themen</span>
              </a>`).join('')}
          </div>
        </div>
      </section>

      <section>
        <div class="container">
          <div class="section-head"><div><h2>Häufig gesucht</h2><p>Was Eltern kleiner Kinder am meisten beschäftigt.</p></div></div>
          <div class="grid grid-3">${featured.map(d => diseaseCard(d)).join('')}</div>
        </div>
      </section>

      <section>
        <div class="container">${emergencyBox()}</div>
      </section>`;

    document.getElementById('homeSearch').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('homeQ').value.trim();
      location.hash = '#/bibliothek' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  function viewLibrary(params) {
    const state = {
      q: params.get('q') || '',
      scope: params.get('scope') || 'alles',
      cat: params.get('cat') || '',
      age: params.get('age') || ''
    };
    const scopes = { alles: 'Alles', krankheit: 'Krankheit', symptome: 'Symptome', behandlung: 'Behandlung & Pflege' };

    main.innerHTML = `
      <section>
        <div class="container">
          <h1>Bibliothek</h1>
          <p class="muted" style="max-width:40em">Alle Themen auf einen Blick. Suche nach einer Krankheit, einem Symptom oder einer Behandlung – oder filtere nach Bereich und Alter.</p>
          <div class="filters">
            <form class="search-box" role="search" id="libSearch">
              <span aria-hidden="true">🔎</span>
              <label class="sr-only" for="libQ">Suchbegriff</label>
              <input id="libQ" type="search" value="${esc(state.q)}" placeholder="Suchbegriff eingeben …" autocomplete="off">
            </form>
            <div>
              <div class="filter-label">Suchen in</div>
              <div class="chip-row" id="scopeChips">
                ${Object.entries(scopes).map(([k, v]) => `<button type="button" class="chip" data-scope="${k}" aria-pressed="${state.scope === k}">${v}</button>`).join('')}
              </div>
            </div>
            <div>
              <div class="filter-label">Bereich</div>
              <div class="chip-row" id="catChips">
                <button type="button" class="chip" data-cat="" aria-pressed="${!state.cat}">Alle</button>
                ${Object.entries(CATEGORIES).map(([k, c]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${state.cat === k}">${esc(c.label)}</button>`).join('')}
              </div>
            </div>
            <div>
              <div class="filter-label">Alter</div>
              <div class="chip-row" id="ageChips">
                <button type="button" class="chip" data-age="" aria-pressed="${!state.age}">Alle</button>
                ${Object.entries(AGE_GROUPS).map(([k, v]) => `<button type="button" class="chip" data-age="${k}" aria-pressed="${state.age === k}">${esc(v)}</button>`).join('')}
              </div>
            </div>
          </div>
          <div id="libResults" aria-live="polite"></div>
        </div>
      </section>`;

    const input = document.getElementById('libQ');

    function renderResults() {
      let results = searchDiseases(state.q, state.scope);
      if (state.cat) results = results.filter(r => r.d.category === state.cat);
      if (state.age) results = results.filter(r => r.d.ages.includes(state.age));
      if (!state.q) results.sort((a, b) => a.d.name.localeCompare(b.d.name, 'de'));
      const terms = state.q.split(/\s+/).filter(t => t.length > 1);
      const box = document.getElementById('libResults');
      box.innerHTML = results.length
        ? `<div class="result-count">${results.length} ${results.length === 1 ? 'Thema' : 'Themen'}</div>
           <div class="grid grid-3">${results.map(r => diseaseCard(r.d, { terms })).join('')}</div>`
        : `<div class="empty card"><span class="big" aria-hidden="true">🍂</span>
             <p>Dazu haben wir leider nichts gefunden.</p>
             <p>Versuch es mit einem anderen Begriff oder nutze den <a href="#/symptome">Symptom-Finder</a>.</p></div>`;
      const p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.scope !== 'alles') p.set('scope', state.scope);
      if (state.cat) p.set('cat', state.cat);
      if (state.age) p.set('age', state.age);
      setQuery(p);
    }

    input.addEventListener('input', () => { state.q = input.value; renderResults(); });
    document.getElementById('libSearch').addEventListener('submit', e => e.preventDefault());

    function bindChips(containerId, attr, key) {
      document.getElementById(containerId).addEventListener('click', e => {
        const b = e.target.closest('button[data-' + attr + ']');
        if (!b) return;
        state[key] = b.dataset[attr];
        document.querySelectorAll('#' + containerId + ' button').forEach(x => x.setAttribute('aria-pressed', x === b));
        renderResults();
      });
    }
    bindChips('scopeChips', 'scope', 'scope');
    bindChips('catChips', 'cat', 'cat');
    bindChips('ageChips', 'age', 'age');

    renderResults();
    if (state.q) input.focus();
  }

  function viewSymptoms(params) {
    const selected = new Set((params.get('s') || '').split(',').filter(id => symptomById[id]));
    let age = params.get('age') || '';
    const groups = {};
    SYMPTOMS.forEach(s => { (groups[s.group] = groups[s.group] || []).push(s); });

    main.innerHTML = `
      <section>
        <div class="container">
          <h1>Symptom-Finder</h1>
          <p class="muted" style="max-width:42em">Wähle die Beschwerden aus, die du bei deinem Kind beobachtest. Wir zeigen dir, welche Themen in unserer Bibliothek dazu passen. <strong>Das ist keine Diagnose</strong> – nur eine Orientierung, wo du weiterlesen kannst.</p>
          <div class="symptom-layout">
            <div class="card">
              <div class="row" style="margin-bottom:12px">
                <h3 style="margin:0">Was beobachtest du?</h3><span class="spacer"></span>
                <button type="button" class="btn btn-ghost btn-small" id="clearSymptoms">Zurücksetzen</button>
              </div>
              ${Object.entries(groups).map(([g, list]) => `
                <div class="symptom-group">
                  <h4>${esc(g)}</h4>
                  <div class="chip-row">
                    ${list.map(s => `<button type="button" class="chip" data-symptom="${s.id}" aria-pressed="${selected.has(s.id)}">${esc(s.label)}</button>`).join('')}
                  </div>
                </div>`).join('')}
              <div class="symptom-group">
                <h4>Alter des Kindes (optional)</h4>
                <div class="chip-row" id="symAge">
                  <button type="button" class="chip" data-age="" aria-pressed="${!age}">Egal</button>
                  ${Object.entries(AGE_GROUPS).map(([k, v]) => `<button type="button" class="chip" data-age="${k}" aria-pressed="${age === k}">${esc(v)}</button>`).join('')}
                </div>
              </div>
            </div>
            <div class="sticky stack" id="symResults" aria-live="polite"></div>
          </div>
        </div>
      </section>`;

    function render() {
      const box = document.getElementById('symResults');
      const urgent = ['krampf', 'atemnot'].filter(id => selected.has(id));
      const urgentBox = urgent.length ? `
        <div class="card card-danger">
          <h3>⚠️ Bitte zuerst prüfen</h3>
          <p style="margin:0">Atemnot, bläuliche Lippen, ein Krampfanfall, der länger als 5 Minuten dauert, oder ein kaum ansprechbares Kind sind Notfälle: <a href="tel:112"><strong>112 anrufen</strong></a>.</p>
        </div>` : '';

      if (!selected.size) {
        box.innerHTML = `
          <div class="card empty"><span class="big" aria-hidden="true">🧩</span>
            <p>Wähle links ein oder mehrere Symptome aus.</p></div>
          ${disclaimer()}`;
      } else {
        const total = selected.size;
        let results = DISEASES
          .map(d => ({ d, count: d.symptoms.filter(s => selected.has(s)).length }))
          .filter(r => r.count > 0);
        if (age) results = results.filter(r => r.d.ages.includes(age));
        results.sort((a, b) => b.count - a.count || (a.d.symptoms.length - b.d.symptoms.length));
        box.innerHTML = `
          ${urgentBox}
          <div class="result-count">${results.length ? `${results.length} passende Themen` : 'Keine passenden Themen'}</div>
          ${results.length
            ? `<div class="grid">${results.slice(0, 10).map(r => diseaseCard(r.d, { match: { count: r.count, total } })).join('')}</div>`
            : '<div class="card empty"><p>Für diese Kombination haben wir kein passendes Thema. Sprich bei Unsicherheit mit deiner Kinderarztpraxis.</p></div>'}
          ${disclaimer('<strong>Keine Diagnose.</strong> Viele Krankheiten haben ähnliche Symptome, und die Liste ist nicht vollständig. Achte vor allem auf das Allgemeinbefinden deines Kindes und auf die Warnzeichen auf den Themenseiten.')}`;
      }
      const p = new URLSearchParams();
      if (selected.size) p.set('s', [...selected].join(','));
      if (age) p.set('age', age);
      setQuery(p);
    }

    main.addEventListener('click', function onClick(e) {
      const b = e.target.closest('button[data-symptom]');
      if (b) {
        const id = b.dataset.symptom;
        if (selected.has(id)) selected.delete(id); else selected.add(id);
        b.setAttribute('aria-pressed', selected.has(id));
        render();
        return;
      }
      const a = e.target.closest('#symAge button[data-age]');
      if (a) {
        age = a.dataset.age;
        document.querySelectorAll('#symAge button').forEach(x => x.setAttribute('aria-pressed', x === a));
        render();
      }
    });
    document.getElementById('clearSymptoms').addEventListener('click', () => {
      selected.clear();
      document.querySelectorAll('[data-symptom]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      render();
    });
    render();
  }

  function listHTML(items, cls = '') {
    return `<ul class="check-list ${cls}">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  async function viewDisease(id) {
    const d = diseaseById[id];
    if (!d) return viewNotFound();
    const posts = await C.listPosts({ diseaseId: d.id });
    const related = DISEASES
      .filter(x => x.id !== d.id)
      .map(x => ({ x, n: x.symptoms.filter(s => d.symptoms.includes(s)).length }))
      .filter(r => r.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);

    const section = (badge, title, body, cls = '') => `
      <div class="card detail-section ${cls}">
        <h2><span class="badge" aria-hidden="true">${badge}</span>${title}</h2>
        ${body}
      </div>`;

    main.innerHTML = `
      <div class="container">
        <a class="back-link" href="#/bibliothek">← Zur Bibliothek</a>
        <div class="detail-hero">
          <span class="emoji" aria-hidden="true">${d.emoji}</span>
          <div>
            <h1>${esc(d.name)}</h1>
            ${d.aliases.length ? `<div class="aliases">Auch: ${esc(d.aliases.join(', '))}</div>` : ''}
            <div class="row" style="margin-top:8px">${categoryTag(d)} ${contagiousTag(d)} ${d.ages.map(a => `<span class="tag">${esc(AGE_GROUPS[a])}</span>`).join(' ')}</div>
          </div>
        </div>
        <p class="lead">${esc(d.summary)}</p>

        <div class="detail-layout">
          <div>
            ${section('👀', 'Woran erkenne ich es?', listHTML(d.signs) + `
              <div class="chip-row" style="margin-top:12px">${d.symptoms.map(s => `<a class="chip" href="#/symptome?s=${s}">${esc(symptomById[s].label)}</a>`).join('')}</div>`)}
            ${section('🔬', 'Ursachen & Verlauf', `<p>${esc(d.causes)}</p><p style="margin:0"><strong>Dauer:</strong> ${esc(d.duration)}</p>`)}
            ${section('🫖', 'Was du zu Hause tun kannst', listHTML(d.care))}
            ${section('💊', 'Medizinische Behandlung', `<p style="margin:0">${esc(d.treatment)}</p>`)}
            ${section('🩺', 'Wann zur Kinderarztpraxis?', listHTML(d.doctor, 'warn-list'), 'card-warn')}
            ${d.emergency.length ? section('🚑', 'Sofort Hilfe holen (112)', listHTML(d.emergency, 'danger-list'), 'card-danger') : ''}
            ${section('🏡', 'Kita & Ansteckung', `<p style="margin:0">${esc(d.kita)}</p>`)}
            ${d.prevention && d.prevention !== '—' ? section('🛡️', 'Vorbeugung', `<p style="margin:0">${esc(d.prevention)}</p>`) : ''}
            ${section('📚', 'Quellen & weiterlesen', `<ul class="sources">${d.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
              <p class="muted" style="margin:0;font-size:.9rem">Inhalte zusammengefasst nach diesen Quellen. Stand: 2026.</p>`)}

            <div class="card detail-section">
              <div class="row" style="margin-bottom:10px">
                <h2 style="margin:0"><span class="badge" aria-hidden="true">💬</span>Erfahrungen aus der Community</h2>
                <span class="spacer"></span>
                <a class="btn btn-soft btn-small" href="#/community?krankheit=${d.id}&neu=1">Erfahrung teilen</a>
              </div>
              ${posts.length
                ? posts.slice(0, 3).map(p => `
                    <div class="comment">
                      ${avatar(p.author)}
                      <div><a href="#/community?krankheit=${d.id}"><strong>${esc(p.title)}</strong></a>
                      <p class="muted">${esc(p.author?.displayName || 'Gelöschtes Konto')} · ${timeAgo(p.createdAt)}</p></div>
                    </div>`).join('') + `<p style="margin:10px 0 0"><a href="#/community?krankheit=${d.id}">Alle ${posts.length} Beiträge ansehen →</a></p>`
                : '<p class="muted" style="margin:0">Noch keine Erfahrungsberichte. Magst du den ersten schreiben?</p>'}
            </div>
          </div>

          <aside class="detail-aside stack">
            <div class="card">
              <h3>Auf einen Blick</h3>
              <div class="facts">
                <div class="fact"><b>Dauer</b>${esc(d.duration)}</div>
                <div class="fact"><b>Ansteckend</b>${d.contagious === true ? 'Ja' : d.contagious === false ? 'Nein' : 'Abhängig von der Ursache'}</div>
                <div class="fact"><b>Typisches Alter</b>${esc(d.ages.map(a => AGE_GROUPS[a]).join(', '))}</div>
              </div>
            </div>
            ${disclaimer()}
            ${emergencyBox()}
            ${related.length ? `<div class="card"><h3>Ähnliche Themen</h3><ul class="check-list">${related.map(r => `<li><a href="#/krankheit/${r.x.id}">${esc(r.x.name)}</a></li>`).join('')}</ul></div>` : ''}
          </aside>
        </div>
      </div>`;
  }

  /* ---------- Community ---------- */

  function postHTML(p, me) {
    const d = p.diseaseId ? diseaseById[p.diseaseId] : null;
    const hearted = me && p.hearts.includes(me.id);
    return `
      <article class="card post" data-post="${p.id}">
        <div class="post-head">
          ${avatar(p.author)}
          <div class="meta">
            ${p.author ? `<a href="#/nutzer/${p.author.id}">${esc(p.author.displayName)}</a>` : '<strong>Gelöschtes Konto</strong>'}
            <small>${timeAgo(p.createdAt)}${p.childAge ? ' · Kind: ' + esc(AGE_GROUPS[p.childAge] || p.childAge) : ''}</small>
          </div>
          <span class="spacer"></span>
          ${me && p.userId === me.id ? '<button type="button" class="btn btn-ghost btn-small" data-action="delete">Löschen</button>' : ''}
        </div>
        <h3>${esc(p.title)}</h3>
        <div class="row">
          ${d ? `<a class="tag tag-apricot" href="#/krankheit/${d.id}">${d.emoji} ${esc(d.name)}</a>` : ''}
          ${p.symptoms.map(s => symptomById[s] ? `<span class="tag">${esc(symptomById[s].label)}</span>` : '').join('')}
        </div>
        <div class="post-body">${esc(p.body)}</div>
        <div class="post-actions">
          <button type="button" class="btn ${hearted ? '' : 'btn-ghost'} btn-small" data-action="heart" aria-pressed="${!!hearted}">${hearted ? '💛' : '🤍'} Hilfreich · ${p.hearts.length}</button>
          <span class="muted" style="font-size:.9rem">💬 ${p.comments.length} ${p.comments.length === 1 ? 'Antwort' : 'Antworten'}</span>
        </div>
        <div>
          ${p.comments.map(c => {
            const a = C.commentAuthor(c.userId);
            return `<div class="comment">${avatar(a)}<div>
              <strong>${a ? `<a href="#/nutzer/${a.id}" style="color:inherit;text-decoration:none">${esc(a.displayName)}</a>` : 'Gelöschtes Konto'}</strong>
              <small class="muted"> · ${timeAgo(c.createdAt)}</small>
              <p>${esc(c.body)}</p></div></div>`;
          }).join('')}
          ${me ? `
            <form class="row" data-action="comment" style="margin-top:10px">
              <label class="sr-only" for="c-${p.id}">Antwort schreiben</label>
              <input class="input" id="c-${p.id}" name="body" placeholder="Antwort schreiben …" style="flex:1;min-width:180px" maxlength="1500">
              <button class="btn btn-small" type="submit">Senden</button>
            </form>` : ''}
        </div>
      </article>`;
  }

  function newPostForm(preDisease) {
    return `
      <form class="card form" id="newPost">
        <h3 style="margin:0">Deine Erfahrung teilen</h3>
        <div class="field">
          <label for="npTitle">Titel</label>
          <input class="input" id="npTitle" name="title" maxlength="120" required placeholder="z. B. Drei Nächte Pseudokrupp – was uns geholfen hat">
        </div>
        <div class="field">
          <label for="npDisease">Krankheit / Thema</label>
          <select class="input" id="npDisease" name="diseaseId">
            <option value="">– Allgemein / unklar –</option>
            ${DISEASES.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(d => `<option value="${d.id}" ${d.id === preDisease ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="npAge">Alter deines Kindes</label>
          <select class="input" id="npAge" name="childAge">
            <option value="">– keine Angabe –</option>
            ${Object.entries(AGE_GROUPS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <span style="font-weight:800;font-size:.92rem">Symptome (optional)</span>
          <div class="chip-row" id="npSymptoms">
            ${SYMPTOMS.map(s => `<button type="button" class="chip" data-symptom="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label for="npBody">Deine Erfahrung</label>
          <textarea class="input" id="npBody" name="body" maxlength="4000" required placeholder="Was habt ihr erlebt? Was hat geholfen, was nicht? Wie lange hat es gedauert?"></textarea>
          <small>Bitte keine Namen, Adressen oder Fotos von Kindern. Teile Erfahrungen – keine Diagnosen oder Dosierungsempfehlungen.</small>
        </div>
        <div class="form-error" id="npError" role="alert"></div>
        <div class="row">
          <button class="btn" type="submit">Veröffentlichen</button>
          <button class="btn btn-ghost" type="button" id="npCancel">Abbrechen</button>
        </div>
      </form>`;
  }

  async function viewCommunity(params) {
    const me = C.currentUser();
    const filter = params.get('krankheit') || '';
    const showForm = params.get('neu') === '1' && me;
    const posts = await C.listPosts({ diseaseId: filter || undefined });
    const stats = C.stats();

    main.innerHTML = `
      <section>
        <div class="container">
          <h1>Community</h1>
          <p class="muted" style="max-width:42em">Ein Ort für Eltern, um Erfahrungen zu teilen: Wie lange hat das Fieber gedauert? Was hat beim Pseudokrupp geholfen? Hier geht es um gegenseitige Unterstützung – nicht um medizinische Ratschläge.</p>
          <div class="community-layout">
            <aside class="stack">
              <div class="card">
                ${me ? `
                  <div class="post-head">${avatar(me)}<div class="meta"><a href="#/profil">${esc(me.displayName)}</a><small>Dein Profil ansehen</small></div></div>
                  <button class="btn" type="button" id="toggleForm" style="width:100%;margin-top:14px">✏️ Erfahrung teilen</button>`
                : `
                  <h3>Mach mit!</h3>
                  <p class="muted">Melde dich an, um ein Profil anzulegen, Erfahrungen zu teilen und anderen Eltern zu antworten.</p>
                  <a class="btn" href="#/profil" style="width:100%">Anmelden / Registrieren</a>`}
              </div>
              <div class="card">
                <label class="filter-label" for="filterDisease" style="display:block">Nach Thema filtern</label>
                <select class="input" id="filterDisease">
                  <option value="">Alle Themen</option>
                  ${DISEASES.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(d => `<option value="${d.id}" ${d.id === filter ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
                </select>
              </div>
              <div class="card">
                <h3>Unsere Regeln</h3>
                <ul class="check-list" style="font-size:.93rem">
                  <li>Freundlich und respektvoll bleiben</li>
                  <li>Erfahrungen teilen, keine Diagnosen stellen</li>
                  <li>Keine Medikamenten-Dosierungen empfehlen</li>
                  <li>Keine Namen, Adressen oder Fotos von Kindern</li>
                  <li>Bei Warnzeichen immer zur Ärztin oder zum Arzt</li>
                </ul>
              </div>
              <div class="demo-badge">
                <strong>Demo-Modus:</strong> Konten und Beiträge werden nur in diesem Browser gespeichert und sind für andere nicht sichtbar. ${stats.users} Konto/Konten, ${stats.posts} Beitrag/Beiträge auf diesem Gerät.
              </div>
            </aside>
            <div class="stack">
              <div id="formSlot">${showForm ? newPostForm(filter) : ''}</div>
              ${filter ? `<div class="row"><span class="muted">Beiträge zu</span> <a class="tag tag-apricot" href="#/krankheit/${filter}">${diseaseById[filter]?.emoji || ''} ${esc(diseaseById[filter]?.name || '')}</a> <a href="#/community" class="btn btn-ghost btn-small">Filter entfernen</a></div>` : ''}
              <div id="feed" class="stack">
                ${posts.length ? posts.map(p => postHTML(p, me)).join('') : `
                  <div class="card empty">
                    <span class="big" aria-hidden="true">🌱</span>
                    <p><strong>Hier ist es noch ruhig.</strong></p>
                    <p>${me ? 'Teile als Erste oder Erster deine Erfahrung!' : 'Melde dich an und teile als Erste oder Erster deine Erfahrung.'}</p>
                  </div>`}
              </div>
            </div>
          </div>
        </div>
      </section>`;

    document.getElementById('filterDisease').addEventListener('change', e => {
      location.hash = '#/community' + (e.target.value ? '?krankheit=' + e.target.value : '');
    });

    const toggle = document.getElementById('toggleForm');
    if (toggle) toggle.addEventListener('click', () => {
      const slot = document.getElementById('formSlot');
      if (slot.innerHTML.trim()) { slot.innerHTML = ''; return; }
      slot.innerHTML = newPostForm(filter);
      bindForm();
      document.getElementById('npTitle').focus();
    });

    function bindForm() {
      const form = document.getElementById('newPost');
      if (!form) return;
      const chosen = new Set();
      form.querySelector('#npSymptoms').addEventListener('click', e => {
        const b = e.target.closest('button[data-symptom]');
        if (!b) return;
        const id = b.dataset.symptom;
        if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
        b.setAttribute('aria-pressed', chosen.has(id));
      });
      form.querySelector('#npCancel').addEventListener('click', () => { document.getElementById('formSlot').innerHTML = ''; });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          await C.createPost({
            title: fd.get('title'), body: fd.get('body'),
            diseaseId: fd.get('diseaseId'), childAge: fd.get('childAge'), symptoms: [...chosen]
          });
          toast('Danke fürs Teilen! 💛');
          location.hash = '#/community' + (filter ? '?krankheit=' + filter : '');
          if (!params.get('neu')) route();
        } catch (err) {
          document.getElementById('npError').textContent = err.message;
        }
      });
    }
    bindForm();

    document.getElementById('feed').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const postId = btn.closest('[data-post]').dataset.post;
      if (btn.dataset.action === 'heart') {
        if (!C.currentUser()) { toast('Bitte melde dich an.'); return; }
        await C.toggleHeart(postId);
        route();
      }
      if (btn.dataset.action === 'delete' && confirm('Diesen Beitrag wirklich löschen?')) {
        await C.deletePost(postId);
        toast('Beitrag gelöscht');
        route();
      }
    });
    document.getElementById('feed').addEventListener('submit', async e => {
      const form = e.target.closest('form[data-action="comment"]');
      if (!form) return;
      e.preventDefault();
      const postId = form.closest('[data-post]').dataset.post;
      try {
        await C.addComment(postId, form.body.value);
        route();
      } catch (err) { toast(err.message); }
    });
  }

  function viewAuth() {
    let mode = 'login';
    main.innerHTML = `
      <section>
        <div class="container" style="max-width:520px">
          <div class="card">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" data-mode="login" class="active" aria-selected="true">Anmelden</button>
              <button type="button" role="tab" data-mode="register" aria-selected="false">Registrieren</button>
            </div>
            <form class="form" id="authForm" novalidate>
              <h2 id="authTitle" style="margin:0">Willkommen zurück</h2>
              <div class="field" id="nameField" hidden>
                <label for="aName">Anzeigename</label>
                <input class="input" id="aName" name="displayName" maxlength="40" autocomplete="nickname" placeholder="z. B. Mama von zwei Wirbelwinden">
                <small>Wird öffentlich angezeigt. Bitte nicht deinen vollen Namen.</small>
              </div>
              <div class="field">
                <label for="aEmail">E-Mail</label>
                <input class="input" id="aEmail" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="aPw">Passwort</label>
                <input class="input" id="aPw" name="password" type="password" autocomplete="current-password" required minlength="8">
                <small id="pwHint" hidden>Mindestens 8 Zeichen.</small>
              </div>
              <label class="checkbox" id="termsField" hidden>
                <input type="checkbox" name="terms" id="aTerms">
                <span>Ich habe verstanden, dass die Community dem Erfahrungsaustausch dient und keinen ärztlichen Rat ersetzt, und halte mich an die Community-Regeln.</span>
              </label>
              <div class="form-error" id="authError" role="alert"></div>
              <button class="btn" type="submit" id="authSubmit">Anmelden</button>
            </form>
          </div>
          <div class="demo-badge" style="margin-top:16px">
            <strong>Demo-Modus:</strong> Diese Seite hat noch keinen Server. Dein Konto wird nur in diesem Browser gespeichert. Bitte verwende <strong>kein Passwort, das du anderswo nutzt</strong>.
          </div>
        </div>
      </section>`;

    const form = document.getElementById('authForm');
    function setMode(m) {
      mode = m;
      document.querySelectorAll('.tabs button').forEach(b => {
        const on = b.dataset.mode === m;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
      const reg = m === 'register';
      document.getElementById('nameField').hidden = !reg;
      document.getElementById('termsField').hidden = !reg;
      document.getElementById('pwHint').hidden = !reg;
      document.getElementById('aPw').autocomplete = reg ? 'new-password' : 'current-password';
      document.getElementById('authTitle').textContent = reg ? 'Profil anlegen' : 'Willkommen zurück';
      document.getElementById('authSubmit').textContent = reg ? 'Konto erstellen' : 'Anmelden';
      document.getElementById('authError').textContent = '';
    }
    document.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-mode]');
      if (b) setMode(b.dataset.mode);
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const err = document.getElementById('authError');
      try {
        if (mode === 'register') {
          if (!document.getElementById('aTerms').checked) throw new Error('Bitte bestätige die Community-Regeln.');
          await C.register({ email: fd.get('email'), password: fd.get('password'), displayName: fd.get('displayName') });
          toast('Willkommen in der Community! 🎉');
        } else {
          await C.login({ email: fd.get('email'), password: fd.get('password') });
          toast('Schön, dass du da bist!');
        }
        updateNav();
        route();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  }

  async function viewProfile() {
    const me = C.currentUser();
    if (!me) return viewAuth();
    const myPosts = await C.listPosts({ userId: me.id });

    main.innerHTML = `
      <section>
        <div class="container">
          <div class="detail-hero" style="margin-top:12px">
            ${avatar(me, 'avatar-lg')}
            <div>
              <h1 style="margin:0">${esc(me.displayName)}</h1>
              <div class="muted">Dabei seit ${new Date(me.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} · ${myPosts.length} Beiträge</div>
            </div>
            <span class="spacer"></span>
            <a class="btn btn-ghost btn-small" href="#/nutzer/${me.id}">Öffentliche Ansicht</a>
            <button class="btn btn-ghost btn-small" id="logout" type="button">Abmelden</button>
          </div>
          <div class="detail-layout">
            <form class="card form" id="profileForm">
              <h2 style="margin:0">Profil bearbeiten</h2>
              <div class="field">
                <span style="font-weight:800;font-size:.92rem">Avatar</span>
                <div class="avatar-picker">
                  ${AVATARS.map(a => `<label><input type="radio" name="avatar" value="${a}" ${a === me.avatar ? 'checked' : ''}><span>${a}</span></label>`).join('')}
                </div>
              </div>
              <div class="field">
                <label for="pName">Anzeigename</label>
                <input class="input" id="pName" name="displayName" maxlength="40" value="${esc(me.displayName)}" required>
              </div>
              <div class="field">
                <label for="pChildren">Meine Kinder</label>
                <input class="input" id="pChildren" name="children" maxlength="120" value="${esc(me.children)}" placeholder="z. B. zwei Kinder, 1 und 4 Jahre">
                <small>Bitte keine Namen oder Geburtsdaten.</small>
              </div>
              <div class="field">
                <label for="pRegion">Region (optional)</label>
                <input class="input" id="pRegion" name="region" maxlength="60" value="${esc(me.region)}" placeholder="z. B. Raum Hamburg">
              </div>
              <div class="field">
                <label for="pBio">Über mich</label>
                <textarea class="input" id="pBio" name="bio" maxlength="500" placeholder="Ein paar Worte über dich und deine Familie">${esc(me.bio)}</textarea>
              </div>
              <div class="field">
                <span style="font-weight:800;font-size:.92rem">Themen, die mich beschäftigen</span>
                <div class="chip-row" id="pInterests">
                  ${DISEASES.map(d => `<button type="button" class="chip" data-id="${d.id}" aria-pressed="${(me.interests || []).includes(d.id)}">${d.emoji} ${esc(d.name)}</button>`).join('')}
                </div>
              </div>
              <div class="form-error" id="pError" role="alert"></div>
              <div class="row"><button class="btn" type="submit">Speichern</button></div>
            </form>
            <aside class="stack">
              <div class="card">
                <h3>Meine Beiträge</h3>
                ${myPosts.length ? `<ul class="check-list">${myPosts.map(p => `<li><a href="#/community${p.diseaseId ? '?krankheit=' + p.diseaseId : ''}">${esc(p.title)}</a><br><small class="muted">${timeAgo(p.createdAt)} · 💛 ${p.hearts.length} · 💬 ${p.comments.length}</small></li>`).join('')}</ul>`
                  : '<p class="muted">Du hast noch nichts geteilt.</p>'}
                <a class="btn btn-soft btn-small" href="#/community?neu=1">Erfahrung teilen</a>
              </div>
              <div class="demo-badge"><strong>Demo-Modus:</strong> Dein Profil ist nur in diesem Browser gespeichert.</div>
              <div class="card">
                <h3>Konto löschen</h3>
                <p class="muted" style="font-size:.93rem">Löscht dein Profil, deine Beiträge und Kommentare dauerhaft.</p>
                <button class="btn btn-ghost btn-small" id="deleteAccount" type="button" style="color:var(--danger)">Konto löschen</button>
              </div>
            </aside>
          </div>
        </div>
      </section>`;

    const interests = new Set(me.interests || []);
    document.getElementById('pInterests').addEventListener('click', e => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const id = b.dataset.id;
      if (interests.has(id)) interests.delete(id); else interests.add(id);
      b.setAttribute('aria-pressed', interests.has(id));
    });
    document.getElementById('profileForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await C.updateProfile({
          displayName: fd.get('displayName'), avatar: fd.get('avatar') || me.avatar,
          children: String(fd.get('children') || '').slice(0, 120), region: String(fd.get('region') || '').slice(0, 60),
          bio: fd.get('bio'), interests: [...interests]
        });
        toast('Profil gespeichert ✨');
        updateNav();
        route();
      } catch (err) { document.getElementById('pError').textContent = err.message; }
    });
    document.getElementById('logout').addEventListener('click', () => {
      C.logout(); updateNav(); toast('Bis bald! 👋'); location.hash = '#/';
    });
    document.getElementById('deleteAccount').addEventListener('click', async () => {
      if (!confirm('Konto und alle deine Beiträge wirklich dauerhaft löschen?')) return;
      await C.deleteAccount(); updateNav(); toast('Konto gelöscht'); location.hash = '#/';
    });
  }

  async function viewUser(id) {
    const u = await C.getUser(id);
    if (!u) return viewNotFound('Dieses Profil gibt es nicht (mehr).');
    const me = C.currentUser();
    const posts = await C.listPosts({ userId: id });
    main.innerHTML = `
      <section>
        <div class="container" style="max-width:820px">
          <a class="back-link" href="#/community">← Zur Community</a>
          <div class="card stack">
            <div class="detail-hero" style="margin:0">
              ${avatar(u, 'avatar-lg')}
              <div>
                <h1 style="margin:0">${esc(u.displayName)}</h1>
                <div class="muted">${[u.region, u.children].filter(Boolean).map(esc).join(' · ') || 'Mitglied der Community'}</div>
              </div>
            </div>
            ${u.bio ? `<p style="white-space:pre-wrap;margin:0">${esc(u.bio)}</p>` : ''}
            ${(u.interests || []).length ? `<div class="chip-row">${u.interests.filter(i => diseaseById[i]).map(i => `<a class="chip" href="#/krankheit/${i}">${diseaseById[i].emoji} ${esc(diseaseById[i].name)}</a>`).join('')}</div>` : ''}
          </div>
          <h2 style="margin-top:28px">Beiträge</h2>
          <div class="stack" id="feed">${posts.length ? posts.map(p => postHTML(p, me)).join('') : '<p class="muted">Noch keine Beiträge.</p>'}</div>
        </div>
      </section>`;
  }

  function viewAbout() {
    const allSources = new Map();
    DISEASES.forEach(d => d.sources.forEach(s => allSources.set(s.url, s.label)));
    main.innerHTML = `
      <section>
        <div class="container" style="max-width:820px">
          <h1>Über Pflasterpost</h1>
          <div class="stack">
            ${disclaimer()}
            <div class="card">
              <h2>Was ist das hier?</h2>
              <p>Pflasterpost ist ein Ratgeber für Eltern von Babys und kleinen Kindern. Wir fassen allgemeine Informationen zu häufigen Kinderkrankheiten verständlich zusammen: woran man sie erkennt, was zu Hause helfen kann und wann man ärztliche Hilfe holen sollte.</p>
              <p style="margin:0">Die Inhalte basieren auf gut recherchierten, öffentlich zugänglichen Quellen von Gesundheitsinstitutionen. Sie wurden sorgfältig zusammengestellt, können aber Fehler enthalten oder veralten. Sie ersetzen <strong>keine ärztliche Beratung, Diagnose oder Behandlung</strong>.</p>
            </div>
            <div class="card">
              <h2>Medikamente</h2>
              <p style="margin:0">Wir nennen bewusst keine Dosierungen. Medikamente für Kinder werden nach Alter und Körpergewicht dosiert – bitte frag in der Kinderarztpraxis oder Apotheke nach und lies den Beipackzettel.</p>
            </div>
            <div class="card">
              <h2>Quellen</h2>
              <ul class="sources">${[...allSources].sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([url, label]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a></li>`).join('')}</ul>
            </div>
            <div class="card">
              <h2>Community & Datenschutz</h2>
              <p style="margin:0">Die Community läuft derzeit im Demo-Modus: Konten, Profile und Beiträge werden ausschließlich im Speicher deines Browsers abgelegt und nicht an einen Server übertragen. Du kannst dein Konto jederzeit im Profil löschen.</p>
            </div>
            ${emergencyBox()}
          </div>
        </div>
      </section>`;
  }

  function viewNotFound(msg) {
    main.innerHTML = `
      <section><div class="container"><div class="card empty">
        <span class="big" aria-hidden="true">🧸</span>
        <h2>Hoppla!</h2>
        <p>${esc(msg || 'Diese Seite haben wir nicht gefunden.')}</p>
        <a class="btn" href="#/">Zur Startseite</a>
      </div></div></section>`;
  }

  /* ---------- Router ---------- */

  function updateNav() {
    const me = C.currentUser();
    const el = document.getElementById('navProfile');
    el.textContent = me ? `${me.avatar} Mein Profil` : 'Anmelden';
  }

  async function route() {
    const { parts, params } = parseHash();
    const [page, arg] = parts;
    const navKey = { undefined: 'home', bibliothek: 'bibliothek', krankheit: 'bibliothek', symptome: 'symptome', community: 'community', nutzer: 'community', profil: 'profil' }[page];
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navKey));
    document.getElementById('nav').classList.remove('open');
    document.getElementById('navToggle').setAttribute('aria-expanded', 'false');

    // Seiteninhalt neu aufbauen; alte Event-Listener an <main> entfernen
    const fresh = main.cloneNode(false);
    main.replaceWith(fresh);
    main = fresh;

    switch (page) {
      case undefined: viewHome(); break;
      case 'bibliothek': viewLibrary(params); break;
      case 'symptome': viewSymptoms(params); break;
      case 'krankheit': await viewDisease(arg); break;
      case 'community': await viewCommunity(params); break;
      case 'profil': await viewProfile(); break;
      case 'nutzer': await viewUser(arg); break;
      case 'ueber': viewAbout(); break;
      default: viewNotFound();
    }

    const titles = { bibliothek: 'Bibliothek', symptome: 'Symptom-Finder', community: 'Community', profil: 'Profil', ueber: 'Über & Quellen', nutzer: 'Profil' };
    const t = page === 'krankheit' && diseaseById[arg] ? diseaseById[arg].name : titles[page];
    document.title = (t ? t + ' – ' : '') + 'Pflasterpost';
  }

  /* ---------- Hinweis beim ersten Besuch ---------- */

  function showWelcome() {
    if (storageGet('pflasterpost.disclaimer') === '1') return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
        <h2 id="welcomeTitle"><span aria-hidden="true">💛</span> Schön, dass du hier bist</h2>
        <p>Pflasterpost hilft dir, Krankheiten deines Kindes besser einzuordnen. Bitte beachte:</p>
        <ul class="check-list warn-list">
          <li>Die Inhalte sind <strong>kein medizinischer Rat</strong>, sondern allgemeine Informationen auf Basis gut recherchierter Webquellen.</li>
          <li>Sie ersetzen keine Untersuchung. Wenn du dir Sorgen machst, ruf deine Kinderarztpraxis an.</li>
          <li>Im Notfall: <a href="tel:112"><strong>112</strong></a>. Nachts und am Wochenende: <a href="tel:116117"><strong>116 117</strong></a>.</li>
        </ul>
        <button class="btn" type="button" style="width:100%;margin-top:8px">Verstanden</button>
      </div>`;
    document.body.appendChild(wrap);
    const btn = wrap.querySelector('button');
    btn.focus();
    const close = () => { storageSet('pflasterpost.disclaimer', '1'); wrap.remove(); };
    btn.addEventListener('click', close);
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ---------- Start ---------- */

  document.getElementById('navToggle').addEventListener('click', e => {
    const nav = document.getElementById('nav');
    const open = nav.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', open);
  });

  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  updateNav();
  route();
  showWelcome();
})();
