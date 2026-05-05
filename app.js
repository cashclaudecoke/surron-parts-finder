// Surron Parts Finder — V1.2 (bikelife visual + in-modal bike picker)
// AI Fit Check uses curated `fits` data. The runFitCheck() body can be
// swapped for a real Claude API call (via a serverless proxy) without
// changing the UI.

const state = {
  bikes: [],
  parts: [],
  categories: [],
  selectedBike: localStorage.getItem('selectedBike') || '',
  filter: 'All',
  query: '',
  sort: 'price-asc',
  expanded: new Set(),
  pendingFitPart: null, // part the user wanted to check before picking a bike
};

const els = {
  search: document.getElementById('search'),
  filters: document.getElementById('filters'),
  sortBy: document.getElementById('sortBy'),
  list: document.getElementById('partsList'),
  count: document.getElementById('resultCount'),
  banner: document.getElementById('demoBanner'),
  bikeSelect: document.getElementById('bikeSelect'),
  bikePicker: document.querySelector('.bike-picker'),
  bikeHint: document.getElementById('bikeHint'),
  modal: document.getElementById('fitModal'),
  fitTitle: document.getElementById('fitModalTitle'),
  fitSubtitle: document.getElementById('fitModalSubtitle'),
  fitResult: document.getElementById('fitResult'),
  fitBikePicker: document.getElementById('fitBikePicker'),
  modalBikeSelect: document.getElementById('modalBikeSelect'),
};

init();

async function init() {
  try {
    const res = await fetch('parts.json', { cache: 'no-store' });
    const data = await res.json();
    state.parts = data.parts || [];
    state.categories = ['All', ...(data.categories || [])];
    state.bikes = data.bikes || [];

    const anyPlaceholder = state.parts.some((p) =>
      p.listings.some((l) => l.isPlaceholder)
    );
    els.banner.hidden = !anyPlaceholder;

    populateBikeOptions();
    renderFilters();
    bindEvents();
    render();
  } catch (err) {
    els.list.innerHTML =
      '<li class="empty">Couldn\'t load parts data. Check parts.json.</li>';
    console.error(err);
  }
}

function bindEvents() {
  els.search.addEventListener('input', (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });
  els.sortBy.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
  els.bikeSelect.addEventListener('change', (e) => {
    setSelectedBike(e.target.value);
    render();
  });
  els.modalBikeSelect.addEventListener('change', (e) => {
    if (!e.target.value) return;
    setSelectedBike(e.target.value);
    // sync the main picker, then run the check for the part user wanted
    if (state.pendingFitPart) {
      const part = state.pendingFitPart;
      state.pendingFitPart = null;
      runFlow(part);
    }
  });
  els.modal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) closeModal();
  });
}

function setSelectedBike(id) {
  state.selectedBike = id;
  if (id) localStorage.setItem('selectedBike', id);
  else localStorage.removeItem('selectedBike');
  els.bikeSelect.value = id;
  els.modalBikeSelect.value = id;
  updateBikePickerState();
  render();
}

function populateBikeOptions() {
  const opts = ['<option value="">— SHOW ALL PARTS —</option>']
    .concat(
      state.bikes.map(
        (b) =>
          `<option value="${b.id}" ${
            b.id === state.selectedBike ? 'selected' : ''
          }>${escapeHtml(b.name)}</option>`
      )
    )
    .join('');
  els.bikeSelect.innerHTML = opts;

  const modalOpts = ['<option value="">— select your bike —</option>']
    .concat(
      state.bikes.map(
        (b) =>
          `<option value="${b.id}">${escapeHtml(b.name)}</option>`
      )
    )
    .join('');
  els.modalBikeSelect.innerHTML = modalOpts;

  updateBikePickerState();
}

function updateBikePickerState() {
  const bike = state.bikes.find((b) => b.id === state.selectedBike);
  if (bike) {
    els.bikePicker.classList.add('locked');
    els.bikeHint.textContent = `Filtering to parts that fit your ${bike.name}.`;
  } else {
    els.bikePicker.classList.remove('locked');
    els.bikeHint.textContent =
      'Tap below — we filter the catalog to parts that actually fit.';
  }
}

