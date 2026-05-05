// Surron Parts Finder — V1.1 (multi-bike + AI Fit Check)
// Loads parts.json, filters by bike + category + search, sorts by price.
// AI Fit Check uses curated `fits` data; designed to swap in a real
// Claude API call (via a serverless backend) without changing the UI.

const state = {
  bikes: [],
  parts: [],
  categories: [],
  selectedBike: localStorage.getItem('selectedBike') || '',
  filter: 'All',
  query: '',
  sort: 'price-asc',
  expanded: new Set(),
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

    renderBikePicker();
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
    state.selectedBike = e.target.value;
    if (state.selectedBike) {
      localStorage.setItem('selectedBike', state.selectedBike);
    } else {
      localStorage.removeItem('selectedBike');
    }
    updateBikePickerState();
    render();
  });
  els.modal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) closeModal();
  });
}

function renderBikePicker() {
  const opts = ['<option value="">Show all parts</option>']
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
  updateBikePickerState();
}

function updateBikePickerState() {
  const bike = state.bikes.find((b) => b.id === state.selectedBike);
  if (bike) {
    els.bikePicker.classList.add('locked');
    els.bikeHint.textContent = `Showing parts that fit your ${bike.name}. AI Fit Check is unlocked.`;
  } else {
    els.bikePicker.classList.remove('locked');
    els.bikeHint.textContent =
      'Pick your bike to filter parts and unlock the AI Fit Check.';
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
    ? `${list.length} part${list.length === 1 ? '' : 's'} for your ${bike.name}`
    : `${list.length} part${list.length === 1 ? '' : 's'}`;
  els.count.textContent = meta;

  if (list.length === 0) {
    els.list.innerHTML = `<li class="empty">No parts match your search${
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
        ? `+ ${fmtPrice(l.shipping)} shipping`
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
            <span class="tag bike">Fits: ${escapeHtml(fitsList)}</span>
          </div>
        </div>
        <div class="part-price">
          <div class="price-best">${fmtPrice(totalPrice(best))}</div>
          <div class="price-vendor">at ${escapeHtml(best.vendor)}</div>
          ${savings > 5 ? `<div class="price-savings">Save ${fmtPrice(savings)} vs highest</div>` : ''}
        </div>
      </div>
      <div class="part-actions">
        <button class="fit-btn" data-id="${escapeAttr(part.id)}">
          <span class="ai-spark">✨</span>AI Fit Check
        </button>
        <button class="expand-btn" data-id="${escapeAttr(part.id)}">
          See all ${part.listings.length} option${part.listings.length === 1 ? '' : 's'} →
        </button>
      </div>
      <div class="listings">${listings}</div>
    </li>
  `;
}

// ─── AI Fit Check ────────────────────────────────────────────────────
// Uses the curated `fits` list as the source of truth. To upgrade to
// a real Claude API call (e.g., for fuzzy questions like "will this
// work with my custom controller?"), replace the body of `runFitCheck`
// with a fetch() to a serverless endpoint that proxies the Anthropic API.
// The backend should hold the API key — never expose it client-side.

function openFitCheck(partId) {
  const part = state.parts.find((p) => p.id === partId);
  if (!part) return;

  els.fitTitle.textContent = part.name;

  if (!state.selectedBike) {
    els.fitSubtitle.textContent = 'Pick your bike first';
    els.fitResult.className = 'fit-result';
    els.fitResult.innerHTML = `
      <div class="fit-reason">
        Select your bike at the top of the page (Sur-Ron Light Bee X, Ultra Bee, Talaria X3, MX4, eRide). The AI Fit Check needs to know what you ride to check compatibility.
      </div>
    `;
    showModal();
    return;
  }

  const bike = state.bikes.find((b) => b.id === state.selectedBike);
  els.fitSubtitle.textContent = `Checking against your ${bike.name}…`;
  els.fitResult.className = 'fit-result loading';
  els.fitResult.innerHTML = `<span class="fit-spinner"></span> Analyzing fit…`;
  showModal();

  // Small delay so the loading state registers — feels intentional.
  setTimeout(() => runFitCheck(part, bike), 600);
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
    verdictText = `✅ Yes — fits your ${bike.name}`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is confirmed compatible with the ${escapeHtml(bike.name)}. ${
      fitList.length > 1
        ? `It also fits: ${fitList.filter((n) => n !== bike.name).map(escapeHtml).join(', ')}.`
        : `This part is specific to your bike.`
    }`;
    tip = `Always double-check year/trim on the vendor page before ordering. Some 2023+ models use slightly different mounts.`;
  } else if (sameMake) {
    verdictClass = 'maybe';
    verdictText = `⚠️ Probably not — same make, different model`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is listed for: ${fitList.map(escapeHtml).join(', ')}. Your ${escapeHtml(bike.name)} is the same brand but a different model, so mounts and dimensions usually differ. Possible the part fits with modification, but don't assume.`;
    tip = `Message the vendor and ask "Will this fit a ${bike.name}?" — most reply within a day.`;
  } else {
    verdictClass = 'no-fit';
    verdictText = `❌ No — won't fit your ${bike.name}`;
    reason = `<strong>${escapeHtml(part.name)}</strong> is built for: ${fitList.map(escapeHtml).join(', ')}. Different brand and platform from your ${escapeHtml(bike.name)} — mounting points, frame geometry, and electrical specs won't match.`;
    tip = `Try filtering parts by your bike at the top of the page to skip incompatible parts entirely.`;
  }

  els.fitResult.className = 'fit-result';
  els.fitResult.innerHTML = `
    <div class="verdict ${verdictClass}">${verdictText}</div>
    <div class="fit-reason">${reason}</div>
    <div class="fit-tip">💡 ${tip}</div>
  `;
}

function showModal() {
  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }
