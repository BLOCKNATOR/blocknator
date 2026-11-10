/* ============================================================
   BLOCKNATOR.COM — app.js
   Vanilla JS · Sin dependencias · Client-side only · Multi-language
   Auditoría i18n: sin claves técnicas visibles en la UI.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- STATE ---------- */
  const state = {
    projects: [],
    filtered: [],
    search: '',
    chain: 'ALL',
    lang: 'en',
    translations: {},
    supportedLangs: ['en', 'es', 'zh', 'pt', 'th'],
    i18nReady: false,
  };

  const LANG_STORAGE_KEY = 'blocknator.lang';

  /**
   * Alias map: claves inexistentes en data/i18n.json → claves existentes.
   * Se aplican en tiempo de traducción sin necesidad de tocar i18n.json
   * ni index.html.
   */
  const I18N_ALIASES = {
    'aria.searchToken': 'directory.searchPlaceholder',
    'aria.filterBlockchain': 'directory.colBlockchain',
    // 'aria.brand', 'aria.openMenu', 'aria.close' → sin alias:
    // se conserva el valor original del HTML (no se muestra clave técnica).
  };

  /* ---------- DOM CACHE ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const els = {
    navToggle: $('#navToggle'),
    navLinks: $('#navLinks'),

    // language selector
    langSelector: $('#langSelector'),
    langBtn: $('#langBtn'),
    langMenu: $('#langMenu'),
    langCurrent: $('#langCurrent'),

    // sections
    galleryGrid: $('#galleryGrid'),
    galleryEmpty: $('#galleryEmpty'),
    dirTableBody: $('#dirTableBody'),
    dirEmpty: $('#dirEmpty'),
    searchInput: $('#searchInput'),
    chainFilters: $('#chainFilters'),
    statProjects: $('#statProjects'),
    statChains: $('#statChains'),

    // modal
    modal: $('#projectModal'),
    modalContent: $('#modalContent'),
    modalClose: $('#modalClose'),
  };

  /* ---------- HELPERS ---------- */
  const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const initials = (name) =>
    (name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

  const shortContract = (addr) => {
    if (!addr) return '—';
    return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
  };

  const formatSupply = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
    return num.toLocaleString('en-US');
  };

  /* ---------- I18N CORE ---------- */
  /**
   * Busca una traducción. Devuelve:
   *   - string traducido si la clave existe (idioma actual → fallback en)
   *   - null si la clave no existe en ningún idioma
   * NUNCA devuelve el nombre técnico de la clave.
   */
  function lookup(key) {
    if (!key) return null;
    const dict = state.translations || {};
    const current = dict[state.lang] || {};
    const fallback = dict.en || {};

    let resolved = key;
    if (!Object.prototype.hasOwnProperty.call(current, resolved) &&
        !Object.prototype.hasOwnProperty.call(fallback, resolved)) {
      // intenta alias
      const alias = I18N_ALIASES[resolved];
      if (alias) resolved = alias;
    }

    if (Object.prototype.hasOwnProperty.call(current, resolved)) {
      return current[resolved];
    }
    if (Object.prototype.hasOwnProperty.call(fallback, resolved)) {
      return fallback[resolved];
    }
    return null;
  }

  function t(key, vars) {
    const raw = lookup(key);
    if (raw === null || raw === undefined) return null;
    if (vars && typeof vars === 'object') {
      return String(raw).replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m
      );
    }
    return String(raw);
  }

  /** Como t() pero devuelve '' en vez de null, para usar con seguridad en templates. */
  function tSafe(key, vars) {
    const v = t(key, vars);
    return v === null ? '' : v;
  }

  function isValidLang(lang) {
    return state.supportedLangs.indexOf(lang) !== -1;
  }

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && isValidLang(saved)) return saved;
    } catch (_) { /* storage blocked */ }

    const candidates = [];
    if (navigator.languages && navigator.languages.length) {
      candidates.push.apply(candidates, navigator.languages);
    }
    if (navigator.language) candidates.push(navigator.language);

    for (let i = 0; i < candidates.length; i++) {
      const raw = String(candidates[i] || '').toLowerCase();
      const primary = raw.split('-')[0];
      if (isValidLang(primary)) return primary;
    }
    return 'en';
  }

  function saveLang(lang) {
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (_) { /* ignore */ }
  }

  async function loadI18n() {
    try {
      const res = await fetch('data/i18n.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && typeof data === 'object') {
        state.translations = data;
        state.i18nReady = true;
      }
    } catch (err) {
      console.error('[BLOCKNATOR] Error loading i18n.json:', err);
      state.translations = {};
    }
  }

  /* ---------- APPLY TRANSLATIONS TO DOM ---------- */
  function applyTranslations() {
    if (!state.i18nReady) return;

    document.documentElement.setAttribute('lang', state.lang);

    // data-i18n → textContent (solo si hay traducción válida)
    $$('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) return;
      const value = t(key);
      if (value !== null && value !== undefined) {
        node.textContent = value;
      }
    });

    // data-i18n-html → innerHTML (conserva etiquetas <strong> etc.)
    $$('[data-i18n-html]').forEach((node) => {
      const key = node.getAttribute('data-i18n-html');
      if (!key) return;
      const value = t(key);
      if (value !== null && value !== undefined) {
        node.innerHTML = value;
      }
    });

    // data-i18n-attr="attr1:key1;attr2:key2"
    $$('[data-i18n-attr]').forEach((node) => {
      const spec = node.getAttribute('data-i18n-attr');
      if (!spec) return;
      spec.split(';').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx === -1) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;
        const value = t(key);
        if (value !== null && value !== undefined) {
          node.setAttribute(attr, value);
        }
        // si es null, se conserva el valor original del HTML
      });
    });

    // Footer year (interpolación {year})
    const year = new Date().getFullYear();
    $$('[data-i18n="footer.copyright"]').forEach((node) => {
      const value = t('footer.copyright', { year });
      if (value !== null && value !== undefined) {
        node.textContent = value;
      }
    });

    // Language selector UI
    updateLangButtonLabel();
    updateLangOptionsState();

    // Re-render dinámico
    renderStats();
    renderGallery();
    renderFilters();
    applyFilters();
  }

  /* ---------- LANGUAGE SELECTOR ---------- */
  function updateLangButtonLabel() {
    if (!els.langCurrent) return;
    els.langCurrent.textContent = state.lang.toUpperCase();
  }

  function updateLangOptionsState() {
    if (!els.langMenu) return;
    $$('.lang-option', els.langMenu).forEach((btn) => {
      const lang = btn.getAttribute('data-lang');
      const active = lang === state.lang;
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function openLangMenu() {
    if (!els.langMenu || !els.langBtn) return;
    els.langMenu.hidden = false;
    els.langBtn.setAttribute('aria-expanded', 'true');
  }

  function closeLangMenu() {
    if (!els.langMenu || !els.langBtn) return;
    els.langMenu.hidden = true;
    els.langBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleLangMenu() {
    if (!els.langMenu) return;
    if (els.langMenu.hidden) openLangMenu();
    else closeLangMenu();
  }

  function setLang(lang) {
    if (!isValidLang(lang)) return;
    if (lang === state.lang && state.i18nReady) {
      closeLangMenu();
      return;
    }
    state.lang = lang;
    saveLang(lang);
    closeLangMenu();
    applyTranslations();
  }

  function initLangSelector() {
    if (els.langBtn) {
      els.langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLangMenu();
      });
    }

    if (els.langMenu) {
      $$('.lang-option', els.langMenu).forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const lang = btn.getAttribute('data-lang');
          setLang(lang);
        });
      });
    }

    document.addEventListener('click', (e) => {
      if (!els.langSelector) return;
      if (!els.langSelector.contains(e.target)) closeLangMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.langMenu && !els.langMenu.hidden) {
        closeLangMenu();
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === LANG_STORAGE_KEY && e.newValue && isValidLang(e.newValue)) {
        state.lang = e.newValue;
        applyTranslations();
      }
    });
  }

  /* ---------- PROJECT DESCRIPTION ---------- */
  function getProjectDescription(project) {
    if (!project) return '';
    const i18n = project.descriptionI18n;
    if (i18n && typeof i18n === 'object') {
      const localized = i18n[state.lang];
      if (localized) return localized;
      if (i18n.en) return i18n.en;
    }
    return project.description || '';
  }

  /* ---------- RENDER: LOGO ---------- */
  function renderLogo(project, cls) {
    if (project.logo) {
      return `<img src="${esc(project.logo)}" alt="${esc(project.name)} logo"
                class="${cls}" loading="lazy" decoding="async"
                onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls}',textContent:'${esc(initials(project.name))}'}))" />`;
    }
    return `<div class="${cls}">${esc(initials(project.name))}</div>`;
  }

  /* ---------- RENDER: GALLERY ---------- */
  function renderGallery() {
    if (!els.galleryGrid) return;
    els.galleryGrid.innerHTML = '';

    if (!state.projects.length) {
      if (els.galleryEmpty) els.galleryEmpty.hidden = false;
      return;
    }
    if (els.galleryEmpty) els.galleryEmpty.hidden = true;

    const frag = document.createDocumentFragment();

    state.projects.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'card reveal';
      btn.type = 'button';
      btn.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
      btn.setAttribute('data-id', p.id);

      const ariaTpl = t('gallery.cardAria', { name: p.name });
      if (ariaTpl !== null) {
        btn.setAttribute('aria-label', ariaTpl);
      }

      btn.innerHTML = `
        <div class="card-top">
          ${renderLogo(p, 'card-logo')}
          <div>
            <div class="card-name">${esc(p.name)}</div>
            <div class="card-ticker">${esc(p.symbol)}</div>
          </div>
        </div>
        <span class="card-chain"><span class="dot"></span>${esc(p.blockchain)}</span>
        <p class="card-desc">${esc(getProjectDescription(p))}</p>
      `;
      btn.addEventListener('click', () => openModal(p.id));
      frag.appendChild(btn);
    });

    els.galleryGrid.appendChild(frag);
  }

  /* ---------- RENDER: CHAIN FILTERS ---------- */
  function renderFilters() {
    if (!els.chainFilters) return;

    const chains = ['ALL'].concat(
      Array.from(new Set(state.projects.map((p) => p.blockchain)))
    ).sort((a, b) => {
      if (a === 'ALL') return -1;
      if (b === 'ALL') return 1;
      return a.localeCompare(b);
    });

    els.chainFilters.innerHTML = chains.map((chain) => {
      const isAll = chain === 'ALL';
      const allLabel = isAll ? tSafe('filters.all') : '';
      const label = isAll ? (allLabel || 'All') : esc(chain);
      const active = chain === state.chain;
      return `
        <button type="button" class="chip ${active ? 'active' : ''}"
                data-chain="${esc(chain)}" aria-pressed="${active}">
          ${label}
        </button>
      `;
    }).join('');

    $$('.chip', els.chainFilters).forEach((chip) => {
      chip.addEventListener('click', () => {
        state.chain = chip.getAttribute('data-chain');
        $$('.chip', els.chainFilters).forEach((c) => {
          const isActive = c.getAttribute('data-chain') === state.chain;
          c.classList.toggle('active', isActive);
          c.setAttribute('aria-pressed', isActive);
        });
        applyFilters();
      });
    });
  }

  /* ---------- RENDER: DIRECTORY TABLE ---------- */
  function renderDirectory() {
    if (!els.dirTableBody) return;
    els.dirTableBody.innerHTML = '';

    if (!state.filtered.length) {
      if (els.dirEmpty) els.dirEmpty.hidden = false;
      return;
    }
    if (els.dirEmpty) els.dirEmpty.hidden = true;

    const frag = document.createDocumentFragment();
    const viewLabel = tSafe('directory.view') || 'View';

    state.filtered.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="tok-cell">
            ${renderLogo(p, 'mini-logo')}
            <span class="tok-name">${esc(p.name)}</span>
          </div>
        </td>
        <td><span class="ticker-pill">${esc(p.symbol)}</span></td>
        <td>
          <span class="chain-pill"><span class="dot"></span>${esc(p.blockchain)}</span>
        </td>
        <td class="mono">${esc(formatSupply(p.totalSupply))}</td>
        <td class="mono" title="${esc(p.contract || '')}">${esc(shortContract(p.contract))}</td>
        <td>
          <button type="button" class="btn-mini" data-id="${esc(p.id)}">${esc(viewLabel)}</button>
        </td>
      `;
      const btn = tr.querySelector('.btn-mini');
      if (btn) btn.addEventListener('click', () => openModal(p.id));
      frag.appendChild(tr);
    });

    els.dirTableBody.appendChild(frag);
  }

  /* ---------- FILTERS ---------- */
  function applyFilters() {
    const q = state.search.trim().toLowerCase();
    state.filtered = state.projects.filter((p) => {
      const matchChain = state.chain === 'ALL' || p.blockchain === state.chain;
      if (!matchChain) return false;
      if (!q) return true;
      return (
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.symbol || '').toLowerCase().includes(q) ||
        String(p.blockchain || '').toLowerCase().includes(q)
      );
    });
    renderDirectory();
  }

  /* ---------- MODAL ---------- */
  function openModal(id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p || !els.modal) return;

    const links = p.links || {};
    const linkLabelMap = {
      website: 'modal.linkWebsite',
      explorer: 'modal.linkExplorer',
      dex: 'modal.linkDex',
      wallet: 'modal.linkWallet',
      twitter: 'modal.linkTwitter',
      telegram: 'modal.linkTelegram',
      discord: 'modal.linkDiscord',
    };

    const linkButtons = Object.keys(links)
      .filter((key) => !!links[key])
      .map((key) => {
        const labelKey = linkLabelMap[key];
        const label = labelKey ? (tSafe(labelKey) || key) : key;
        return `<a class="m-link" href="${esc(links[key])}" target="_blank" rel="noopener noreferrer">
          ${esc(label)}
        </a>`;
      }).join('');

    const noLinks = tSafe('modal.noLinks');

    els.modalContent.innerHTML = `
      <div class="m-head">
        ${renderLogo(p, 'm-logo')}
        <div>
          <h3 id="modalTitle">${esc(p.name)}</h3>
          <div class="m-ticker">${esc(p.symbol)}</div>
          <div class="m-chain"><span class="dot"></span>${esc(p.blockchain)}</div>
        </div>
      </div>
      <p class="m-desc">${esc(getProjectDescription(p))}</p>
      <div class="m-grid">
        <div class="m-field"><span>${esc(tSafe('modal.totalSupply'))}</span><strong>${esc(formatSupply(p.totalSupply))}</strong></div>
        <div class="m-field"><span>${esc(tSafe('modal.decimals'))}</span><strong>${esc(p.decimals)}</strong></div>
        <div class="m-field"><span>${esc(tSafe('modal.contract'))}</span><strong>${esc(p.contract || '—')}</strong></div>
        <div class="m-field"><span>${esc(tSafe('modal.subdomain'))}</span><strong>${esc(p.subdomain || '—')}</strong></div>
        <div class="m-field" style="grid-column:1/-1"><span>${esc(tSafe('modal.metadata'))}</span><strong>${esc(p.metadata || '—')}</strong></div>
      </div>
      <div class="m-links">${linkButtons || (noLinks ? `<span class="mono">${esc(noLinks)}</span>` : '')}</div>
    `;

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.modalClose) els.modalClose.focus();
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------- NAV ---------- */
  function initNav() {
    if (els.navToggle && els.navLinks) {
      els.navToggle.addEventListener('click', () => {
        const open = els.navLinks.classList.toggle('open');
        els.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', els.navLinks).forEach((a) => {
        a.addEventListener('click', () => {
          els.navLinks.classList.remove('open');
          els.navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    const sections = $$('section[id]');
    const navAnchors = $$('.nav-links a');
    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navAnchors.forEach((a) =>
              a.classList.toggle('active', a.getAttribute('href') === `#${id}`)
            );
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      sections.forEach((s) => io.observe(s));
    }
  }

  /* ---------- MODAL EVENTS ---------- */
  function initModal() {
    if (!els.modal) return;
    if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
    const backdrop = els.modal.querySelector('[data-close]');
    if (backdrop) backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
  }

  /* ---------- STATS ---------- */
  function renderStats() {
    if (els.statProjects) els.statProjects.textContent = state.projects.length;
    if (els.statChains) {
      const chains = new Set(state.projects.map((p) => p.blockchain));
      els.statChains.textContent = chains.size;
    }
  }

  /* ---------- SEARCH ---------- */
  function initSearch() {
    if (!els.searchInput) return;
    let timer;
    els.searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = e.target.value;
        applyFilters();
      }, 120);
    });
  }

  /* ---------- LOAD DATA ---------- */
  async function loadProjects() {
    try {
      const res = await fetch('data/projects.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      state.filtered = state.projects.slice();
    } catch (err) {
      console.error('[BLOCKNATOR] Error loading projects.json:', err);
      state.projects = [];
      state.filtered = [];
    }
  }

  /* ---------- INIT ---------- */
  async function init() {
    state.lang = detectLang();

    initNav();
    initModal();
    initSearch();
    initLangSelector();

    await Promise.all([loadI18n(), loadProjects()]);

    updateLangButtonLabel();
    updateLangOptionsState();
    applyTranslations();

    if (!state.i18nReady) {
      renderStats();
      renderGallery();
      renderFilters();
      applyFilters();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