function renderFilters() {
  els.filters.innerHTML = state.categories
    .map(
      (cat) =>
        `<button class="filter-chip ${
          cat === state.filter ? 'active' : ''
        }" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`
    )
    .join('');
  els.filters.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

function bestListing(part) {
  const inStock = part.listings.filter((l) => l.inStock);
  const pool = inStock.length ? inStock : part.listings;
  return [...pool].sort((a, b) => totalPrice(a) - totalPrice(b))[0];
}
function totalPrice(l) { return (l.price || 0) + (l.shipping || 0); }
function highestPrice(part) { return Math.max(...part.listings.map(totalPrice)); }

function filtered() {
  return state.parts.filter((p) => {
    if (state.selectedBike && !(p.fits || []).includes(state.selectedBike)) return false;
    if (state.filter !== 'All' && p.category !== state.filter) return false;
    if (state.query) {
      const hay = `${p.name} ${p.category} ${(p.fits || []).join(' ')}`.toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });
}

function sorted(parts) {
  const copy = [...parts];
  switch (state.sort) {
    case 'price-asc':
      copy.sort((a, b) => totalPrice(bestListing(a)) - totalPrice(bestListing(b)));
      break;
    case 'price-desc':
      copy.sort((a, b) => totalPrice(bestListing(b)) - totalPrice(bestListing(a)));
      break;
    case 'name-asc':
      copy.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return copy;
}

function fmtPrice(n) { return `$${n.toFixed(2)}`; }
function bikeName(id) {
  const b = state.bikes.find((x) => x.id === id);
  return b ? b.name : id;
}

function render() {
  const list = sorted(filtered());
  const bike = state.bikes.find((b) => b.id === state.selectedBike);
  const meta = bike
    ? `${list.length} parts · ${bike.name}`
    : `${list.length} parts · all bikes`;
  els.count.textContent = meta;

  if (list.length === 0) {
    els.list.innerHTML = `<li class="empty">No parts match${
      bike ? ` for the ${bike.name}` : ''
    }.</li>`;
    return;
  }

  els.list.innerHTML = list.map(renderPart).join('');

  els.list.querySelectorAll('.expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.expanded.add(btn.dataset.id);
      render();
    });
  });
  els.list.querySelectorAll('.fit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openFitCheck(btn.dataset.id));
  });
}

function renderPart(part) {
  const best = bestListing(part);
  const high = highestPrice(part);
  const savings = high - totalPrice(best);
  const isExpanded = state.expanded.has(part.id);

  const fitsList = (part.fits || []).map(bikeName).join(' · ') || 'Universal';

  const listings = [...part.listings]
    .sort((a, b) => totalPrice(a) - totalPrice(b))
    .map((l) => {
      const total = totalPrice(l);
      const shippingNote = l.shipping
        ? `+ ${fmtPrice(l.shipping)} ship`
        : 'Free shipping';
      return `
        <div class="listing ${l.inStock ? '' : 'out-of-stock'}">
          <div class="listing-vendor">
            <strong>${escapeHtml(l.vendor)}</strong>
            <small>${shippingNote}${l.inStock ? '' : ' · Out of stock'}</small>
          </div>
          <span class="listing-price">${fmtPrice(total)}</span>
          <a class="listing-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener nofollow">${l.inStock ? 'Buy →' : 'Notify'}</a>
        </div>
      `;
    })
    .join('');

  return `
    <li class="part ${isExpanded ? 'expanded' : ''}">
      <div class="part-row">
        <div class="part-info">
          <h3 class="part-name">${escapeHtml(part.name)}</h3>
          <div class="part-meta">
            <span class="tag">${escapeHtml(part.category)}</span>
            <span class="tag bike">FITS: ${escapeHtml(fitsList).toUpperCase()}</span>
          </div>
        </div>
        <div class="part-price">
          <div class="price-best">${fmtPrice(totalPrice(best))}</div>
          <div class="price-vendor">${escapeHtml(best.vendor)}</div>
          ${savings > 5 ? `<div class="price-savings">SAVE ${fmtPrice(savings)}</div>` : ''}
        </div>
      </div>
      <div class="part-actions">
        <button class="fit-btn" data-id="${escapeAttr(part.id)}">
          <span class="ai-spark">⚡</span>AI FIT CHECK
        </button>
        <button class="expand-btn" data-id="${escapeAttr(part.id)}">
          ALL ${part.listings.length} OPTION${part.listings.length === 1 ? '' : 'S'} →
        </button>
      </div>
      <div class="listings">${listings}</div>
    </li>
  `;
}

