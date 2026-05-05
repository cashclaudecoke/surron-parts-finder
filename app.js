// Surron Parts Finder — V1.3 (bike picker + bikelife visual, no AI)

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
    state.selectedBike = e.target.value;
    if (state.selectedBike) localStorage.setItem('selectedBike', state.selectedBike);
    else localStorage.removeItem('selectedBike');
    updateBikePickerState();
    render();
  });
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
        <button class="expand-btn" data-id="${escapeAttr(part.id)}">
          SEE ALL ${part.listings.length} VENDOR${part.listings.length === 1 ? '' : 'S'} →
        </button>
      </div>
      <div class="listings">${listings}</div>
    </li>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }
