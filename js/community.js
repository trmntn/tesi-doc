/*
 * Community-Speicher.
 *
 * GitHub Pages liefert nur statische Dateien aus und hat keinen Server.
 * Diese Umsetzung speichert Konten, Profile und Beiträge deshalb im
 * localStorage des Browsers (Demo-Modus): Alles bleibt auf diesem Gerät
 * und ist für andere nicht sichtbar.
 *
 * Alle Funktionen sind async und laufen über diese eine Schnittstelle,
 * damit später ein echtes Backend (z. B. Supabase oder Firebase)
 * angebunden werden kann, ohne die Oberfläche zu ändern.
 */
(function () {
  const KEY = 'pflasterpost.community.v1';
  const SESSION_KEY = 'pflasterpost.session.v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* Speicher nicht verfügbar */ }
    return { users: [], posts: [] };
  }

  let db = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignorieren */ }
  }

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  async function hash(password, salt) {
    const data = new TextEncoder().encode(salt + ':' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function publicUser(u) {
    if (!u) return null;
    const { pwHash, salt, email, ...rest } = u;
    return rest;
  }

  function getSessionId() {
    try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }

  function setSessionId(id) {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignorieren */ }
  }

  const Community = {
    mode: 'demo',

    currentUser() {
      const id = getSessionId();
      const u = db.users.find(x => x.id === id);
      return u ? { ...publicUser(u), email: u.email } : null;
    },

    async register({ email, password, displayName }) {
      email = String(email || '').trim().toLowerCase();
      displayName = String(displayName || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Bitte gib eine gültige E-Mail-Adresse ein.');
      if (displayName.length < 2 || displayName.length > 40) throw new Error('Der Anzeigename muss 2–40 Zeichen lang sein.');
      if (String(password || '').length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen haben.');
      if (db.users.some(u => u.email === email)) throw new Error('Diese E-Mail-Adresse ist bereits registriert.');
      const salt = uid();
      const user = {
        id: uid(), email, displayName, salt,
        pwHash: await hash(password, salt),
        avatar: '🐻', bio: '', children: '', region: '',
        interests: [], createdAt: Date.now()
      };
      db.users.push(user);
      save();
      setSessionId(user.id);
      return this.currentUser();
    },

    async login({ email, password }) {
      email = String(email || '').trim().toLowerCase();
      const user = db.users.find(u => u.email === email);
      if (!user || (await hash(password, user.salt)) !== user.pwHash) {
        throw new Error('E-Mail oder Passwort stimmen nicht.');
      }
      setSessionId(user.id);
      return this.currentUser();
    },

    logout() { setSessionId(null); },

    async updateProfile(patch) {
      const me = db.users.find(u => u.id === getSessionId());
      if (!me) throw new Error('Bitte melde dich an.');
      const allowed = ['displayName', 'avatar', 'bio', 'children', 'region', 'interests'];
      for (const k of allowed) if (k in patch) me[k] = patch[k];
      if (!me.displayName || me.displayName.trim().length < 2) throw new Error('Der Anzeigename muss mindestens 2 Zeichen lang sein.');
      me.displayName = me.displayName.trim().slice(0, 40);
      me.bio = String(me.bio || '').slice(0, 500);
      save();
      return this.currentUser();
    },

    async deleteAccount() {
      const id = getSessionId();
      db.users = db.users.filter(u => u.id !== id);
      db.posts = db.posts.filter(p => p.userId !== id);
      db.posts.forEach(p => {
        p.comments = p.comments.filter(c => c.userId !== id);
        p.hearts = p.hearts.filter(h => h !== id);
      });
      save();
      setSessionId(null);
    },

    async getUser(id) { return publicUser(db.users.find(u => u.id === id)); },

    async listPosts({ diseaseId, symptom, userId, query } = {}) {
      let posts = db.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
      if (diseaseId) posts = posts.filter(p => p.diseaseId === diseaseId);
      if (symptom) posts = posts.filter(p => p.symptoms.includes(symptom));
      if (userId) posts = posts.filter(p => p.userId === userId);
      if (query) {
        const q = query.toLowerCase();
        posts = posts.filter(p => (p.title + ' ' + p.body).toLowerCase().includes(q));
      }
      return posts.map(p => ({ ...p, author: publicUser(db.users.find(u => u.id === p.userId)) }));
    },

    async createPost({ title, body, diseaseId, symptoms, childAge }) {
      const me = this.currentUser();
      if (!me) throw new Error('Bitte melde dich an.');
      title = String(title || '').trim();
      body = String(body || '').trim();
      if (title.length < 3) throw new Error('Bitte gib einen Titel ein.');
      if (body.length < 10) throw new Error('Bitte beschreibe deine Erfahrung etwas ausführlicher.');
      const post = {
        id: uid(), userId: me.id, title: title.slice(0, 120), body: body.slice(0, 4000),
        diseaseId: diseaseId || null, symptoms: symptoms || [], childAge: childAge || '',
        hearts: [], comments: [], createdAt: Date.now()
      };
      db.posts.push(post);
      save();
      return post;
    },

    async deletePost(postId) {
      const me = this.currentUser();
      const post = db.posts.find(p => p.id === postId);
      if (!me || !post || post.userId !== me.id) throw new Error('Nicht erlaubt.');
      db.posts = db.posts.filter(p => p.id !== postId);
      save();
    },

    async toggleHeart(postId) {
      const me = this.currentUser();
      if (!me) throw new Error('Bitte melde dich an.');
      const post = db.posts.find(p => p.id === postId);
      if (!post) return;
      const i = post.hearts.indexOf(me.id);
      if (i >= 0) post.hearts.splice(i, 1); else post.hearts.push(me.id);
      save();
    },

    async addComment(postId, body) {
      const me = this.currentUser();
      if (!me) throw new Error('Bitte melde dich an.');
      body = String(body || '').trim();
      if (body.length < 2) throw new Error('Bitte schreibe einen Kommentar.');
      const post = db.posts.find(p => p.id === postId);
      if (!post) return;
      post.comments.push({ id: uid(), userId: me.id, body: body.slice(0, 1500), createdAt: Date.now() });
      save();
    },

    commentAuthor(userId) { return publicUser(db.users.find(u => u.id === userId)); },

    stats() { return { users: db.users.length, posts: db.posts.length }; }
  };

  window.addEventListener('storage', e => { if (e.key === KEY) db = load(); });

  window.Community = Community;
})();