// ─── AI Fit Check ────────────────────────────────────────────────────
// V1: uses curated `fits` data. To upgrade: replace the body of
// runFitCheck() with a fetch() to a serverless endpoint that proxies
// the Anthropic API. Backend must hold the API key.

function openFitCheck(partId) {
  const part = state.parts.find((p) => p.id === partId);
  if (!part) return;
  runFlow(part);
}

function runFlow(part) {
  els.fitTitle.textContent = part.name;
  els.fitResult.hidden = true;

  if (!state.selectedBike) {
    state.pendingFitPart = part;
    els.fitSubtitle.textContent = 'Tell us what you ride and we\'ll check the fit.';
    els.fitBikePicker.hidden = false;
    els.modalBikeSelect.value = '';
    showModal();
    return;
  }

  const bike = state.bikes.find((b) => b.id === state.selectedBike);
  els.fitBikePicker.hidden = true;
  els.fitSubtitle.textContent = `Cross-checking with your ${bike.name}…`;
  els.fitResult.hidden = false;
  els.fitResult.className = 'fit-result loading';
  els.fitResult.innerHTML = `<span class="fit-spinner"></span> ANALYZING FIT…`;
  showModal();

  setTimeout(() => runFitCheck(part, bike), 700);
}

function runFitCheck(part, bike) {
  const fitsThisBike = (part.fits || []).includes(bike.id);
  const fitList = (part.fits || []).map(bikeName);
  const sameMake = (part.fits || []).some((id) => {
    const b = state.bikes.find((x) => x.id === id);
    return b && b.make === bike.make;
  });

  let verdictClass, verdictText, reason, tip;

  if (fitsThisBike) {
    verdictClass = 'fits';
    verdictText = `✅ FITS YOUR ${bike.name.toUpperCase()}`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is confirmed compatible with your ${escapeHtml(bike.name)}. ${
      fitList.length > 1
        ? `Also fits: ${fitList.filter((n) => n !== bike.name).map(escapeHtml).join(', ')}.`
        : `Specific to your bike.`
    }`;
    tip = `Always double-check year/trim on the vendor page before ordering. Some 2023+ models use slightly different mounts.`;
  } else if (sameMake) {
    verdictClass = 'maybe';
    verdictText = `⚠ PROBABLY NOT — DIFFERENT MODEL`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is listed for: ${fitList.map(escapeHtml).join(', ')}. Your ${escapeHtml(bike.name)} is the same brand but a different model — mounts and dimensions usually differ.`;
    tip = `Message the vendor: "Will this fit a ${bike.name}?" — most reply within a day.`;
  } else {
    verdictClass = 'no-fit';
    verdictText = `❌ WON'T FIT YOUR ${bike.name.toUpperCase()}`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is built for: ${fitList.map(escapeHtml).join(', ')}. Different brand and platform — mounting points, frame geometry, and electrical specs won't match.`;
    tip = `Filter parts by your bike at the top of the page to skip incompatible ones.`;
  }

  els.fitResult.className = 'fit-result';
  els.fitResult.innerHTML = `
    <div class="verdict ${verdictClass}">${verdictText}</div>
    <div class="fit-reason">${reason}</div>
    <div class="fit-tip">⚡ ${tip}</div>
  `;
}

function showModal() {
  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = '';
  state.pendingFitPart = null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }
