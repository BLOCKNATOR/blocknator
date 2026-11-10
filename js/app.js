/* ============================================================
   BLOCKNATOR.COM — app.js
   Vanilla JS · Sin dependencias · Client-side only
   ============================================================ */
(function () {
  'use strict';

  /* ---------- STATE ---------- */
  const state = {
    projects: [],
    filtered: [],
    search: '',
    chain: 'ALL',
  };

  /* ---------- DOM CACHE ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const els = {
    navToggle: $('#navToggle'),
    navLinks: $('#navLinks'),
    galleryGrid: $('#galleryGrid'),
    galleryEmpty: $('#galleryEmpty'),
    dirTableBody: $('#dirTableBody'),
    dirEmpty: $('#dirEmpty'),
    searchInput: $('#searchInput'),
    chainFilters: $('#chainFilters'),
    statProjects: $('#statProjects'),
    statChains: $('#statChains'),
    modal: $('#projectModal'),
    modalContent: $('#modalContent'),
    modalClose: $('#modalClose'),
    year: $('#year'),
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
      els.galleryEmpty.hidden = false;
      return;
    }
    els.galleryEmpty.hidden = true;

    const frag = document.createDocumentFragment();

    state.projects.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'card reveal';
      btn.type = 'button';
      btn.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
      btn.setAttribute('data-id', p.id);
      btn.setAttribute('aria-label', `Ver información de ${p.name}`);
      btn.innerHTML = `
        <div class="card-top">
          ${renderLogo(p, 'card-logo')}
          <div>
            <div class="card-name">${esc(p.name)}</div>
            <div class="card-ticker">${esc(p.symbol)}</div>
          </div>
        </div>
        <span class="card-chain"><span class="dot"></span>${esc(p.blockchain)}</span>
        <p class="card-desc">${esc(p.description || '')}</p>
      `;
      btn.addEventListener('click', () => openModal(p.id));
      frag.appendChild(btn);
    });

    els.galleryGrid.appendChild(frag);
  }

  /* ---------- RENDER: CHAIN FILTERS ---------- */
  function renderFilters() {
    if (!els.chainFilters) return;
    const chains = ['ALL', ...new Set(state.projects.map(p => p.blockchain))].sort((a, b) => {
      if (a === 'ALL') return -1;
      if (b === 'ALL') return 1;
      return a.localeCompare(b);
    });

    els.chainFilters.innerHTML = chains.map(chain => `
      <button type="button" class="chip ${chain === state.chain ? 'active' : ''}"
              data-chain="${esc(chain)}" aria-pressed="${chain === state.chain}">
        ${chain === 'ALL' ? 'Todas' : esc(chain)}
      </button>
    `).join('');

    $$('.chip', els.chainFilters).forEach(chip => {
      chip.addEventListener('click', () => {
        state.chain = chip.dataset.chain;
        $$('.chip', els.chainFilters).forEach(c => {
          const active = c.dataset.chain === state.chain;
          c.classList.toggle('active', active);
          c.setAttribute('aria-pressed', active);
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
      els.dirEmpty.hidden = false;
      return;
    }
    els.dirEmpty.hidden = true;

    const frag = document.createDocumentFragment();

    state.filtered.forEach(p => {
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
          <button type="button" class="btn-mini" data-id="${esc(p.id)}">Ver</button>
        </td>
      `;
      tr.querySelector('.btn-mini').addEventListener('click', () => openModal(p.id));
      frag.appendChild(tr);
    });

    els.dirTableBody.appendChild(frag);
  }

  /* ---------- FILTERS ---------- */
  function applyFilters() {
    const q = state.search.trim().toLowerCase();
    state.filtered = state.projects.filter(p => {
      const matchChain = state.chain === 'ALL' || p.blockchain === state.chain;
      if (!matchChain) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.symbol.toLowerCase().includes(q) ||
        (p.blockchain || '').toLowerCase().includes(q)
      );
    });
    renderDirectory();
  }

  /* ---------- MODAL ---------- */
  function openModal(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p || !els.modal) return;

    const links = p.links || {};
    const linkLabels = {
      website: 'Web3 Page',
      explorer: 'Explorer',
      dex: 'DEX',
      wallet: 'Wallet',
      twitter: 'Twitter',
      telegram: 'Telegram',
      discord: 'Discord',
    };

    const linkButtons = Object.entries(links)
      .filter(([, url]) => !!url)
      .map(([key, url]) => `
        <a class="m-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
          ${esc(linkLabels[key] || key)}
        </a>
      `).join('');

    els.modalContent.innerHTML = `
      <div class="m-head">
        ${renderLogo(p, 'm-logo')}
        <div>
          <h3 id="modalTitle">${esc(p.name)}</h3>
          <div class="m-ticker">${esc(p.symbol)}</div>
          <div class="m-chain"><span class="dot"></span>${esc(p.blockchain)}</div>
        </div>
      </div>
      <p class="m-desc">${esc(p.description || '')}</p>
      <div class="m-grid">
        <div class="m-field"><span>Suministro total</span><strong>${esc(formatSupply(p.totalSupply))}</strong></div>
        <div class="m-field"><span>Decimales</span><strong>${esc(p.decimals)}</strong></div>
        <div class="m-field"><span>Contrato</span><strong>${esc(p.contract || '—')}</strong></div>
        <div class="m-field"><span>Subdominio</span><strong>${esc(p.subdomain || '—')}</strong></div>
        <div class="m-field" style="grid-column:1/-1"><span>Metadata</span><strong>${esc(p.metadata || '—')}</strong></div>
      </div>
      <div class="m-links">${linkButtons || '<span class="mono">Sin enlaces disponibles</span>'}</div>
    `;

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    els.modalClose?.focus();
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
        els.navToggle.setAttribute('aria-expanded', open);
      });
      $$('a', els.navLinks).forEach(a => {
        a.addEventListener('click', () => {
          els.navLinks.classList.remove('open');
          els.navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Active link on scroll
    const sections = $$('section[id]');
    const navAnchors = $$('.nav-links a');
    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navAnchors.forEach(a =>
              a.classList.toggle('active', a.getAttribute('href') === `#${id}`)
            );
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      sections.forEach(s => io.observe(s));
    }
  }

  /* ---------- MODAL EVENTS ---------- */
  function initModal() {
    if (!els.modal) return;
    els.modalClose?.addEventListener('click', closeModal);
    els.modal.querySelector('[data-close]')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
  }

  /* ---------- STATS ---------- */
  function renderStats() {
    if (els.statProjects) els.statProjects.textContent = state.projects.length;
    if (els.statChains) {
      const chains = new Set(state.projects.map(p => p.blockchain));
      els.statChains.textContent = chains.size;
    }
  }

  /* ---------- SEARCH ---------- */
  function initSearch() {
    if (!els.searchInput) return;
    let t;
    els.searchInput.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => {
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
      state.filtered = [...state.projects];
    } catch (err) {
      console.error('[BLOCKNATOR] Error cargando projects.json:', err);
      state.projects = [];
      state.filtered = [];
    }
  }

  /* ---------- INIT ---------- */
  async function init() {
    if (els.year) els.year.textContent = new Date().getFullYear();
    initNav();
    initModal();
    initSearch();

    await loadProjects();

    renderStats();
    renderGallery();
    renderFilters();
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
